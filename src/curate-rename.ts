import path from 'node:path'
import { parseFrontmatter } from 'comark'

import { relationshipTargetFilename } from './architecture-markdown.ts'
import { freeId } from './architecture-model.ts'
import { architectureElementPath } from './architecture-path.ts'
import { readDocument, withGromaField } from './markdown-emitter.ts'
import { requireElement } from './curate-rewrites.ts'
import type { CurationContext, DocumentWrite } from './curate-rewrites.ts'
import type { ArchitectureElement } from './types.ts'

/**
 * The common link forms of a Markdown document: an inline target, optionally titled, and a reference
 * definition, indented by up to three spaces and with its target on the same or the next line. Other
 * forms the reader accepts, such as a definition in a block quote or list item or an angle-bracketed
 * target with spaces, are not rewritten; requireLoadableResult in curate.ts then refuses the rename.
 */
const inlineLink = /\]\(\s*<?([^()\s<>]+)>?((?:\s+(?:"[^"]*"|'[^']*'|\([^()]*\)))?)\s*\)/g
const linkDefinition = /^( {0,3}\[(?:\\.|[^\\\]])+\]:[ \t]*(?:\r?\n[ \t]*)?)<?([^\s<>]+)>?/gm
const codeLiteral = /^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[ \t]*(?:\n|$)|(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\2(?!`)/gm

/** Link-shaped text in metadata or code examples is authored content, not a link destination. */
function rewriteProse(source: string, rewrite: (prose: string) => string): string {
  const { content } = parseFrontmatter(source)
  const parts = [source.slice(0, source.length - content.length)]
  let start = 0
  for (const literal of content.matchAll(codeLiteral)) {
    parts.push(rewrite(content.slice(start, literal.index)), literal[0])
    start = literal.index + literal[0].length
  }
  parts.push(rewrite(content.slice(start)))
  return parts.join('')
}

export interface RenamedTarget {
  id: string
  source: string
  destination: string
}

/**
 * Repoints every link that resolves to a moved document, whatever spelling it uses, so the loader
 * resolves the same endpoints afterwards.
 */
function withMovedLinks(
  source: string,
  sourceFilename: string,
  moves: ReadonlyMap<string, string>,
  destinationFilename = sourceFilename,
): string {
  const from = path.posix.dirname(destinationFilename)
  const moved = (href: string): string | undefined => {
    const resolved = relationshipTargetFilename(sourceFilename, href)
    if (resolved === null) return undefined
    const destination = moves.get(resolved) ?? (sourceFilename !== destinationFilename ? resolved : undefined)
    const fragment = href.includes('#') ? href.slice(href.indexOf('#')) : ''
    if (destination === undefined) return undefined
    const relative = path.posix.relative(from, destination).split('/').map(encodeURIComponent).join('/')
      .replaceAll('(', '%28').replaceAll(')', '%29')
    return `${relative}${fragment}`
  }
  return rewriteProse(source, prose => prose
    .replace(inlineLink, (match, href: string, title: string) => {
      const next = moved(href)
      return next === undefined ? match : `](${next}${title})`
    })
    .replace(linkDefinition, (match, label: string, href: string) => {
      const next = moved(href)
      return next === undefined ? match : `${label}${next}`
    }))
}

/** Rebase outgoing links and repoint incoming links, preserving the same Markdown destinations. */
export async function linkWrites(
  context: CurationContext,
  rewrites: readonly DocumentWrite[],
): Promise<DocumentWrite[]> {
  const moves = new Map(rewrites
    .filter(rewrite => rewrite.destinationFilename !== rewrite.sourceFilename)
    .map(rewrite => [rewrite.sourceFilename, rewrite.destinationFilename]))
  const linked = [...context.records.documents, ...context.records.flows, ...context.records.drafts]
    .map(document => document.sourceFilename)
  linked.push(context.filesystem.sourceFilename('project.md'))
  const written = new Set(rewrites.map(rewrite => rewrite.sourceFilename))
  const writes: DocumentWrite[] = rewrites.map(rewrite => ({ ...rewrite,
    source: withMovedLinks(rewrite.source, rewrite.sourceFilename, moves, rewrite.destinationFilename) }))
  for (const sourceFilename of linked) {
    if (written.has(sourceFilename)) continue
    const stored = await readDocument(context.repositoryRoot, sourceFilename)
    const source = withMovedLinks(stored, sourceFilename, moves)
    if (source === stored) continue
    writes.push({ sourceFilename, destinationFilename: sourceFilename, source })
  }
  return writes
}

/** A renamed record keeps its meaning, Code and children, and its document moves to the path of the new id. */
export function renamedTarget(
  context: CurationContext,
  target: ArchitectureElement,
  source: string,
  destination: string,
  newId: string | undefined,
): RenamedTarget {
  if (newId === undefined) return { id: target.id, source, destination }
  if (target.kind === 'actor') throw new Error('--id renames systems, containers, and components')
  const id = freeId(context.records, context.model, newId)
  const renamed = architectureElementPath({
    root: context.filesystem.sourceFilename(),
    kind: target.kind,
    id,
    external: target.external,
    ...(target.parentId === null
      ? {}
      : { parentSourceFilename: requireElement(context.byId, target.parentId).sourceFilename }),
  })
  return { id, source: withGromaField(source, 'id', id), destination: renamed }
}
