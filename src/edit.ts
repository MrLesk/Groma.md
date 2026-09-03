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
  withTitle,
  writeDocument,
} from './markdown-emitter.ts'
import { requireText } from './naming.ts'
import { loadProjectProfile, saveProjectProfile } from './project-profile.ts'
import type { ArchitectureElement, ArchitectureRecords } from './types.ts'

export interface EditArchitectureInput {
  id: string
  title?: string
  overview?: string
  description?: string
  technology?: string
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

/** The project record: its title, description and overview, merged into the current profile. */
async function editProject(repositoryRoot: string, input: EditArchitectureInput): Promise<string> {
  if (isStructural(input) || input.draft !== undefined || input.technology !== undefined) {
    throw new Error('only --title, --description and --overview are valid on the project')
  }
  const overview = optionalText(input.overview)
  if (input.title === undefined && input.description === undefined && overview === undefined) {
    throw new Error('--title, --description or --overview is required')
  }
  const profile = await loadProjectProfile(repositoryRoot)
  if (profile === undefined) throw new Error('the project record is missing or invalid')
  await saveProjectProfile(repositoryRoot, {
    title: input.title ?? profile.title,
    overview: overview ?? profile.overview,
    ...(input.description === undefined ? {} : { description: input.description }),
  })
  return 'project'
}

/** A draft record carries a title and its outcome; everything else belongs to elements. */
async function editDraftRecord(
  repositoryRoot: string,
  record: DraftRecord,
  input: EditArchitectureInput,
): Promise<string> {
  if (input.description !== undefined || input.technology !== undefined || input.draft !== undefined || isStructural(input)) {
    throw new Error('only --title and --overview are valid on a draft record')
  }
  const overview = optionalText(input.overview)
  if (input.title === undefined && overview === undefined) throw new Error('--title or --overview is required')
  let source = await readDocument(repositoryRoot, record.sourceFilename)
  if (input.title !== undefined) source = withTitle(source, requireText(input.title, '--title'))
  if (overview !== undefined) source = replaceLeadProse(source, overview)
  await writeDocument(repositoryRoot, record.sourceFilename, source)
  return record.id
}

async function editElementMeaning(
  repositoryRoot: string,
  records: ArchitectureRecords,
  element: ArchitectureElement,
  input: EditArchitectureInput,
): Promise<string> {
  const overview = optionalText(input.overview)
  const draft = optionalText(input.draft)
  if ([input.title, overview, input.description, input.technology, draft].every(change => change === undefined)) {
    throw new Error('--title, --overview, --description, --technology or --draft is required')
  }
  if (draft !== undefined) requireDraftRecord(records, draft)
  let source = await readDocument(repositoryRoot, element.sourceFilename)
  if (input.title !== undefined) source = withTitle(source, requireText(input.title, '--title'))
  if (overview !== undefined) source = replaceLeadProse(source, overview)
  source = withDescription(source, input.description)
  if (input.technology !== undefined) source = withGromaField(source, 'technology', optionalText(input.technology))
  if (draft !== undefined) source = withGromaField(source, 'draft', draft)
  await writeDocument(repositoryRoot, element.sourceFilename, source)
  return element.id
}

export async function editArchitecture(
  repositoryRoot: string,
  input: EditArchitectureInput,
): Promise<string> {
  if (input.id === 'project') return editProject(repositoryRoot, input)
  const records = await loadArchitecture(repositoryRoot)
  const model = buildArchitectureModel(records.documents)
  const element = model.elements.find(candidate => candidate.id === input.id)

  if (element === undefined) {
    const record = records.drafts.map(draftRecordOf).find(candidate => candidate.id === input.id)
    if (record === undefined) throw new Error(`unknown id "${input.id}"`)
    return editDraftRecord(repositoryRoot, record, input)
  }

  if (isStructural(input)) {
    if (input.draft !== undefined || input.title !== undefined || input.technology !== undefined) {
      throw new Error('only --overview and --description can be combined with structural edits')
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
