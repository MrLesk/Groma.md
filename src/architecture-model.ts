import path from 'node:path'
import { elementOverview, extractRelationships } from './architecture-markdown.ts'
import { codeReferencesOf } from './code-reference.ts'
import { c4Kind, requireGromaMapping } from './okf-profile.ts'
import type {
  ArchitectureDocument,
  ArchitectureElement,
  ArchitectureModel,
  C4Kind,
  Revision,
  RevisionRecord,
} from './types.ts'

const expectedParentKinds = new Map<C4Kind, C4Kind>([
  ['container', 'system'],
  ['component', 'container'],
])
const rootKinds = new Set<C4Kind>(['actor', 'system'])
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
    return !['id', 'parent', 'external', 'group', 'technology', 'code'].includes(field)
  })
  if (unknownFields.length > 0) {
    invalidElement(sourceFilename, `unsupported groma field(s): ${unknownFields.join(', ')}`)
  }
}

function optionalText(
  value: unknown,
  field: 'description' | 'parent' | 'group' | 'technology',
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

function identityOf(
  document: ArchitectureDocument,
  groma: Record<string, unknown>,
): { id: string; kind: C4Kind; title: string; description?: string } {
  const { sourceFilename } = document
  const id = groma.id
  if (typeof id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    invalidElement(sourceFilename, 'element requires a lowercase kebab-case stable id')
  }
  const kind = c4Kind(document.frontmatter.type)
  if (kind === undefined) {
    invalidElement(sourceFilename, `element "${id}" has unsupported type "${document.frontmatter.type}"`)
  }
  const title = document.frontmatter.title
  if (typeof title !== 'string' || title.trim().length === 0) {
    invalidElement(sourceFilename, `element "${id}" requires a non-empty title`)
  }
  const description = optionalText(document.frontmatter.description, 'description', sourceFilename)
  return { id, kind, title: title as string, ...(description === undefined ? {} : { description }) }
}

function externalOf(
  groma: Record<string, unknown>,
  kind: C4Kind,
  id: string,
  sourceFilename: string,
): boolean {
  if (!Object.hasOwn(groma, 'external')) return false
  if (typeof groma.external !== 'boolean') {
    invalidElement(sourceFilename, 'external must be a boolean when present')
  }
  if (groma.external !== true) {
    invalidElement(sourceFilename, 'external may only be present with the value true')
  }
  if (kind !== 'system') {
    invalidElement(sourceFilename, `only a system can be external, but "${id}" has kind "${kind}"`)
  }
  return true
}

function documentToElement(document: ArchitectureDocument): ArchitectureElement {
  const { sourceFilename } = document
  const groma = requireGromaMapping(document.frontmatter, sourceFilename)
  validateGromaFields(groma, sourceFilename)
  const { id, kind, title, description } = identityOf(document, groma)
  const parent = optionalText(groma.parent, 'parent', sourceFilename)
  const group = optionalText(groma.group, 'group', sourceFilename)
  const technology = optionalText(groma.technology, 'technology', sourceFilename)

  return {
    id,
    kind,
    title,
    ...(description === undefined ? {} : { description }),
    overview: elementOverview(document, (code, filename, message) => {
      throw new ArchitectureModelError(code, filename, message)
    }),
    parentId: parent ?? null,
    external: externalOf(groma, kind, id, sourceFilename),
    ...(group === undefined ? {} : { group }),
    ...(technology === undefined ? {} : { technology }),
    code: codeReferencesOf(groma.code, kind, message => {
      throw new ArchitectureModelError('INVALID_ELEMENT', sourceFilename, message)
    }),
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
  }
}

function validateElementLocation(element: ArchitectureElement, revision: Revision): void {
  const relative = path.posix.relative(revision.sourceDirectory, element.sourceFilename)
  const patterns: Record<C4Kind, RegExp> = {
    actor: /^actors\/[^/]+\.md$/,
    system: /^systems\/[^/]+\/system\.md$/,
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

function canonicalRevision(revision: Revision): Revision {
  if (revision.kind === 'plan') {
    return {
      kind: 'plan',
      name: revision.name,
      sourceDirectory: revision.sourceDirectory,
    }
  }

  return {
    kind: revision.kind,
    sourceDirectory: revision.sourceDirectory,
  }
}

export function buildArchitectureModel(
  revisionRecord: Pick<RevisionRecord, 'revision' | 'documents'>,
): ArchitectureModel {
  const documents = [...revisionRecord.documents]
    .sort((left, right) => compareStrings(left.sourceFilename, right.sourceFilename))
  const elements: ArchitectureElement[] = []
  const elementsById = new Map<string, ArchitectureElement>()
  const elementsBySourceFilename = new Map<string, ArchitectureElement>()

  for (const document of documents) {
    const element = documentToElement(document)
    validateElementLocation(element, revisionRecord.revision)
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
    revision: canonicalRevision(revisionRecord.revision),
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
