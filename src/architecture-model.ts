import { elementOverview, extractRelationships } from './architecture-markdown.ts'
import { isExternalPath, isReservedDocument } from './architecture-path.ts'
import { codeReferencesOf } from './code-reference.ts'
import { kebabCase } from './naming.ts'
import { DRAFT_TYPE, c4Kind, requireGromaMapping } from './okf-profile.ts'
import type {
  ArchitectureDocument,
  ArchitectureElement,
  ArchitectureModel,
  ArchitectureRecords,
  C4Kind,
  ElementStatus,
} from './types.ts'

export const expectedParentKinds = new Map<C4Kind, C4Kind>([
  ['container', 'system'],
  ['component', 'container'],
])
const rootKinds = new Set<C4Kind>(['actor', 'system'])
const statuses = new Set<string>(['draft', 'stable'])
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export class ArchitectureModelError extends Error {
  readonly code: string
  readonly sourceFilename: string

  constructor(code: string, sourceFilename: string, message: string) {
    super(`${sourceFilename}: ${message}`)
    this.name = 'ArchitectureModelError'
    this.code = code
    this.sourceFilename = sourceFilename
  }
}
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }

  Object.freeze(value)
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child)
  }

  return value
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function invalidElement(sourceFilename: string, message: string): never {
  throw new ArchitectureModelError('INVALID_ELEMENT', sourceFilename, message)
}

function validateGromaFields(groma: Record<string, unknown>, sourceFilename: string): void {
  const unknownFields = Object.keys(groma).filter(field => {
    return !['id', 'parent', 'group', 'technology', 'code', 'draft'].includes(field)
  })
  if (unknownFields.length > 0) {
    invalidElement(sourceFilename, `unsupported groma field(s): ${unknownFields.join(', ')}`)
  }
}

function optionalText(
  value: unknown,
  field: 'description' | 'parent' | 'group' | 'technology' | 'draft',
  sourceFilename: string,
): string | undefined {
  if (value === undefined) return undefined
  const permitsEmpty = field === 'description'
  if (typeof value !== 'string' || (!permitsEmpty && value.trim().length === 0)) {
    invalidElement(
      sourceFilename,
      permitsEmpty
        ? `${field} must be a string when present`
        : `${field} must be a non-empty string when present`,
    )
  }
  return value as string
}

function requireId(value: unknown, sourceFilename: string, label: string): string {
  if (typeof value !== 'string' || !idPattern.test(value)) {
    invalidElement(sourceFilename, `${label} requires a lowercase kebab-case stable id`)
  }
  return value as string
}

function requireTitle(value: unknown, sourceFilename: string, id: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    invalidElement(sourceFilename, `"${id}" requires a non-empty title`)
  }
  return value as string
}

function statusOf(frontmatter: Record<string, unknown>, sourceFilename: string): ElementStatus {
  const status = frontmatter.status
  if (typeof status !== 'string' || !statuses.has(status)) {
    invalidElement(sourceFilename, 'status must be draft or stable')
  }
  return status as ElementStatus
}

function identityOf(
  document: ArchitectureDocument,
  groma: Record<string, unknown>,
): { id: string; kind: C4Kind; title: string; description?: string } {
  const { sourceFilename } = document
  const id = requireId(groma.id, sourceFilename, 'element')
  const kind = c4Kind(document.frontmatter.type)
  if (kind === undefined) {
    invalidElement(sourceFilename, `element "${id}" has unsupported type "${document.frontmatter.type}"`)
  }
  const title = requireTitle(document.frontmatter.title, sourceFilename, id)
  const description = optionalText(document.frontmatter.description, 'description', sourceFilename)
  return { id, kind, title, ...(description === undefined ? {} : { description }) }
}

function draftOf(groma: Record<string, unknown>, sourceFilename: string): string | undefined {
  const draft = optionalText(groma.draft, 'draft', sourceFilename)
  if (draft !== undefined && !idPattern.test(draft)) {
    invalidElement(sourceFilename, 'draft must name a draft record by its kebab-case id')
  }
  return draft
}

function documentToElement(document: ArchitectureDocument): ArchitectureElement {
  const { sourceFilename } = document
  const groma = requireGromaMapping(document.frontmatter, sourceFilename)
  validateGromaFields(groma, sourceFilename)
  const { id, kind, title, description } = identityOf(document, groma)
  const external = isExternalPath(sourceFilename)
  if (external && kind !== 'system') {
    invalidElement(sourceFilename, `only a system can live under externals/, but "${id}" is a ${kind}`)
  }
  const parent = optionalText(groma.parent, 'parent', sourceFilename)
  const group = optionalText(groma.group, 'group', sourceFilename)
  const technology = optionalText(groma.technology, 'technology', sourceFilename)
  const draft = draftOf(groma, sourceFilename)

  return {
    id,
    kind,
    title,
    ...(description === undefined ? {} : { description }),
    overview: elementOverview(document, (code, filename, message) => {
      throw new ArchitectureModelError(code, filename, message)
    }),
    parentId: parent ?? null,
    external,
    ...(group === undefined ? {} : { group }),
    ...(technology === undefined ? {} : { technology }),
    code: codeReferencesOf(groma.code, kind, message => {
      throw new ArchitectureModelError('INVALID_ELEMENT', sourceFilename, message)
    }),
    status: statusOf(document.frontmatter, sourceFilename),
    ...(draft === undefined ? {} : { draft }),
    sourceFilename,
  }
}

function validateContainment(
  elements: ArchitectureElement[],
  elementsById: Map<string, ArchitectureElement>,
): void {
  for (const element of elements) {
    if (rootKinds.has(element.kind)) {
      if (element.parentId !== null) {
        throw new ArchitectureModelError(
          'INVALID_PARENT',
          element.sourceFilename,
          `${element.kind} "${element.id}" cannot declare a parent`,
        )
      }
      continue
    }

    const expectedParentKind = expectedParentKinds.get(element.kind)
    if (element.parentId === null) {
      throw new ArchitectureModelError(
        'INVALID_PARENT',
        element.sourceFilename,
        `${element.kind} "${element.id}" requires a ${expectedParentKind} parent id`,
      )
    }

    const parent = elementsById.get(element.parentId)
    if (!parent) {
      throw new ArchitectureModelError(
        'UNKNOWN_PARENT_ID',
        element.sourceFilename,
        `unknown parent id "${element.parentId}"`,
      )
    }
    if (parent.kind !== expectedParentKind) {
      throw new ArchitectureModelError(
        'INVALID_PARENT',
        element.sourceFilename,
        `${element.kind} "${element.id}" requires a ${expectedParentKind} parent, `
        + `but "${element.parentId}" has kind "${parent.kind}"`,
      )
    }
    if (parent.external) {
      throw new ArchitectureModelError(
        'INVALID_PARENT',
        element.sourceFilename,
        `${element.kind} "${element.id}" cannot live inside external system "${parent.id}"`,
      )
    }
  }
}

/** The path below the Groma directory, whichever of groma/ or .groma/ holds it. */
function relativeToGromaRoot(sourceFilename: string): string {
  return sourceFilename.split('/').slice(1).join('/')
}

function validateElementLocation(element: ArchitectureElement): void {
  const relative = relativeToGromaRoot(element.sourceFilename)
  const patterns: Record<C4Kind, RegExp> = {
    actor: /^actors\/[^/]+\.md$/,
    system: element.external ? /^externals\/[^/]+\.md$/ : /^systems\/[^/]+\/system\.md$/,
    container: /^systems\/[^/]+\/containers\/[^/]+\/container\.md$/,
    component: /^systems\/[^/]+\/containers\/[^/]+\/components\/[^/]+\.md$/,
  }
  if (!patterns[element.kind].test(relative)) {
    throw new ArchitectureModelError(
      'INVALID_ELEMENT_LOCATION',
      element.sourceFilename,
      `${element.kind} "${element.id}" is not stored at its canonical C4 path`,
    )
  }
}

export function buildArchitectureModel(
  sourceDocuments: readonly ArchitectureDocument[],
): ArchitectureModel {
  const documents = [...sourceDocuments]
    .sort((left, right) => compareStrings(left.sourceFilename, right.sourceFilename))
  const elements: ArchitectureElement[] = []
  const elementsById = new Map<string, ArchitectureElement>()
  const elementsBySourceFilename = new Map<string, ArchitectureElement>()

  for (const document of documents) {
    const element = documentToElement(document)
    validateElementLocation(element)
    const first = elementsById.get(element.id)

    if (first) {
      throw new ArchitectureModelError(
        'DUPLICATE_ID',
        element.sourceFilename,
        `duplicate id "${element.id}" (already declared by ${first.sourceFilename})`,
      )
    }

    elements.push(element)
    elementsById.set(element.id, element)
    elementsBySourceFilename.set(element.sourceFilename, element)
  }

  validateContainment(elements, elementsById)
  elements.sort((left, right) => compareStrings(left.id, right.id))

  return deepFreeze({
    elements,
    relationships: extractRelationships(
      documents,
      elementsBySourceFilename,
      (code, filename, message) => {
        throw new ArchitectureModelError(code, filename, message)
      },
    ),
  })
}

/** A draft record: the outcome people are drafting toward, named by the tag on its elements. */
export interface DraftRecord {
  id: string
  title: string
  outcome: string
  sourceFilename: string
}

export function draftRecordOf(document: ArchitectureDocument): DraftRecord {
  const { sourceFilename } = document
  const invalid = (message: string): never => {
    throw new ArchitectureModelError('INVALID_DRAFT', sourceFilename, message)
  }
  if (document.frontmatter.type !== DRAFT_TYPE) invalid(`draft record requires type "${DRAFT_TYPE}"`)
  const groma = requireGromaMapping(document.frontmatter, sourceFilename)
  const id = requireId(groma.id, sourceFilename, 'draft record')
  if (relativeToGromaRoot(sourceFilename) !== `drafts/${id}.md`) {
    invalid(`draft record "${id}" must be stored at drafts/${id}.md`)
  }
  return {
    id,
    title: requireTitle(document.frontmatter.title, sourceFilename, id),
    outcome: elementOverview(document, (_code, _filename, message) => invalid(message)),
    sourceFilename,
  }
}

/** The draft a writer may point at: one whose record exists. */
export function requireDraftRecord(records: ArchitectureRecords, draft: string): string {
  if (!records.drafts.some(document => draftRecordOf(document).id === draft)) {
    throw new Error(`unknown draft "${draft}"`)
  }
  return draft
}

/** The kebab id a new name gets, provided no element or draft record holds it and it is not a reserved document name. */
export function freeId(records: ArchitectureRecords, model: ArchitectureModel, name: string): string {
  const id = kebabCase(name)
  if (id === '') throw new Error('name must contain a letter or a digit')
  if (model.elements.some(element => element.id === id)) throw new Error(`id "${id}" already exists`)
  if (records.flows.some(document => requireGromaMapping(document.frontmatter, document.sourceFilename).id === id)) {
    throw new Error(`id "${id}" already names a flow`)
  }
  if (records.drafts.some(document => draftRecordOf(document).id === id)) {
    throw new Error(`id "${id}" already names a draft`)
  }
  if (isReservedDocument(`${id}.md`)) throw new Error(`"${id}" is a reserved document name`)
  return id
}
