import {
  buildArchitectureModel,
  draftRecordOf,
  requireDraftRecord,
} from './architecture-model.ts'
import type { DraftRecord } from './architecture-model.ts'
import { loadArchitecture } from './architecture-reader.ts'
import { curateElement } from './curate.ts'
import {
  readDocument,
  replaceLeadProse,
  withDescription,
  withGromaField,
  writeDocument,
} from './markdown-emitter.ts'
import type { ArchitectureElement, ArchitectureRecords } from './types.ts'

export interface EditArchitectureInput {
  id: string
  overview?: string
  description?: string
  draft?: string
  group?: string
  ungroup?: boolean
  parent?: string
  combine?: string[]
}

function optionalText(value: string | undefined): string | undefined {
  if (value === undefined || value === '') return undefined
  return value
}

function isStructural(input: EditArchitectureInput): boolean {
  return input.group !== undefined
    || input.ungroup === true
    || input.parent !== undefined
    || (input.combine?.length ?? 0) > 0
}

/** A draft record carries only its outcome; everything else belongs to elements. */
async function editDraftRecord(
  repositoryRoot: string,
  record: DraftRecord,
  input: EditArchitectureInput,
): Promise<string> {
  if (input.description !== undefined) throw new Error('--description is only valid on an element')
  if (input.draft !== undefined) throw new Error('--draft is only valid on an element')
  if (isStructural(input)) throw new Error('structural edits are only valid on an element')
  const overview = optionalText(input.overview)
  if (overview === undefined) throw new Error('--overview is required')
  const source = await readDocument(repositoryRoot, record.sourceFilename)
  await writeDocument(
    repositoryRoot,
    record.sourceFilename,
    replaceLeadProse(source, overview),
  )
  return record.id
}

async function editElementMeaning(
  repositoryRoot: string,
  records: ArchitectureRecords,
  element: ArchitectureElement,
  input: EditArchitectureInput,
): Promise<string> {
  const overview = optionalText(input.overview)
  const description = input.description
  const draft = optionalText(input.draft)
  if (overview === undefined && description === undefined && draft === undefined) {
    throw new Error('--overview, --description or --draft is required')
  }
  if (draft !== undefined) requireDraftRecord(records, draft)
  let source = await readDocument(repositoryRoot, element.sourceFilename)
  if (overview !== undefined) source = replaceLeadProse(source, overview)
  source = withDescription(source, description)
  if (draft !== undefined) source = withGromaField(source, 'draft', draft)
  await writeDocument(repositoryRoot, element.sourceFilename, source)
  return element.id
}

export async function editArchitecture(
  repositoryRoot: string,
  input: EditArchitectureInput,
): Promise<string> {
  const records = await loadArchitecture(repositoryRoot)
  const model = buildArchitectureModel(records.documents)
  const element = model.elements.find(candidate => candidate.id === input.id)

  if (element === undefined) {
    const record = records.drafts.map(draftRecordOf).find(candidate => candidate.id === input.id)
    if (record === undefined) throw new Error(`unknown id "${input.id}"`)
    return editDraftRecord(repositoryRoot, record, input)
  }

  if (isStructural(input)) {
    if (input.draft !== undefined) {
      throw new Error('--draft cannot be combined with structural edits')
    }
    return curateElement(repositoryRoot, model, {
      id: input.id,
      overview: optionalText(input.overview),
      description: input.description,
      group: input.group,
      ungroup: input.ungroup,
      parent: optionalText(input.parent),
      combine: input.combine,
    })
  }

  return editElementMeaning(repositoryRoot, records, element, input)
}
