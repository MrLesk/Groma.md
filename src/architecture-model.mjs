import path from 'node:path'

const expectedParentKinds = new Map([
  ['container', 'system'],
  ['component', 'container'],
])
const rootKinds = new Set(['person', 'system'])
const supportedKinds = new Set([...rootKinds, ...expectedParentKinds.keys()])

export class ArchitectureModelError extends Error {
  constructor(code, sourceFilename, message) {
    super(`${sourceFilename}: ${message}`)
    this.name = 'ArchitectureModelError'
    this.code = code
    this.sourceFilename = sourceFilename
  }
}

function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }

  Object.freeze(value)
  for (const child of Object.values(value)) {
    deepFreeze(child)
  }

  return value
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function nodeText(node) {
  if (typeof node === 'string') {
    return node
  }
  if (!Array.isArray(node)) {
    return ''
  }

  const children = typeof node[0] === 'string' ? node.slice(2) : node
  return children.map(nodeText).join('')
}

function collectNodes(node, tag, collected = []) {
  if (!Array.isArray(node)) {
    return collected
  }

  const isAstNode = typeof node[0] === 'string'
  if (isAstNode && node[0] === tag) {
    collected.push(node)
  }

  const children = isAstNode ? node.slice(2) : node
  for (const child of children) {
    collectNodes(child, tag, collected)
  }

  return collected
}

function elementNameAndDescription(nodes) {
  const headingIndex = nodes.findIndex(node => node[0] === 'h1')
  const heading = nodes[headingIndex]
  const description = nodes[headingIndex + 1]

  return {
    name: nodeText(heading).trim(),
    description: description?.[0] === 'p' ? nodeText(description).trim() : '',
  }
}

function relationshipRows(nodes) {
  const rows = []
  let inRelationshipsSection = false

  for (const node of nodes) {
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

function relationshipTargetFilename(sourceFilename, href) {
  if (typeof href !== 'string') {
    return null
  }

  let decodedHref
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

function documentToElement(document) {
  const { id, kind, parent, external } = document.frontmatter
  const { sourceFilename } = document

  if (typeof id !== 'string' || id.length === 0) {
    throw new ArchitectureModelError(
      'INVALID_ELEMENT',
      sourceFilename,
      'element requires a stable id',
    )
  }
  if (!supportedKinds.has(kind)) {
    throw new ArchitectureModelError(
      'INVALID_ELEMENT',
      sourceFilename,
      `element "${id}" has unsupported kind "${kind}"`,
    )
  }
  if (external === true && kind !== 'system') {
    throw new ArchitectureModelError(
      'INVALID_ELEMENT',
      sourceFilename,
      `only a system can be external, but "${id}" is a ${kind}`,
    )
  }

  const { name, description } = elementNameAndDescription(document.nodes)
  return {
    id,
    kind,
    name,
    description,
    parentId: parent ?? null,
    external: external === true,
    sourceFilename,
  }
}

function validateContainment(elements, elementsById, declaredParentIds) {
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
        + `but "${element.parentId}" is a ${parent.kind}`,
      )
    }
  }
}

function extractRelationships(documents, elementsBySourceFilename) {
  const relationships = []

  for (const document of documents) {
    for (const row of relationshipRows(document.nodes)) {
      const cells = row.slice(2).filter(child => child[0] === 'td')
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
        sourceId: document.frontmatter.id,
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

function canonicalRevision(revision) {
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

export function buildArchitectureModel(revisionRecord) {
  const documents = [...revisionRecord.documents]
    .sort((left, right) => compareStrings(left.sourceFilename, right.sourceFilename))
  const elements = []
  const elementsById = new Map()
  const elementsBySourceFilename = new Map()
  const declaredParentIds = new Set()

  for (const document of documents) {
    const element = documentToElement(document)
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
