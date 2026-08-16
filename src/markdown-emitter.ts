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
