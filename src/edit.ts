import { architectureRelative } from './architecture-path.ts'
import { loadArchitecture } from './architecture-reader.ts'
import { ensurePlanIndex } from './create.ts'
import { curateObserved } from './curate.ts'
import { GromaFileSystem } from './groma-filesystem.ts'
import {
  omitCode,
  readDocument,
  replaceLeadProse,
  setOutcomeSection,
  withDescription,
  withRepresentationStatus,
  writeObservedDocument,
} from './markdown-emitter.ts'
import { kebabCase } from './naming.ts'
import { requireGromaMapping } from './okf-profile.ts'
import type { RepresentationStatus } from './markdown-emitter.ts'
import type { ArchitectureDocument, RevisionRecord } from './types.ts'

interface EditArchitectureInput {
  id: string
  overview?: string
  description?: string
  plan?: string
  group?: string
  ungroup?: boolean
  parent?: string
  combine?: string[]
}

interface PlannedRecord {
  planId: string
  document: ArchitectureDocument
}

interface ArchitectureIndex {
  observed: Map<string, ArchitectureDocument>
  planned: Map<string, PlannedRecord>
  plans: Map<string, ArchitectureDocument>
}

function optionalText(value: string | undefined): string | undefined {
  if (value === undefined || value === '') return undefined
  return value
}

function editedElementSource(
  source: string,
  overview: string | undefined,
  description: string | undefined,
  status: RepresentationStatus,
): string {
  let edited = overview === undefined ? source : replaceLeadProse(source, overview)
  edited = withDescription(edited, description)
  return withRepresentationStatus(edited, status)
}

async function writeElementMeaning(
  repositoryRoot: string,
  sourceFilename: string,
  overview: string | undefined,
  description: string | undefined,
  status: RepresentationStatus,
): Promise<void> {
  const source = await readDocument(repositoryRoot, sourceFilename)
  await writeObservedDocument(
    repositoryRoot,
    sourceFilename,
    editedElementSource(source, overview, description, status),
  )
}

function indexDocuments(
  documents: ArchitectureDocument[],
  index: Map<string, ArchitectureDocument>,
): void {
  for (const document of documents) {
    const id = requireGromaMapping(
      document.frontmatter,
      document.sourceFilename,
    ).id
    if (typeof id === 'string') index.set(id, document)
  }
}

function indexPlan(record: RevisionRecord, index: ArchitectureIndex): void {
  if (record.revision.kind !== 'plan') return
  const planId = record.revision.name
  index.plans.set(planId, record.context)
  for (const document of record.documents) {
    const id = requireGromaMapping(
      document.frontmatter,
      document.sourceFilename,
    ).id
    if (typeof id === 'string') index.planned.set(id, { planId, document })
  }
}

function indexArchitecture(revisions: RevisionRecord[]): ArchitectureIndex {
  const index: ArchitectureIndex = {
    observed: new Map(),
    planned: new Map(),
    plans: new Map(),
  }
  for (const record of revisions) {
    if (record.revision.kind === 'observed') {
      indexDocuments(record.documents, index.observed)
    } else {
      indexPlan(record, index)
    }
  }
  return index
}

function isStructural(input: EditArchitectureInput): boolean {
  return input.group !== undefined
    || input.ungroup === true
    || input.parent !== undefined
    || (input.combine?.length ?? 0) > 0
}

async function editStructural(
  repositoryRoot: string,
  revisions: RevisionRecord[],
  input: EditArchitectureInput,
  planned: PlannedRecord | undefined,
  overview: string | undefined,
  description: string | undefined,
): Promise<string> {
  if (input.plan !== undefined) {
    throw new Error('--plan cannot be combined with structural edits')
  }
  if (planned !== undefined) {
    throw new Error(`id "${input.id}" is claimed by ${planned.planId}`)
  }
  return curateObserved(repositoryRoot, revisions, {
    id: input.id,
    overview,
    description,
    group: input.group,
    ungroup: input.ungroup,
    parent: optionalText(input.parent),
    combine: input.combine,
  })
}

async function editPlanOutcome(
  repositoryRoot: string,
  id: string,
  planDoc: ArchitectureDocument | undefined,
  planId: string | undefined,
  overview: string | undefined,
  description: string | undefined,
): Promise<string> {
  if (planDoc === undefined) throw new Error(`unknown id "${id}"`)
  if (planId !== undefined) throw new Error('--plan is only valid on an element')
  if (description !== undefined) throw new Error('--description is only valid on an element')
  if (overview === undefined) throw new Error('--overview is required')
  const source = await readDocument(repositoryRoot, planDoc.sourceFilename)
  await writeObservedDocument(
    repositoryRoot,
    planDoc.sourceFilename,
    setOutcomeSection(source, overview),
  )
  return id
}

async function restateElement(
  repositoryRoot: string,
  revisions: RevisionRecord[],
  id: string,
  planId: string,
  overview: string | undefined,
  description: string | undefined,
  observed: ArchitectureDocument | undefined,
  planned: PlannedRecord | undefined,
): Promise<string> {
  if (planned !== undefined && planned.planId !== planId) {
    throw new Error(`id "${id}" is already claimed by ${planned.planId}`)
  }
  if (planned !== undefined) {
    if (overview !== undefined || description !== undefined) {
      await writeElementMeaning(
        repositoryRoot,
        planned.document.sourceFilename,
        overview,
        description,
        'draft',
      )
    }
    return id
  }
  if (observed === undefined) throw new Error(`unknown id "${id}"`)
  await ensurePlanIndex(repositoryRoot, planId, revisions)
  const dest = GromaFileSystem.open(repositoryRoot).sourceFilename(
    `plans/${planId}/${architectureRelative(observed.sourceFilename)}`,
  )
  let source = omitCode(
    await readDocument(repositoryRoot, observed.sourceFilename),
  )
  source = editedElementSource(source, overview, description, 'draft')
  await writeObservedDocument(repositoryRoot, dest, source)
  return id
}

export async function editArchitecture(
  repositoryRoot: string,
  input: EditArchitectureInput,
): Promise<string> {
  const id = input.id
  const planId = optionalText(input.plan)
  const overview = optionalText(input.overview)
  const description = input.description

  if (planId !== undefined && planId !== kebabCase(planId)) {
    throw new Error('plan id must be lowercase kebab-case')
  }

  const revisions = await loadArchitecture(repositoryRoot)
  const { observed, planned, plans } = indexArchitecture(revisions)
  const observedDoc = observed.get(id)
  const plannedDoc = planned.get(id)
  const planDoc = plans.get(id)

  if (isStructural(input)) {
    return editStructural(
      repositoryRoot,
      revisions,
      input,
      plannedDoc,
      overview,
      description,
    )
  }

  if (observedDoc === undefined && plannedDoc === undefined) {
    return editPlanOutcome(
      repositoryRoot,
      id,
      planDoc,
      planId,
      overview,
      description,
    )
  }

  if (planId !== undefined) {
    return restateElement(
      repositoryRoot,
      revisions,
      id,
      planId,
      overview,
      description,
      observedDoc,
      plannedDoc,
    )
  }

  if (overview === undefined && description === undefined) {
    throw new Error('--overview or --description is required')
  }
  const owner = plannedDoc?.document ?? observedDoc
  if (owner === undefined) {
    throw new Error(`unknown id "${id}"`)
  }
  await writeElementMeaning(
    repositoryRoot,
    owner.sourceFilename,
    overview,
    description,
    plannedDoc === undefined ? 'stable' : 'draft',
  )
  return id
}
