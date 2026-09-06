import path from 'node:path'

import type {
  ArchitectureDocument,
  MarkdownElement,
  MarkdownNode,
} from './types.ts'

type InvalidMarkdown = (code: string, sourceFilename: string, message: string) => never

export function nodeText(node: MarkdownNode | undefined): string {
  if (typeof node === 'string') return node
  if (!Array.isArray(node)) return ''
  return (node.slice(2) as MarkdownNode[]).map(nodeText).join('')
}

export function collectNodes(
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

export function tableHeaderNames(table: MarkdownElement): string[] {
  const headerRow = collectNodes(table, 'tr')[0]
  const cells = headerRow?.slice(2).filter(child => {
    return Array.isArray(child) && child[0] === 'th'
  }) as MarkdownElement[] | undefined
  return (cells ?? []).map(cell => nodeText(cell).trim())
}

export function relationshipTargetFilename(sourceFilename: string, href: unknown): string | null {
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
