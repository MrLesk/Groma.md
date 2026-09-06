import { parseMarkdown, parseFrontmatter } from 'comark'
import { renderFrontmatter } from 'comark/render'

import { GromaFileSystem } from './groma-filesystem.ts'
import { buildArchitectureModel } from './architecture-model.ts'
import { requireText } from './naming.ts'
import { DRAFT_TYPE, c4Type, requireGromaMapping } from './okf-profile.ts'
import type { ArchitectureDocument, C4Kind, CodeReference, ElementStatus } from './types.ts'

/** Save must pass the same semantic validation as the next read before changing the file. */
export async function validateElementSource(documents: ArchitectureDocument[], sourceFilename: string, source: string): Promise<void> {
  const tree = await parseMarkdown(source)
  const document = { sourceFilename, body: parseFrontmatter(source).content, nodes: tree.nodes, frontmatter: tree.frontmatter } as ArchitectureDocument
  buildArchitectureModel([...documents.filter(item => item.sourceFilename !== sourceFilename), document])
}

export interface MeaningChanges {
  title?: string
  overview?: string
  description?: string
  technology?: string
  draft?: string
}

/** Normal edits and structural edits apply authored meaning in the same way. */
export function withMeaning(source: string, input: MeaningChanges): string {
  if (input.title !== undefined) source = withTitle(source, requireText(input.title, '--title'))
  if (input.overview !== undefined) source = replaceLeadProse(source, input.overview)
  source = withDescription(source, input.description)
  if (input.technology !== undefined) source = withGromaField(source, 'technology', input.technology || undefined)
  if (input.draft !== undefined) source = withGromaField(source, 'draft', input.draft || undefined)
  return source
}

function normalizeNewlines(source: string): string {
  return source.replaceAll('\r\n', '\n')
}

function sourceWithFrontmatter(
  frontmatter: Record<string, unknown>,
  content: string,
): string {
  return `---\n${renderFrontmatter(frontmatter)}\n---${content}`
}

function documentParts(source: string): {
  content: string
  data: Record<string, unknown>
  frontmatterText: string
} {
  const normalized = normalizeNewlines(source)
  const parts = parseFrontmatter(normalized)
  if (!normalized.startsWith('---\n') || parts.frontmatterText === '') {
    throw new Error('document requires YAML frontmatter')
  }
  return parts
}

function withGromaChange(
  source: string,
  change: (groma: Record<string, unknown>) => void,
): string {
  const { content, data } = documentParts(source)
  const nextGroma = { ...requireGromaMapping(data, 'document') }
  change(nextGroma)
  return sourceWithFrontmatter({ ...data, groma: nextGroma }, content)
}

export function withGromaCode(source: string, code: CodeReference[]): string {
  return withGromaChange(source, groma => {
    if (code.length === 0) delete groma.code
    else groma.code = code
  })
}

export function withGromaField(
  source: string,
  field: 'group' | 'parent' | 'draft' | 'technology',
  value: string | undefined,
): string {
  return withGromaChange(source, groma => {
    if (value === undefined) delete groma[field]
    else groma[field] = value
  })
}

export function withTitle(source: string, title: string): string {
  const { content, data } = documentParts(source)
  return sourceWithFrontmatter({ ...data, title }, content)
}

export function withStatus(source: string, status: ElementStatus): string {
  const { content, data } = documentParts(source)
  return sourceWithFrontmatter({ ...data, status }, content)
}

export function withDescription(
  source: string,
  description: string | undefined,
): string {
  if (description === undefined) return source
  const { content, data } = documentParts(source)
  const next = { ...data }
  if (description === '') delete next.description
  else next.description = description
  return sourceWithFrontmatter(next, content)
}

const nonProseBlock = '(?: {0,3}(?:#{1,6}[ \\t]|[-+*][ \\t]+'
  + '|\\d+[.)][ \\t]+|>[ \\t]?|```|~~~|\\|[ \\t]|<)| {4}\\S)'

function leadingProseEnd(content: string, start: number): number {
  const body = content.slice(start)
  if (new RegExp(`^${nonProseBlock}`).test(body)) return start
  const boundary = body.search(new RegExp(`\n[ \t]*\n(?=${nonProseBlock})`))
  return boundary === -1 ? content.length : start + boundary
}

export function replaceLeadProse(source: string, prose: string): string {
  const { content, frontmatterText } = documentParts(source)
  const bodyStart = content.search(/\S/)
  const start = bodyStart === -1 ? content.length : bodyStart
  const end = leadingProseEnd(content, start)
  const suffix = content.slice(end).trimStart()
  return `---\n${frontmatterText}\n---\n\n${prose.trim()}`
    + `${suffix === '' ? '\n' : `\n\n${suffix}`}`
}

export function renderArchitectureDocument(input: {
  id: string
  kind: C4Kind
  parent?: string | null
  technology?: string
  draft?: string
  name: string
  description?: string
  overview: string
  status: ElementStatus
  code?: CodeReference[]
}): string {
  const groma: Record<string, unknown> = { id: input.id }
  if (input.kind === 'container' || input.kind === 'component') {
    if (!input.parent) {
      throw new Error(`${input.kind} ${input.id} requires a parent`)
    }
    groma.parent = input.parent
  }
  if (input.technology !== undefined) groma.technology = input.technology
  if (input.draft !== undefined) groma.draft = input.draft
  if ((input.code?.length ?? 0) > 0) groma.code = input.code
  const content = input.overview.trim() === '' ? '\n' : `\n\n${input.overview.trim()}\n`
  return sourceWithFrontmatter({
    type: c4Type(input.kind),
    title: input.name,
    ...(input.description === undefined ? {} : { description: input.description }),
    status: input.status,
    groma,
  }, content)
}

export function renderDraftDocument(input: {
  id: string
  title: string
  outcome: string
}): string {
  return sourceWithFrontmatter({
    type: DRAFT_TYPE,
    title: input.title,
    groma: { id: input.id },
  }, `\n\n${input.outcome.trim()}\n`)
}

export function withRelationship(
  source: string,
  relationship: {
    sourceName: string
    sourceHref: string
    targetName: string
    targetHref: string
    description: string
    technology: string
    status?: ElementStatus
    authored?: boolean
  },
): string {
  source = normalizeNewlines(source)
  const row = `| [${relationship.sourceName}](${relationship.sourceHref}) | [${relationship.targetName}](${relationship.targetHref}) | ${relationship.description} | ${relationship.technology} |`
  const lines = source.trimEnd().split('\n')
  const section = relationshipSection(relationship)
  const heading = lines.indexOf(section)
  if (heading === -1) {
    return `${source.trimEnd()}\n\n${section}\n\n| Source | Target | Description | Technology |\n| --- | --- | --- | --- |\n${row}\n`
  }

  const header = lines.indexOf('| Source | Target | Description | Technology |', heading)
  if (header === -1 || lines[header + 1] !== '| --- | --- | --- | --- |') {
    throw new Error('Relationships section requires the standard table')
  }
  let insert = header + 2
  while (lines[insert]?.startsWith('|')) insert += 1
  lines.splice(insert, 0, row)
  return `${lines.join('\n')}\n`
}

/** Removes the row with this target link, description and technology; the link text may have aged since the target was renamed. */
export function withoutRelationship(
  source: string,
  row: { sourceHref: string; targetHref: string; description: string; technology: string; status?: ElementStatus; authored?: boolean },
): string {
  source = normalizeNewlines(source)
  const lines = source.trimEnd().split('\n')
  const tail = `](${row.targetHref}) | ${row.description} | ${row.technology} |`
  const sectionStart = lines.indexOf(relationshipSection(row))
  let sectionEnd = sectionStart + 1
  while (sectionEnd < lines.length && !lines[sectionEnd]?.startsWith('## ')) sectionEnd++
  const rowIndex = lines.findIndex((line, index) => index > sectionStart && index < sectionEnd
    && line.startsWith('| [') && line.includes(`](${row.sourceHref}) | [` ) && line.endsWith(tail))
  if (rowIndex === -1) throw new Error('relationship row is missing')
  lines.splice(rowIndex, 1)

  const heading = lines.lastIndexOf(relationshipSection(row), rowIndex)
  const header = lines.indexOf('| Source | Target | Description | Technology |', heading)
  const hasRows = lines[header + 2]?.startsWith('|') === true
  if (heading !== -1 && header !== -1 && !hasRows) {
    let end = header + 2
    while (end < lines.length && !lines[end]?.startsWith('## ')) end += 1
    lines.splice(heading, end - heading)
  }
  return `${lines.join('\n').trimEnd()}\n`
}

export async function upsertCode(
  repositoryRoot: string,
  sourceFilename: string,
  code: CodeReference[],
): Promise<void> {
  const filesystem = GromaFileSystem.open(repositoryRoot)
  const source = await filesystem.readSource(sourceFilename)
  await filesystem.writeSource(sourceFilename, withGromaCode(source, code))
}

export async function writeDocument(
  repositoryRoot: string,
  sourceFilename: string,
  source: string,
): Promise<void> {
  await GromaFileSystem.open(repositoryRoot).writeSource(sourceFilename, source)
}

export async function readDocument(
  repositoryRoot: string,
  sourceFilename: string,
): Promise<string> {
  return GromaFileSystem.open(repositoryRoot).readSource(sourceFilename)
}

export async function removeDocument(
  repositoryRoot: string,
  sourceFilename: string,
): Promise<void> {
  await GromaFileSystem.open(repositoryRoot).removeSource(sourceFilename)
}

function relationshipSection(row: { authored?: boolean; status?: ElementStatus }): string {
  if (row.authored === false) return '## Derived relationships'
  return row.status === 'draft' ? '## Draft relationships' : '## Relationships'
}
