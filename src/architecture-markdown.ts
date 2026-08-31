import path from 'node:path'

import type {
  ArchitectureDocument,
  ArchitectureElement,
  ArchitectureRelationship,
  MarkdownElement,
  MarkdownNode,
} from './types.ts'

type InvalidMarkdown = (code: string, sourceFilename: string, message: string) => never
const relationshipColumns = ['Target', 'Description', 'Technology']

function nodeText(node: MarkdownNode | undefined): string {
  if (typeof node === 'string') return node
  if (!Array.isArray(node)) return ''
  return (node.slice(2) as MarkdownNode[]).map(nodeText).join('')
}

function collectNodes(
  node: MarkdownNode | MarkdownNode[] | undefined,
  tag: string,
  collected: MarkdownElement[] = [],
): MarkdownElement[] {
  if (!Array.isArray(node)) return collected
  const values = node as unknown[]
  const isAstNode = typeof values[0] === 'string'
  if (isAstNode && node[0] === tag) collected.push(node as MarkdownElement)
  const children = (isAstNode ? values.slice(2) : values) as MarkdownNode[]
  for (const child of children) collectNodes(child, tag, collected)
  return collected
}

export function elementOverview(
  document: ArchitectureDocument,
  invalid: InvalidMarkdown,
): string {
  if (collectNodes(document.nodes, 'h1').length > 0) {
    invalid(
      'INVALID_ELEMENT',
      document.sourceFilename,
      'body must not duplicate title with a level-one heading',
    )
  }
  const paragraphs: string[] = []
  for (const node of document.nodes) {
    if (!Array.isArray(node) || node[0] !== 'p') break
    const paragraph = nodeText(node).trim()
    if (paragraph.length === 0) break
    paragraphs.push(paragraph)
  }
  const overview = paragraphs.join('\n\n')
  return overview
}

function tableHeaderNames(table: MarkdownElement): string[] {
  const headerRow = collectNodes(table, 'tr')[0]
  const cells = headerRow?.slice(2).filter(child => {
    return Array.isArray(child) && child[0] === 'th'
  }) as MarkdownElement[] | undefined
  return (cells ?? []).map(cell => nodeText(cell).trim())
}

function canonicalRelationshipTable(table: MarkdownElement): boolean {
  const header = tableHeaderNames(table)
  return relationshipColumns.every((column, index) => header[index] === column)
    && header.length === relationshipColumns.length
}

function rowsFromTable(
  table: MarkdownElement,
  inRelationshipsSection: boolean,
  sourceFilename: string,
  invalid: InvalidMarkdown,
): MarkdownElement[] {
  const canonical = canonicalRelationshipTable(table)
  if (!inRelationshipsSection && canonical) {
    invalid(
      'INVALID_RELATIONSHIP',
      sourceFilename,
      'relationship table must be under "## Relationships"',
    )
  }
  if (!inRelationshipsSection) return []
  if (!canonical) {
    invalid(
      'INVALID_RELATIONSHIP',
      sourceFilename,
      `relationship table must use columns "${relationshipColumns.join(' | ')}"`,
    )
  }
  return collectNodes(table, 'tbody').flatMap(body => collectNodes(body, 'tr'))
}

function relationshipRows(
  document: ArchitectureDocument,
  invalid: InvalidMarkdown,
): MarkdownElement[] {
  const rows: MarkdownElement[] = []
  let inRelationshipsSection = false
  for (const node of document.nodes) {
    if (!Array.isArray(node)) continue
    if (node[0] === 'h2') {
      inRelationshipsSection = node[1]?.id === 'relationships'
    } else if (node[0] === 'table') {
      rows.push(...rowsFromTable(node, inRelationshipsSection, document.sourceFilename, invalid))
    }
  }
  return rows
}

function relationshipTargetFilename(sourceFilename: string, href: unknown): string | null {
  if (typeof href !== 'string') return null
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
  ) return null
  return path.posix.normalize(path.posix.join(path.posix.dirname(sourceFilename), decodedHref))
}

function relationshipOf(
  document: ArchitectureDocument,
  row: MarkdownElement,
  elementsBySourceFilename: ReadonlyMap<string, ArchitectureElement>,
  invalid: InvalidMarkdown,
): ArchitectureRelationship {
  const cells = (row.slice(2) as MarkdownNode[]).filter((child): child is MarkdownElement => {
    return Array.isArray(child) && child[0] === 'td'
  })
  if (cells.length !== relationshipColumns.length) {
    invalid('INVALID_RELATIONSHIP', document.sourceFilename, 'relationship row must contain exactly three cells')
  }
  const links = collectNodes(cells[0], 'a')
  if (links.length !== 1) {
    invalid('INVALID_RELATIONSHIP', document.sourceFilename, 'relationship target must contain exactly one link')
  }
  const href = links[0]?.[1]?.href
  const targetSourceFilename = relationshipTargetFilename(document.sourceFilename, href)
  const target = targetSourceFilename === null
    ? undefined
    : elementsBySourceFilename.get(targetSourceFilename)
  if (!target) {
    const displayedTarget = targetSourceFilename ?? String(href ?? '(missing link)')
    invalid(
      'UNKNOWN_RELATIONSHIP_TARGET',
      document.sourceFilename,
      `relationship target "${displayedTarget}" does not resolve in this revision`,
    )
  }
  const description = nodeText(cells[1]).trim()
  const technology = nodeText(cells[2]).trim()
  if (description.length === 0 || technology.length === 0) {
    invalid(
      'INVALID_RELATIONSHIP',
      document.sourceFilename,
      'relationship description and technology must not be empty',
    )
  }
  return {
    sourceId: elementsBySourceFilename.get(document.sourceFilename)!.id,
    targetId: target!.id,
    description,
    technology,
    sourceFilename: document.sourceFilename,
    targetSourceFilename: target!.sourceFilename,
  }
}

function relationshipKey(relationship: ArchitectureRelationship): string {
  return [
    relationship.sourceId,
    relationship.targetId,
    relationship.description,
    relationship.technology,
    relationship.sourceFilename,
    relationship.targetSourceFilename,
  ].join('\0')
}

export function extractRelationships(
  documents: ArchitectureDocument[],
  elementsBySourceFilename: ReadonlyMap<string, ArchitectureElement>,
  invalid: InvalidMarkdown,
): ArchitectureRelationship[] {
  const relationships = documents.flatMap(document => {
    return relationshipRows(document, invalid).map(row => {
      return relationshipOf(document, row, elementsBySourceFilename, invalid)
    })
  })
  return relationships.sort((left, right) => {
    const leftKey = relationshipKey(left)
    const rightKey = relationshipKey(right)
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0
  })
}
