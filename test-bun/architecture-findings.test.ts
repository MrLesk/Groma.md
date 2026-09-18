import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'

import os from 'node:os'
import path from 'node:path'

import { createScanObservation, type ScanOperation } from '@groma/scanner'

import { addScanner } from '../src/scanner/modules/inventory.ts'
import { scanTypeScriptSource } from '../plugins/scanners/typescript/src/scan.ts'
import { copiesOf, detectDuplicatedLogic, findingsForOwner, rememberArchitectureFindings } from '../src/architecture-findings.ts'

import { loadAnnotatedArchitecture } from '../src/core.ts'
import { scanRepository } from '../src/scanner.ts'
import { inspectDetails } from '../src/viewers/web/organisms/details.ts'
import type { ArchitectureFinding } from '../src/types.ts'

const fixtures = path.resolve(import.meta.dir, '../test/fixtures')

/** Synthetic tokens of one rule, sized above the near-duplicate minimum. */
const ruleTokens = [
  'return', '$0', '.status', '===', '"todo"', '&&', '$0', '.dependencies', '.every', 'call',
  'fn', '$1', '.status', '===', '"done"', '&&', '$0', '.assignee', '!==', 'null',
  '&&', '$0', '.blockers', '.length', '===', '0',
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
    scanner: { technology: 'fixture', id: 'typescript', engine: 'test', engineVersion: '1' },
    roots: [
      { id: 'root', kind: 'package', name: 'Shop', file: 'package.json' },
      { kind: 'project', parent: 'root', id: 'scope:src/a.ts', name: 'A' },
    ],
    files: files.map(file => ({ roots: ['scope:src/a.ts'], file, symbols: [] })),

    operations,
    invocations: [],
    diagnostics: [],
  })
}

async function gitInit(root: string): Promise<void> {
  const process = Bun.spawn(['git', 'init', '--quiet'], { cwd: root, stdout: 'ignore', stderr: 'pipe' })
  expect(await process.exited, await new Response(process.stderr).text()).toBe(0)
}

async function scannedFixture(fixture = 'duplicated-logic', bin = 'src/ready-a.ts'): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-findings-'))
  await cp(path.join(fixtures, 'empty-project'), root, { recursive: true })
  await mkdir(path.join(root, 'src'))
  await cp(path.join(fixtures, fixture), path.join(root, 'src'), { recursive: true })
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', bin }))
  await gitInit(root)
  await addScanner(root, path.resolve(import.meta.dir, '../plugins/scanners/typescript'))
  return root
}

function namesOf(finding: ArchitectureFinding): string[] {
  return finding.instances.map(instance => instance.name).sort()
}

test.concurrent('renamed copies match exactly and keep owner identity', () => {
  const findings = detectDuplicatedLogic([observation([
    operation('src/a.ts', 'canStart', ruleTokens),
    operation('src/b.ts', 'readyToRun', ruleTokens),
  ])], new Map([['src/a.ts', 'ready-a'], ['src/b.ts', 'ready-b']]))
  expect(findings).toHaveLength(1)
  expect(findings[0]!.match).toBe('exact')
  expect(findings[0]!.differences).toEqual([])
  expect(namesOf(findings[0]!)).toEqual(['canStart', 'readyToRun'])
  expect(findings[0]!.instances.map(instance => instance.owner).sort()).toEqual(['ready-a', 'ready-b'])
  expect(findingsForOwner(findings, 'ready-a')).toEqual(findings)
  expect(findingsForOwner(findings, 'other')).toEqual([])
  const copies = copiesOf(findings, 'src/a.ts', 1, 'canStart')
  expect(copies?.similar).toBe(false)
  expect(copies?.copies.map(instance => instance.name)).toEqual(['readyToRun'])
  expect(copiesOf(findings, 'src/t.ts', 1, 'total')).toBeUndefined()
})

test.concurrent('a code row takes the copies of the operation whose range holds its line', () => {
  const findings = detectDuplicatedLogic([observation([
    operation('src/Launch.php', 'Launch\\Schedule::canStart', ruleTokens, 10),
    operation('src/Orders.php', 'Shop\\OrderService::store', ruleTokens, 4),
  ])], new Map<string, string>())
  // A scanner qualifies the name the row shows, so the range joins a row to its operation. The declared
  // name sits on the operation's first line or below it.
  expect(copiesOf(findings, 'src/Launch.php', 11, 'canStart')?.copies.map(instance => instance.name)).toEqual(['Shop\\OrderService::store'])
  expect(copiesOf(findings, 'src/Orders.php', 4, 'store')?.copies.map(instance => instance.name)).toEqual(['Launch\\Schedule::canStart'])
  expect(copiesOf(findings, 'src/Launch.php', 20, 'canStart')).toBeUndefined()
})

test.concurrent('operations starting on one line each take the other as their copy', () => {
  const starting = (name: string, endLine: number): ScanOperation => ({
    id: `src/min.js#${name}`, file: 'src/min.js', name, startLine: 1, endLine, tokens: ruleTokens,
  })
  const copyNames = (findings: ArchitectureFinding[], name: string) => copiesOf(findings, 'src/min.js', 1, name)?.copies.map(instance => instance.name)
  const oneLine = detectDuplicatedLogic([observation([starting('Rules.canStart', 1), starting('Rules.readyToRun', 1)])], new Map<string, string>())
  expect(copyNames(oneLine, 'canStart')).toEqual(['Rules.readyToRun'])
  expect(copyNames(oneLine, 'readyToRun')).toEqual(['Rules.canStart'])
  // A row whose name neither operation ends in cannot tell which one it is.
  expect(copyNames(oneLine, 'Start')).toBeUndefined()
  const longer = detectDuplicatedLogic([observation([starting('Rules.canStart', 1), starting('Rules.readyToRun', 3)])], new Map<string, string>())
  expect(copyNames(longer, 'readyToRun')).toEqual(['Rules.canStart'])
})

test.concurrent('a row that shares a line with a compared operation of another name has no copies', () => {
  const findings = detectDuplicatedLogic([observation([
    { id: 'src/min.js#canStart', file: 'src/min.js', name: 'Rules.canStart', startLine: 1, endLine: 1, tokens: ruleTokens },
    operation('src/ready.js', 'readyToRun', ruleTokens, 5),
  ])], new Map<string, string>())
  expect(copiesOf(findings, 'src/min.js', 1, 'canStart')?.copies.map(instance => instance.name)).toEqual(['readyToRun'])
  expect(copiesOf(findings, 'src/min.js', 1, 'helper')).toBeUndefined()
})

test.concurrent('a missing predicate is a similar finding with a concrete difference', () => {
  const shorter = ruleTokens.filter(token => token !== '"todo"')
  const findings = detectDuplicatedLogic([observation([
    operation('src/a.ts', 'canStart', ruleTokens),
    operation('src/c.ts', 'readyWithoutStatus', shorter),
  ])], new Map([['src/a.ts', 'ready-a'], ['src/c.ts', 'ready-c']]))
  expect(findings).toHaveLength(1)
  expect(findings[0]!.match).toBe('similar')
  expect(findings[0]!.differences.join(' ')).toContain('"todo"')
})

test.concurrent('unrelated computation is not clustered with readiness', () => {
  const findings = detectDuplicatedLogic([observation([
    operation('src/a.ts', 'canStart', ruleTokens),
    operation('src/t.ts', 'total', ['return', '$0', '.reduce', 'call', 'fn', '$1', '$2', '+', '$2', '0']),
  ])], new Map([['src/a.ts', 'ready-a'], ['src/t.ts', 'total']]))
  expect(findings.some(finding => namesOf(finding).includes('canStart') && namesOf(finding).includes('total'))).toBeFalse()
})

test.concurrent('similar independent rules still become a review finding', () => {
  const publish = [
    'return', '$0', '.status', '===', '"draft"', '&&', '$0', '.reviewers', '.every', 'call',
    'fn', '$1', '.approved', '&&', '$0', '.assignee', '!==', 'null',
    '&&', '$0', '.blockers', '.length', '===', '0',
  ]
  const findings = detectDuplicatedLogic([observation([
    operation('src/a.ts', 'canStart', ruleTokens),
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

test.concurrent('callbacks written in an object passed to a call or constructor are not compared', async () => {
  const root = await scannedFixture('call-argument-callbacks', 'src/observers.ts')
  try {
    const scanned = (await scanTypeScriptSource(root))!
    const findings = detectDuplicatedLogic([scanned], new Map())
    expect(findings).toHaveLength(1)
    expect(findings[0]!.match).toBe('exact')
    expect(namesOf(findings[0]!)).toEqual(['next', 'reportOrder'])
    // The wrapped spellings, such as `subscribe(({ next }))` or `subscribe({ next } as Observer)`, are callbacks too.
    expect(findings[0]!.instances.map(instance => instance.startLine)).toEqual([52, 58])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('bodies that differ in one operator, grouping or keyword are not copies, while constructors are compared', async () => {
  const root = await scannedFixture('distinct-bodies', 'src/bodies.ts')
  try {
    const findings = detectDuplicatedLogic([(await scanTypeScriptSource(root))!], new Map())
    // Each function pair differs only in one operator, grouping, keyword, literal, `?.`, `...`, `this`, `index`,
    // a `#name` or a destructured property name.
    expect(findings.map(finding => [finding.match, namesOf(finding)])).toEqual([['exact', ['constructor', 'constructor']]])
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
  } finally {
    rememberArchitectureFindings(root, [])
    await rm(root, { recursive: true, force: true })
  }
})

/** Each letter stands for three tokens so the bodies reach the near-duplicate minimum. */
function spread(letters: string): string[] {
  return [...letters].flatMap(letter => [letter, `${letter}.`, `${letter}()`])
}

function findingsFor(bodies: string[][]) {
  return detectDuplicatedLogic([observation(bodies.map((tokens, index) =>
    operation(`${index}.ts`, `rule${index}`, tokens),
  ))], new Map())
}

test.concurrent('near-duplicates need larger bodies than identical copies', () => {
  const body = (size: number) => Array.from({ length: size }, (_, index) => `t${index}`)
  const changed = (size: number) => [...body(size - 1), 'other']
  expect(findingsFor([body(23), changed(23)])).toEqual([])
  expect(findingsFor([body(24), changed(24)])[0]?.match).toBe('similar')
  expect(findingsFor([body(8), body(8)])[0]?.match).toBe('exact')
  expect(findingsFor([body(7), body(7)])).toEqual([])
})

test.concurrent('duplicate comparisons retain the similarity threshold and unequal-length matches', () => {
  const body = spread('abcdefghij')
  expect(findingsFor([body, spread('abcdefgXYZ')])[0]?.match).toBe('similar')
  expect(findingsFor([body, spread('abcdefWXYZ')])).toEqual([])
  const shorter = spread('abcdefgh')
  expect(findingsFor([shorter, spread('abcdefghijklmn')])[0]?.match).toBe('similar')
  expect(findingsFor([shorter, spread('abcdefghijklmno')])).toEqual([])
})

test.concurrent('transitive similarity keeps every copy even when the endpoints do not match', () => {
  const first = spread('abcdefghij')
  const bridge = spread('abcdefgXYZ')
  const last = spread('abcdUVWXYZ')
  expect(findingsFor([first, last])).toEqual([])
  const findings = findingsFor([first, bridge, [...bridge], last])
  expect(findings).toHaveLength(1)
  expect(findings[0]?.match).toBe('similar')
  expect(findings[0]?.instances.map(instance => instance.file)).toEqual(['0.ts', '1.ts', '2.ts', '3.ts'])
})

test.concurrent('shared tokens still require matching multiplicity and sequence order', () => {
  const repeated = spread('abcxxxxxxx')
  expect(findingsFor([repeated, spread('abcxxxxyyy')])[0]?.match).toBe('similar')
  expect(findingsFor([repeated, spread('abcxxxyyyy')])).toEqual([])
  expect(findingsFor([spread('abcdefghij'), spread('abcjihgfed')])).toEqual([])
})
