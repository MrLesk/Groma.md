import path from 'node:path'

import type {
  ArchitectureDocument,
  ArchitectureElement,
  ArchitectureModel,
  ArchitectureRelationship,
  C4Kind,
  MarkdownElement,
  MarkdownNode,
  Revision,
  RevisionRecord,
} from './types.ts'

const expectedParentKinds = new Map<C4Kind, C4Kind>([
  ['container', 'system'],
  ['component', 'container'],
])
const rootKinds = new Set<C4Kind>(['actor', 'system'])
const supportedKinds = new Set<C4Kind>([...rootKinds, ...expectedParentKinds.keys()])

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

function nodeText(node: MarkdownNode | undefined): string {
  if (typeof node === 'string') {
    return node
  }
  if (!Array.isArray(node)) {
    return ''
  }

  const children = node.slice(2) as MarkdownNode[]
  return children.map(nodeText).join('')
}

function collectNodes(
  node: MarkdownNode | MarkdownNode[] | undefined,
  tag: string,
  collected: MarkdownElement[] = [],
): MarkdownElement[] {
  if (!Array.isArray(node)) {
    return collected
  }

  const values = node as unknown[]
  const isAstNode = typeof values[0] === 'string'
  if (isAstNode && node[0] === tag) {
    collected.push(node as MarkdownElement)
  }

  const children = (isAstNode ? values.slice(2) : values) as MarkdownNode[]
  for (const child of children) {
    collectNodes(child, tag, collected)
  }

  return collected
}

function elementNameAndDescription(nodes: MarkdownNode[]) {
  const headingIndex = nodes.findIndex(node => Array.isArray(node) && node[0] === 'h1')
  const heading = nodes[headingIndex]
  const description = nodes[headingIndex + 1]

  return {
    name: nodeText(heading).trim(),
    description: description?.[0] === 'p' ? nodeText(description).trim() : '',
  }
}

function relationshipRows(nodes: MarkdownNode[]): MarkdownElement[] {
  const rows: MarkdownElement[] = []
  let inRelationshipsSection = false

  for (const node of nodes) {
    if (!Array.isArray(node)) continue
    if (node[0] === 'h2') {
      inRelationshipsSection = node[1]?.id === 'relationships'
      continue
    }

    if (inRelationshipsSection && node[0] === 'table') {
      for (const tableBody of collectNodes(node, 'tbody')) {
        rows.push(...collectNodes(tableBody, 'tr'))
      }
    }
  }

  return rows
}

function relationshipTargetFilename(
  sourceFilename: string,
  href: unknown,
): string | null {
  if (typeof href !== 'string') {
    return null
  }

  let decodedHref: string
  try {
    decodedHref = decodeURIComponent(href.split('#', 1)[0])
  } catch {
    return null
  }

  if (
    decodedHref.length === 0
    || path.posix.isAbsolute(decodedHref)
    || /^[a-z][a-z\d+.-]*:/i.test(decodedHref)
  ) {
    return null
  }

  return path.posix.normalize(
    path.posix.join(path.posix.dirname(sourceFilename), decodedHref),
  )
}

function documentToElement(document: ArchitectureDocument): ArchitectureElement {
  const { id, kind, parent, external, group, technology, code } = document.frontmatter
  const { sourceFilename } = document
  const declaresExternal = Object.hasOwn(document.frontmatter, 'external')

  if (typeof id !== 'string' || id.length === 0) {
    throw new ArchitectureModelError(
      'INVALID_ELEMENT',
      sourceFilename,
      'element requires a stable id',
    )
  }
  if (typeof kind !== 'string' || !supportedKinds.has(kind as C4Kind)) {
    throw new ArchitectureModelError(
      'INVALID_ELEMENT',
      sourceFilename,
      `element "${id}" has unsupported kind "${kind}"`,
    )
  }
  if (declaresExternal && typeof external !== 'boolean') {
    throw new ArchitectureModelError(
      'INVALID_ELEMENT',
      sourceFilename,
      'external must be a boolean when present',
    )
  }
  if (declaresExternal && external !== true) {
    throw new ArchitectureModelError(
      'INVALID_ELEMENT',
      sourceFilename,
      'external may only be present with the value true',
    )
  }
  if (external === true && kind !== 'system') {
    throw new ArchitectureModelError(
      'INVALID_ELEMENT',
      sourceFilename,
      `only a system can be external, but "${id}" has kind "${kind}"`,
    )
  }
  if (
    group !== undefined
    && (typeof group !== 'string' || group.trim().length === 0)
  ) {
    throw new ArchitectureModelError(
      'INVALID_ELEMENT',
      sourceFilename,
      'group must be a non-empty string when present',
    )
  }
  if (
    technology !== undefined
    && (typeof technology !== 'string' || technology.trim().length === 0)
  ) {
    throw new ArchitectureModelError(
      'INVALID_ELEMENT',
      sourceFilename,
      'technology must be a non-empty string when present',
    )
  }

  const { name, description } = elementNameAndDescription(document.nodes)
  const codeReferences = Array.isArray(code)
    ? code.map(reference => ({
        scanner: reference.scanner,
        file: reference.file,
        ...(Object.hasOwn(reference, 'symbol') ? { symbol: reference.symbol } : {}),
      }))
    : []

  return {
    id,
    kind: kind as C4Kind,
    name,
    description,
    parentId: parent ?? null,
    external: external === true,
    ...(typeof group === 'string' ? { group } : {}),
    ...(typeof technology === 'string' ? { technology } : {}),
    code: codeReferences,
    sourceFilename,
  }
}

function validateContainment(
  elements: ArchitectureElement[],
  elementsById: Map<string, ArchitectureElement>,
  declaredParentIds: Set<string>,
): void {
  for (const element of elements) {
    if (rootKinds.has(element.kind)) {
      if (declaredParentIds.has(element.id)) {
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

function validateActorLocation(element: ArchitectureElement, revision: Revision): void {
  if (element.kind !== 'actor') return
  const actorsDirectory = `${revision.sourceDirectory}/actors/`
  const relative = element.sourceFilename.slice(actorsDirectory.length)
  if (!element.sourceFilename.startsWith(actorsDirectory) || relative.includes('/')) {
    throw new ArchitectureModelError(
      'INVALID_ELEMENT_LOCATION',
      element.sourceFilename,
      `actor "${element.id}" must be stored directly under ${actorsDirectory}`,
    )
  }
}

function extractRelationships(
  documents: ArchitectureDocument[],
  elementsBySourceFilename: Map<string, ArchitectureElement>,
): ArchitectureRelationship[] {
  const relationships: ArchitectureRelationship[] = []

  for (const document of documents) {
    for (const row of relationshipRows(document.nodes)) {
      const cells = (row.slice(2) as MarkdownNode[])
        .filter((child): child is MarkdownElement => {
          return Array.isArray(child) && child[0] === 'td'
        })
      const links = collectNodes(cells[0], 'a')
      const href = links[0]?.[1]?.href
      const targetSourceFilename = relationshipTargetFilename(
        document.sourceFilename,
        href,
      )
      const target = targetSourceFilename
        ? elementsBySourceFilename.get(targetSourceFilename)
        : undefined

      if (!target) {
        const displayedTarget = targetSourceFilename ?? String(href ?? '(missing link)')
        throw new ArchitectureModelError(
          'UNKNOWN_RELATIONSHIP_TARGET',
          document.sourceFilename,
          `relationship target "${displayedTarget}" does not resolve in this revision`,
        )
      }

      relationships.push({
        sourceId: document.frontmatter.id as string,
        targetId: target.id,
        description: nodeText(cells[1]).trim(),
        technology: nodeText(cells[2]).trim(),
        sourceFilename: document.sourceFilename,
        targetSourceFilename: target.sourceFilename,
      })
    }
  }

  return relationships.sort((left, right) => {
    const leftKey = [
      left.sourceId,
      left.targetId,
      left.description,
      left.technology,
      left.sourceFilename,
      left.targetSourceFilename,
    ].join('\0')
    const rightKey = [
      right.sourceId,
      right.targetId,
      right.description,
      right.technology,
      right.sourceFilename,
      right.targetSourceFilename,
    ].join('\0')
    return compareStrings(leftKey, rightKey)
  })
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
  const declaredParentIds = new Set<string>()

  for (const document of documents) {
    const element = documentToElement(document)
    validateActorLocation(element, revisionRecord.revision)
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
    if (Object.hasOwn(document.frontmatter, 'parent')) {
      declaredParentIds.add(element.id)
    }
  }

  validateContainment(elements, elementsById, declaredParentIds)
  elements.sort((left, right) => compareStrings(left.id, right.id))

  return deepFreeze({
    revision: canonicalRevision(revisionRecord.revision),
    elements,
    relationships: extractRelationships(documents, elementsBySourceFilename),
  })
}
