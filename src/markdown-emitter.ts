import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { parseFrontmatter } from 'comark'
import { renderFrontmatter } from 'comark/render'

import { c4Type, requireGromaMapping } from './okf-profile.ts'
import type { C4Kind, CodeReference } from './types.ts'

export type RepresentationStatus = 'draft' | 'stable'

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
  const parts = parseFrontmatter(source)
  if (!source.startsWith('---\n') || parts.frontmatterText === '') {
    throw new Error('document requires YAML frontmatter')
  }
  return parts
}

function withGromaChange(
  source: string,
  change: (groma: Record<string, unknown>) => void,
  status?: RepresentationStatus,
): string {
  const { content, data } = documentParts(source)
  const nextGroma = { ...requireGromaMapping(data, 'document') }
  change(nextGroma)
  return sourceWithFrontmatter({
    ...data,
    ...(status === undefined ? {} : { status }),
    groma: nextGroma,
  }, content)
}

export function withGromaCode(
  source: string,
  code: CodeReference[],
  status?: RepresentationStatus,
): string {
  return withGromaChange(source, groma => {
    if (code.length === 0) delete groma.code
    else groma.code = code
  }, status)
}

export function withGromaField(
  source: string,
  field: 'group' | 'parent',
  value: string | undefined,
  status?: RepresentationStatus,
): string {
  return withGromaChange(source, groma => {
    if (value === undefined) delete groma[field]
    else groma[field] = value
  }, status)
}

export function withRepresentationStatus(
  source: string,
  status: RepresentationStatus,
): string {
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

export function omitCode(source: string): string {
  return withGromaCode(source, [])
}

function afterHeading(source: string, heading: RegExp) {
  const match = source.match(heading)
  if (match === null || match.index === undefined) return undefined
  const rest = source.slice(match.index + match[0].length)
  const next = rest.search(/\n#{1,6} /)
  return {
    prefix: source.slice(0, match.index + match[0].length),
    suffix: next === -1 ? '' : rest.slice(next),
  }
}

function replaceHeadingBody(
  source: string,
  heading: RegExp,
  body: string,
): string | undefined {
  const range = afterHeading(source, heading)
  if (range === undefined) return undefined
  const next = body.trim()
  return `${range.prefix}\n\n${next}${range.suffix === '' ? '\n' : `\n${range.suffix}`}`
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

export function setOutcomeSection(source: string, prose: string): string {
  const replaced = replaceHeadingBody(source, /^## Outcome$/m, prose)
  if (replaced !== undefined) return replaced
  const inserted = replaceHeadingBody(source, /^# .+$/m, `## Outcome\n\n${prose}`)
  if (inserted === undefined) throw new Error('document requires a heading')
  return inserted
}

export function renderArchitectureDocument(input: {
  id: string
  kind: C4Kind
  parent?: string | null
  external?: boolean
  technology?: string
  name: string
  description?: string
  overview: string
  status: RepresentationStatus
  code?: CodeReference[]
}): string {
  const groma: Record<string, unknown> = { id: input.id }
  if (input.kind === 'container' || input.kind === 'component') {
    if (!input.parent) {
      throw new Error(`${input.kind} ${input.id} requires a parent`)
    }
    groma.parent = input.parent
  }
  if (input.external === true) groma.external = true
  if (input.technology !== undefined) groma.technology = input.technology
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

export function withRelationship(
  source: string,
  relationship: {
    targetName: string
    targetHref: string
    description: string
    technology: string
  },
): string {
  const row = `| [${relationship.targetName}](${relationship.targetHref}) | ${relationship.description} | ${relationship.technology} |`
  if (source.includes(row)) throw new Error('relationship already exists')
  const lines = source.trimEnd().split('\n')
  const heading = lines.indexOf('## Relationships')
  if (heading === -1) {
    return `${source.trimEnd()}\n\n## Relationships\n\n| Target | Description | Technology |\n| --- | --- | --- |\n${row}\n`
  }

  const header = lines.indexOf('| Target | Description | Technology |', heading)
  if (header === -1 || lines[header + 1] !== '| --- | --- | --- |') {
    throw new Error('Relationships section requires the standard table')
  }
  let insert = header + 2
  while (lines[insert]?.startsWith('|')) insert += 1
  lines.splice(insert, 0, row)
  return `${lines.join('\n')}\n`
}

export function withoutRelationship(source: string, row: string): string {
  const lines = source.trimEnd().split('\n')
  const rowIndex = lines.indexOf(row)
  if (rowIndex === -1) throw new Error('relationship row is missing')
  lines.splice(rowIndex, 1)

  const heading = lines.lastIndexOf('## Relationships', rowIndex)
  const header = lines.indexOf('| Target | Description | Technology |', heading)
  const hasRows = lines[header + 2]?.startsWith('|') === true
  if (heading !== -1 && header !== -1 && !hasRows) {
    let end = header + 2
    while (end < lines.length && !lines[end]?.startsWith('## ')) end += 1
    lines.splice(heading, end - heading)
  }
  return `${lines.join('\n').trimEnd()}\n`
}

function absoluteFilename(
  repositoryRoot: string,
  sourceFilename: string,
): string {
  return path.join(repositoryRoot, ...sourceFilename.split('/'))
}

export async function upsertCode(
  repositoryRoot: string,
  sourceFilename: string,
  code: CodeReference[],
  status: RepresentationStatus,
): Promise<void> {
  const filename = absoluteFilename(repositoryRoot, sourceFilename)
  const source = await readFile(filename, 'utf8')
  await writeFile(filename, withGromaCode(source, code, status))
}

export async function writeObservedDocument(
  repositoryRoot: string,
  sourceFilename: string,
  source: string,
): Promise<void> {
  const filename = absoluteFilename(repositoryRoot, sourceFilename)
  await mkdir(path.dirname(filename), { recursive: true })
  await writeFile(filename, source)
}

export async function readDocument(
  repositoryRoot: string,
  sourceFilename: string,
): Promise<string> {
  return readFile(absoluteFilename(repositoryRoot, sourceFilename), 'utf8')
}

export async function removeDocument(
  repositoryRoot: string,
  sourceFilename: string,
): Promise<void> {
  await unlink(absoluteFilename(repositoryRoot, sourceFilename))
}
