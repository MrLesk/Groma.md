import { loadArchitecture } from './architecture-reader.ts'
import { ensurePlanReadme } from './create.ts'
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
}

interface PlannedRecord {
  planId: string
  document: ArchitectureDocument
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

function indexArchitecture(revisions: RevisionRecord[]) {
  const observed = new Map<string, ArchitectureDocument>()
  const planned = new Map<string, PlannedRecord>()
  const plans = new Map<string, ArchitectureDocument>()

  for (const record of revisions) {
    if (record.revision.kind === 'observed') {
      for (const document of record.documents) {
        const id = document.frontmatter.id
        if (typeof id === 'string') observed.set(id, document)
      }
      continue
    }
    if (record.revision.kind !== 'plan') continue
    plans.set(record.revision.name, record.context)
    for (const document of record.documents) {
      const id = document.frontmatter.id
      if (typeof id === 'string') {
        planned.set(id, { planId: record.revision.name, document })
      }
    }
  }

  return { observed, planned, plans }
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

  if (observedDoc === undefined && plannedDoc === undefined) {
    if (planDoc === undefined) {
      throw new Error(`unknown id "${id}"`)
    }
    if (planId !== undefined) {
      throw new Error('--plan is only valid on an element')
    }
    if (description === undefined) {
      throw new Error('--description is required')
    }
    const source = await readDocument(repositoryRoot, planDoc.sourceFilename)
    await writeObservedDocument(
      repositoryRoot,
      planDoc.sourceFilename,
      setOutcomeSection(source, description),
    )
    return id
  }

  if (planId !== undefined) {
    if (plannedDoc !== undefined && plannedDoc.planId !== planId) {
      throw new Error(`id "${id}" is already claimed by ${plannedDoc.planId}`)
    }
    if (plannedDoc !== undefined) {
      if (description !== undefined) {
        await writeLead(
          repositoryRoot,
          plannedDoc.document.sourceFilename,
          description,
        )
      }
      return id
    }
    if (observedDoc === undefined) {
      throw new Error(`unknown id "${id}"`)
    }
    await ensurePlanReadme(repositoryRoot, planId, revisions)
    const dest = `groma/plans/${planId}/${observedDoc.sourceFilename.slice('groma/observed/'.length)}`
    let source = omitCode(
      await readDocument(repositoryRoot, observedDoc.sourceFilename),
    )
    if (description !== undefined) {
      source = replaceLeadProse(source, description)
    }
    await writeObservedDocument(repositoryRoot, dest, source)
    return id
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
