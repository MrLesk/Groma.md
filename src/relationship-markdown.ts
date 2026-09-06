import {
  collectNodes,
  nodeText,
  relationshipTargetFilename,
  tableHeaderNames,
} from './architecture-markdown.ts'
import { fileOwners } from './source-relationships.ts'
import { RELATIONSHIPS_TYPE } from './okf-profile.ts'
import type {
  ArchitectureDocument,
  ArchitectureElement,
  ElementStatus,
  MarkdownElement,
  MarkdownNode,
  RelationshipConnection,
} from './types.ts'

const columns = ['Source', 'Target', 'Description', 'Technology']
type Invalid = (code: string, filename: string, message: string) => never


function endpoint(
  cell: MarkdownElement | undefined,
  filename: string,
  byDocument: ReadonlyMap<string, ArchitectureElement>,
  owners: ReadonlyMap<string, ArchitectureElement>,
  invalid: Invalid,
): { value: string; element: ArchitectureElement; file: boolean } {
  const links = collectNodes(cell, 'a')
  if (links.length !== 1) invalid('INVALID_RELATIONSHIP', filename, 'each endpoint must contain exactly one Markdown link')
  const resolved = relationshipTargetFilename(filename, links[0]?.[1]?.href)
  const concept = resolved === null ? undefined : byDocument.get(resolved)
  if (concept) return { value: concept.id, element: concept, file: false }
  const owner = resolved === null ? undefined : owners.get(resolved)
  if (!owner || resolved === null) invalid('UNKNOWN_RELATIONSHIP_TARGET', filename, `endpoint "${resolved}" has no file owner or concept`)
  return { value: resolved!, element: owner!, file: true }
}

function readRow(
  row: MarkdownElement,
  filename: string,
  status: ElementStatus,
  authored: boolean,
  byDocument: ReadonlyMap<string, ArchitectureElement>,
  owners: ReadonlyMap<string, ArchitectureElement>,
  invalid: Invalid,
): RelationshipConnection {
  const cells = (row.slice(2) as MarkdownNode[]).filter((node): node is MarkdownElement => Array.isArray(node) && node[0] === 'td')
  if (cells.length !== 4) invalid('INVALID_RELATIONSHIP', filename, 'relationship row must contain four cells')
  const source = endpoint(cells[0], filename, byDocument, owners, invalid)
  const target = endpoint(cells[1], filename, byDocument, owners, invalid)
  const declaredConcept = [source, target].some(end => end.element.kind === 'actor' || end.element.external)
  if (!declaredConcept && (!source.file || !target.file)) {
    invalid('INVALID_RELATIONSHIP', filename, 'code relationships require source-file endpoints')
  }
  const description = nodeText(cells[2]).trim()
  const technology = nodeText(cells[3]).trim()
  if (!description || !technology) invalid('INVALID_RELATIONSHIP', filename, 'description and technology must not be empty')
  return { source: source.value, target: target.value, description, technology, status, authored }
}

function sectionStatus(id: unknown): ElementStatus | undefined {
  if (id === 'relationships' || id === 'derived-relationships') return 'stable'
  if (id === 'draft-relationships') return 'draft'
  return undefined
}

function rows(document: ArchitectureDocument, invalid: Invalid): { row: MarkdownElement; status: ElementStatus; authored: boolean }[] {
  let status: ElementStatus | undefined
  let authored = true
  const result: { row: MarkdownElement; status: ElementStatus; authored: boolean }[] = []
  for (const node of document.nodes) {
    if (!Array.isArray(node)) continue
    if (node[0] === 'h2') {
      status = sectionStatus(node[1]?.id)
      authored = node[1]?.id !== 'derived-relationships'
    }
    if (node[0] !== 'table' || status === undefined) continue
    if (tableHeaderNames(node).join('|') !== columns.join('|')) {
      invalid('INVALID_RELATIONSHIP', document.sourceFilename, `relationship table must use columns "${columns.join(' | ')}"`)
    }
    result.push(...collectNodes(node, 'tbody').flatMap(body => collectNodes(body, 'tr'))
      .map(row => ({ row, status: status!, authored })))
  }
  return result
}

/** The section records whether core or an author owns a linked interaction. */
export function storedConnections(
  documents: readonly ArchitectureDocument[],
  elements: readonly ArchitectureElement[],
  invalid: Invalid,
): RelationshipConnection[] {
  const byDocument = new Map(elements.map(element => [element.sourceFilename, element]))
  const owners = fileOwners(elements)
  const result: RelationshipConnection[] = []
  const pairs = new Set<string>()
  for (const document of documents) {
    for (const { row, status, authored } of connectionRows(document, invalid)) {
      const connection = readRow(row, document.sourceFilename, status, authored, byDocument, owners, invalid)
      const pair = `${connection.authored}\0${connection.source}\0${connection.target}`
      if (pairs.has(pair)) invalid('INVALID_RELATIONSHIP', document.sourceFilename, `each ordered endpoint pair has one ${connection.authored ? 'authored' : 'derived'} row`)
      pairs.add(pair)
      result.push(connection)
    }
  }
  return result
}

function connectionRows(document: ArchitectureDocument, invalid: Invalid): ReturnType<typeof rows> {
  const result = rows(document, invalid)
  if (document.frontmatter.type !== RELATIONSHIPS_TYPE) {
    if (result.length) invalid('INVALID_RELATIONSHIP', document.sourceFilename, 'relationships belong in relationships.md')
    return []
  }
  if (document.sourceFilename.split('/').slice(1).join('/') !== 'relationships.md') {
    invalid('INVALID_RELATIONSHIP', document.sourceFilename, 'relationship record must be stored at the bundle root as relationships.md')
  }
  return result
}
