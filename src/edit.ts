import { loadArchitecture } from './architecture-reader.ts'
import { ensurePlanReadme } from './create.ts'
import { curateObserved } from './curate.ts'
import {
  omitCode,
  readDocument,
  replaceLeadProse,
  setOutcomeSection,
  writeObservedDocument,
} from './markdown-emitter.ts'
import { kebabCase } from './naming.ts'
import type { ArchitectureDocument, RevisionRecord } from './types.ts'

interface EditArchitectureInput {
  id: string
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

async function writeLead(
  repositoryRoot: string,
  sourceFilename: string,
  prose: string,
): Promise<void> {
  const source = await readDocument(repositoryRoot, sourceFilename)
  await writeObservedDocument(
    repositoryRoot,
    sourceFilename,
    replaceLeadProse(source, prose),
  )
}

function indexDocuments(
  documents: ArchitectureDocument[],
  index: Map<string, ArchitectureDocument>,
): void {
  for (const document of documents) {
    const id = document.frontmatter.id
    if (typeof id === 'string') index.set(id, document)
  }
}

function indexPlan(record: RevisionRecord, index: ArchitectureIndex): void {
  if (record.revision.kind !== 'plan') return
  const planId = record.revision.name
  index.plans.set(planId, record.context)
  for (const document of record.documents) {
    const id = document.frontmatter.id
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
  description: string | undefined,
): Promise<string> {
  if (planDoc === undefined) throw new Error(`unknown id "${id}"`)
  if (planId !== undefined) throw new Error('--plan is only valid on an element')
  if (description === undefined) throw new Error('--description is required')
  const source = await readDocument(repositoryRoot, planDoc.sourceFilename)
  await writeObservedDocument(
    repositoryRoot,
    planDoc.sourceFilename,
    setOutcomeSection(source, description),
  )
  return id
}

async function restateElement(
  repositoryRoot: string,
  revisions: RevisionRecord[],
  id: string,
  planId: string,
  description: string | undefined,
  observed: ArchitectureDocument | undefined,
  planned: PlannedRecord | undefined,
): Promise<string> {
  if (planned !== undefined && planned.planId !== planId) {
    throw new Error(`id "${id}" is already claimed by ${planned.planId}`)
  }
  if (planned !== undefined) {
    if (description !== undefined) {
      await writeLead(repositoryRoot, planned.document.sourceFilename, description)
    }
    return id
  }
  if (observed === undefined) throw new Error(`unknown id "${id}"`)
  await ensurePlanReadme(repositoryRoot, planId, revisions)
  const dest = `groma/plans/${planId}/${observed.sourceFilename.slice('groma/observed/'.length)}`
  let source = omitCode(await readDocument(repositoryRoot, observed.sourceFilename))
  if (description !== undefined) source = replaceLeadProse(source, description)
  await writeObservedDocument(repositoryRoot, dest, source)
  return id
}

export async function editArchitecture(
  repositoryRoot: string,
  input: EditArchitectureInput,
): Promise<string> {
  const id = input.id
  const planId = optionalText(input.plan)
  const description = optionalText(input.description)

  if (planId !== undefined && planId !== kebabCase(planId)) {
    throw new Error('plan id must be lowercase kebab-case')
  }

  const revisions = await loadArchitecture(repositoryRoot)
  const { observed, planned, plans } = indexArchitecture(revisions)
  const observedDoc = observed.get(id)
  const plannedDoc = planned.get(id)
  const planDoc = plans.get(id)

  if (isStructural(input)) {
    return editStructural(repositoryRoot, revisions, input, plannedDoc, description)
  }

  if (observedDoc === undefined && plannedDoc === undefined) {
    return editPlanOutcome(repositoryRoot, id, planDoc, planId, description)
  }

  if (planId !== undefined) {
    return restateElement(
      repositoryRoot,
      revisions,
      id,
      planId,
      description,
      observedDoc,
      plannedDoc,
    )
  }

  if (description === undefined) {
    throw new Error('--description is required')
  }
  const owner = plannedDoc?.document ?? observedDoc
  if (owner === undefined) {
    throw new Error(`unknown id "${id}"`)
  }
  await writeLead(repositoryRoot, owner.sourceFilename, description)
  return id
}
