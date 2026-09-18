import path from 'node:path'

import { relationshipTargetFilename } from './architecture-markdown.ts'
import { freeId } from './architecture-model.ts'
import { architectureElementPath } from './architecture-path.ts'
import { readDocument, withGromaField } from './markdown-emitter.ts'
import { RELATIONSHIPS_TYPE } from './okf-profile.ts'
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
): string {
  const from = path.posix.dirname(sourceFilename)
  const moved = (href: string): string | undefined => {
    const resolved = relationshipTargetFilename(sourceFilename, href)
    const destination = resolved === null ? undefined : moves.get(resolved)
    return destination === undefined ? undefined : path.posix.relative(from, destination)
  }
  return source
    .replace(inlineLink, (match, href: string, title: string) => {
      const next = moved(href)
      return next === undefined ? match : `](${next}${title})`
    })
    .replace(linkDefinition, (match, label: string, href: string) => {
      const next = moved(href)
      return next === undefined ? match : `${label}${next}`
    })
}

/** The relationship record and the flows name element documents by link, so their links follow a rename. */
export async function linkWrites(
  context: CurationContext,
  rewrites: readonly DocumentWrite[],
): Promise<DocumentWrite[]> {
  const moves = new Map(rewrites
    .filter(rewrite => rewrite.destinationFilename !== rewrite.sourceFilename)
    .map(rewrite => [rewrite.sourceFilename, rewrite.destinationFilename]))
  const linked = [
    ...context.records.documents.filter(document => document.frontmatter.type === RELATIONSHIPS_TYPE),
    ...context.records.flows,
  ]
  const writes: DocumentWrite[] = []
  for (const document of linked) {
    const stored = await readDocument(context.repositoryRoot, document.sourceFilename)
    const source = withMovedLinks(stored, document.sourceFilename, moves)
    if (source === stored) continue
    writes.push({ sourceFilename: document.sourceFilename, destinationFilename: document.sourceFilename, source })
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
