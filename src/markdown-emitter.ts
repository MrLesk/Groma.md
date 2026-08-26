import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { C4Kind, CodeReference } from './types.ts'

function renderCodeLines(code: CodeReference[]): string[] {
  if (code.length === 0) return []
  const lines = ['code:']
  for (const reference of code) {
    lines.push(`  - scanner: ${reference.scanner}`)
    lines.push(`    file: ${reference.file}`)
    if (reference.symbol !== undefined) {
      lines.push(`    symbol: ${reference.symbol}`)
    }
    if (reference.dependencies !== undefined) {
      lines.push(`    dependencies: ${reference.dependencies}`)
    }
    if (reference.dependents !== undefined) {
      lines.push(`    dependents: ${reference.dependents}`)
    }
  }
  return lines
}

function withCodeFrontmatter(
  source: string,
  code: CodeReference[],
): string {
  if (!source.startsWith('---\n')) {
    throw new Error('document requires YAML frontmatter')
  }
  const close = source.indexOf('\n---\n', 4)
  if (close === -1) {
    throw new Error('document requires YAML frontmatter')
  }

  const kept: string[] = []
  let skippingCode = false
  for (const line of source.slice(4, close).split('\n')) {
    if (line === 'code:' || line.startsWith('code:')) {
      skippingCode = true
      continue
    }
    if (skippingCode && (/^[ \t]/.test(line) || line === '')) {
      continue
    }
    skippingCode = false
    if (line !== '') kept.push(line)
  }

  const header = [...kept, ...renderCodeLines(code)].join('\n')
  return `---\n${header}\n---\n${source.slice(close + 5)}`
}

export function omitCode(source: string): string {
  return withCodeFrontmatter(source, [])
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

export function replaceLeadProse(source: string, prose: string): string {
  const next = replaceHeadingBody(source, /^# .+$/m, prose)
  if (next === undefined) throw new Error('document requires a heading')
  return next
}

export function setOutcomeSection(source: string, prose: string): string {
  const replaced = replaceHeadingBody(source, /^## Outcome$/m, prose)
  if (replaced !== undefined) return replaced
  const inserted = replaceHeadingBody(source, /^# .+$/m, `## Outcome\n\n${prose}`)
  if (inserted === undefined) throw new Error('document requires a heading')
  return inserted
}

export function renderObservedDocument(input: {
  id: string
  kind: C4Kind
  parent?: string | null
  name: string
  responsibility: string
  code?: CodeReference[]
}): string {
  const lines = ['---', `id: ${input.id}`, `kind: ${input.kind}`]
  if (input.kind === 'container' || input.kind === 'component') {
    if (!input.parent) {
      throw new Error(`${input.kind} ${input.id} requires a parent`)
    }
    lines.push(`parent: ${input.parent}`)
  }
  lines.push(...renderCodeLines(input.code ?? []))
  lines.push('---', '', `# ${input.name}`, '', input.responsibility, '')
  return lines.join('\n')
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
): Promise<void> {
  const filename = absoluteFilename(repositoryRoot, sourceFilename)
  const source = await readFile(filename, 'utf8')
  await writeFile(filename, withCodeFrontmatter(source, code))
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
