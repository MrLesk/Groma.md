import {
  buildArchitectureModel,
  draftRecordOf,
  requireDraftRecord,
} from './architecture-model.ts'
import type { DraftRecord } from './architecture-model.ts'
import { loadArchitecture } from './architecture-reader.ts'
import { curateElement } from './curate.ts'
import type { StructuralResult } from './curate.ts'
import {
  readDocument,
  replaceLeadProse,
  withMeaning,
  withTitle,
  writeDocument,
  validateElementSource,
} from './markdown-emitter.ts'
import type { MeaningChanges } from './markdown-emitter.ts'
import { isGroupAddress, requireText } from './naming.ts'
import { loadProjectProfile, saveProjectProfile } from './project-profile.ts'
import { editGroup } from './group.ts'
import { editRelation } from './relation.ts'
import { editFlow } from './flow-authoring.ts'
import { requireGromaMapping } from './okf-profile.ts'
import type { ArchitectureElement, ArchitectureRecords } from './types.ts'

export interface EditArchitectureInput extends MeaningChanges {
  id: string
  /** The target id of the relationship from id to edit instead of the element itself. */
  relation?: string
  group?: string
  ungroup?: boolean
  parent?: string
  combine?: string[]
  steps?: string
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
  const overview = input.overview
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
  const overview = input.overview
  if (input.title === undefined && overview === undefined) throw new Error('--title or --overview is required')
  let source = await readDocument(repositoryRoot, record.sourceFilename)
  if (input.title !== undefined) source = withTitle(source, requireText(input.title, '--title'))
  if (overview !== undefined) source = replaceLeadProse(source, overview)
  await writeDocument(repositoryRoot, record.sourceFilename, source)
  return record.id
}

async function elementMeaning(
  repositoryRoot: string,
  records: ArchitectureRecords,
  element: ArchitectureElement,
  input: EditArchitectureInput,
): Promise<string> {
  if (input.draft) requireDraftRecord(records, input.draft)
  const source = withMeaning(await readDocument(repositoryRoot, element.sourceFilename), input)
  await validateElementSource(records.documents, element.sourceFilename, source)
  return source
}

/** A group address or a relation target names something other than an element; the flags of elements are refused there. */
function editAddressed(repositoryRoot: string, input: EditArchitectureInput): Promise<string | StructuralResult> | undefined {
  if (isGroupAddress(input.id)) {
    if (input.relation !== undefined || input.overview !== undefined || input.description !== undefined
      || input.technology !== undefined || input.draft !== undefined || isStructural(input)) {
      throw new Error('only --title is valid on a group')
    }
    return editGroup(repositoryRoot, { address: input.id, title: input.title })
  }
  if (input.relation !== undefined) {
    if (input.title !== undefined || input.overview !== undefined || input.draft !== undefined || isStructural(input)) {
      throw new Error('only --description and --technology are valid on a relation')
    }
    return editRelation(repositoryRoot, {
      source: input.id, target: input.relation, description: input.description, technology: input.technology,
    })
  }
  return undefined
}

export async function editArchitecture(
  repositoryRoot: string,
  input: EditArchitectureInput,
): Promise<string | StructuralResult> {
  const addressed = editAddressed(repositoryRoot, input)
  if (addressed !== undefined) return addressed
  if (input.id === 'project') return editProject(repositoryRoot, input)
  const records = await loadArchitecture(repositoryRoot)
  const flow = records.flows.find(document => requireGromaMapping(document.frontmatter, document.sourceFilename).id === input.id)
  if (flow !== undefined) return editFlow(repositoryRoot, records, flow, input)
  const model = buildArchitectureModel(records.documents)
  const element = model.elements.find(candidate => candidate.id === input.id)

  if (element === undefined) {
    const record = records.drafts.map(draftRecordOf).find(candidate => candidate.id === input.id)
    if (record === undefined) throw new Error(`unknown id "${input.id}"`)
    return editDraftRecord(repositoryRoot, record, input)
  }

  const hasMeaning = [input.title, input.overview, input.description, input.technology, input.draft].some(value => value !== undefined)
  if (!hasMeaning && !isStructural(input)) throw new Error('--title, --overview, --description, --technology or --draft is required')
  const source = hasMeaning ? await elementMeaning(repositoryRoot, records, element, input) : undefined

  if (isStructural(input)) {
    return curateElement(repositoryRoot, model, {
      id: input.id,
      title: input.title,
      technology: input.technology,
      draft: input.draft,
      overview: input.overview,
      description: input.description,
      group: input.group,
      ungroup: input.ungroup,
      parent: optionalText(input.parent),
      combine: input.combine,
    })
  }

  await writeDocument(repositoryRoot, element.sourceFilename, source!)
  return element.id
}
