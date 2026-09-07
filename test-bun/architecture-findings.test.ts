import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { createScanObservation, type ScanOperation } from '@groma/scanner'

import { scanTypeScriptSource } from '../plugins/scanners/typescript/src/scan.ts'
import {
  copiesOf,
  detectDuplicatedLogic,
  findingsForOwner,
  formatArchitectureFindings,
  rememberArchitectureFindings,
} from '../src/architecture-findings.ts'
import { loadAnnotatedArchitecture } from '../src/core.ts'
import { scanRepository } from '../src/scanner.ts'
import { inspectDetails } from '../src/viewers/web/organisms/details.ts'
import type { ArchitectureFinding } from '../src/types.ts'

const fixture = path.resolve(import.meta.dir, '../test/fixtures/duplicated-logic')

const readyTokens = [
  'return', '$0', '.status', '===', '"todo"', '&&', '$0', '.dependencies', '.every', 'call',
  'fn', '$1', '.status', '===', '"done"',
]

function operation(
  file: string,
  name: string,
  tokens: string[],
  line = 1,
): ScanOperation {
  return { id: `${file}#${name}`, file, name, startLine: line, endLine: line + 3, tokens }
}

function observation(operations: ScanOperation[]) {
  const files = [...new Set(operations.map(item => item.file))]
  return createScanObservation({
    scanner: { language: 'typescript', engine: 'test', engineVersion: '1' },
    root: { kind: 'package', name: 'Shop', file: 'package.json' },
    scopes: [{ id: 'scope:src/a.ts', name: 'A' }],
    files: files.map(file => ({ file, symbols: [] })),
    placements: files.map(file => ({ file, scope: 'scope:src/a.ts' })),
    relationships: [],
    operations,
    invocations: [],
    diagnostics: [],
  })
}

async function gitInit(root: string): Promise<void> {
  const process = Bun.spawn(['git', 'init', '--quiet'], { cwd: root, stdout: 'ignore', stderr: 'pipe' })
  expect(await process.exited, await new Response(process.stderr).text()).toBe(0)
}

async function scannedFixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-findings-'))
  await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
  await mkdir(path.join(root, 'src'))
  await cp(fixture, path.join(root, 'src'), { recursive: true })
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', bin: 'src/ready-a.ts' }))
  await gitInit(root)
  return root
}

function namesOf(finding: ArchitectureFinding): string[] {
  return finding.instances.map(instance => instance.name).sort()
}

test.concurrent('renamed copies match exactly and keep owner identity', () => {
  const findings = detectDuplicatedLogic([observation([
    operation('src/a.ts', 'canStart', readyTokens),
    operation('src/b.ts', 'readyToRun', readyTokens),
  ])], new Map([['src/a.ts', 'ready-a'], ['src/b.ts', 'ready-b']]))
  expect(findings).toHaveLength(1)
  expect(findings[0]!.match).toBe('exact')
  expect(findings[0]!.differences).toEqual([])
  expect(namesOf(findings[0]!)).toEqual(['canStart', 'readyToRun'])
  expect(findings[0]!.instances.map(instance => instance.owner).sort()).toEqual(['ready-a', 'ready-b'])
  expect(findingsForOwner(findings, 'ready-a')).toEqual(findings)
  expect(findingsForOwner(findings, 'other')).toEqual([])
  const copies = copiesOf(findings, 'src/a.ts', 'canStart', 1)
  expect(copies?.similar).toBe(false)
  expect(copies?.copies.map(instance => instance.name)).toEqual(['readyToRun'])
  expect(copiesOf(findings, 'src/t.ts', 'total', 1)).toBeUndefined()
  expect(formatArchitectureFindings(findings).join('\n')).toContain('possible duplicates:')
  expect(formatArchitectureFindings(findings).join('\n')).not.toContain('not identical')
})

test.concurrent('a missing predicate is a similar finding with a concrete difference', () => {
  const shorter = readyTokens.filter(token => token !== '"todo"')
  const findings = detectDuplicatedLogic([observation([
    operation('src/a.ts', 'canStart', readyTokens),
    operation('src/c.ts', 'readyWithoutStatus', shorter),
  ])], new Map([['src/a.ts', 'ready-a'], ['src/c.ts', 'ready-c']]))
  expect(findings).toHaveLength(1)
  expect(findings[0]!.match).toBe('similar')
  expect(findings[0]!.differences.join(' ')).toContain('"todo"')
  expect(formatArchitectureFindings(findings).join('\n')).toContain('not identical')
  expect(formatArchitectureFindings(findings).join('\n')).not.toContain('"todo"')
})

test.concurrent('unrelated computation is not clustered with readiness', () => {
  const findings = detectDuplicatedLogic([observation([
    operation('src/a.ts', 'canStart', readyTokens),
    operation('src/t.ts', 'total', ['return', '$0', '.reduce', 'call', 'fn', '$1', '$2', '+', '$2', '0']),
  ])], new Map([['src/a.ts', 'ready-a'], ['src/t.ts', 'total']]))
  expect(findings.some(finding => namesOf(finding).includes('canStart') && namesOf(finding).includes('total'))).toBeFalse()
})

test.concurrent('similar independent rules still become a review finding', () => {
  const publish = [
    'return', '$0', '.status', '===', '"draft"', '&&', '$0', '.reviewers', '.every', 'call',
    'fn', '$1', '.approved',
  ]
  const findings = detectDuplicatedLogic([observation([
    operation('src/a.ts', 'canStart', readyTokens),
    operation('src/p.ts', 'canPublish', publish),
  ])], new Map([['src/a.ts', 'ready-a'], ['src/p.ts', 'publish']]))
  expect(findings).toHaveLength(1)
  expect(findings[0]!.match).toBe('similar')
  expect(findings[0]!.differences.join(' ')).toMatch(/draft|reviewers|approved|todo|dependencies/)
})

test.concurrent('TypeScript operations match after renaming locals and keep literals', async () => {
  const root = await scannedFixture()
  try {
    const scanned = (await scanTypeScriptSource(root))!
    const byName = new Map((scanned.operations ?? []).map(operation => [operation.name, operation]))
    expect(byName.get('canStart')?.tokens).toEqual(byName.get('readyToRun')?.tokens)
    expect(byName.get('canStart')?.tokens?.join(' ')).toContain('"todo"')
    expect(byName.get('canStart')?.tokens).not.toEqual(byName.get('readyWithoutStatus')?.tokens)
    expect(byName.get('canStart')?.startLine).toBeGreaterThan(0)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('scan remembers findings for owners without writing relationships', async () => {
  const root = await scannedFixture()
  try {
    const summary = await scanRepository(root)
    expect(summary.findings).toBeGreaterThan(0)
    const world = await loadAnnotatedArchitecture(root)
    expect(world.findings?.length).toBe(summary.findings)
    expect(world.relationships).toEqual([])
    const owner = world.elements.find(element => element.code.some(reference => reference.file.endsWith('ready-a.ts')))
    expect(owner).toBeDefined()
    const inspected = inspectDetails(owner!, world)
    expect(inspected.findings.length).toBeGreaterThan(0)
    expect(inspected.findings.some(finding => finding.instances.some(instance => instance.file.endsWith('ready-b.ts')))).toBeTrue()
    const relationships = await readFile(path.join(root, 'groma/relationships.md'), 'utf8').catch(() => '')
    expect(relationships).not.toContain('duplicated-logic')
  } finally {
    rememberArchitectureFindings(root, [])
    await rm(root, { recursive: true, force: true })
  }
})
