import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createScanObservation, parseScanObservation, type ScanObservation } from '@groma/scanner'

import { loadArchitecture } from '../src/architecture-reader.ts'
import { loadAnnotatedArchitecture, reconcileScanObservations } from '../src/core.ts'
import { editArchitecture } from '../src/edit.ts'
import { addRelation } from '../src/relation.ts'
import { loadScannerRegistry } from '../src/scanner/registry.ts'
import { readScannerConfig } from '../src/scanner/modules/config.ts'
import { addScanner, removeScanner } from '../src/scanner/modules/inventory.ts'
import { installSelectedScanners } from '../src/scanner/modules/setup.ts'
import { discoverScanners } from '../src/scanner/modules/discovery.ts'

async function write(root: string, file: string, source: string): Promise<void> {
  const filename = path.join(root, file)
  await mkdir(path.dirname(filename), { recursive: true })
  await writeFile(filename, source)
}

async function repository(hidden = false): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-exclusions-'))
  await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
  if (hidden) {
    await rename(path.join(root, 'groma'), path.join(root, '.groma'))
  }
  await write(root, 'package.json', '{"name":"fixture"}')
  const child = Bun.spawn(['git', 'init', '--quiet'], { cwd: root, stdout: 'ignore', stderr: 'pipe' })
  const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()])
  expect(code, stderr).toBe(0)
  return root
}

async function configure(root: string, exclude: unknown, directory = 'groma'): Promise<void> {
  const config = await readScannerConfig(root)
  await write(root, `${directory}/scanners.json`, JSON.stringify({ ...config, exclude }))
}

function observation(language: string): ScanObservation {
  const paths = ['src/kept.ts', 'scripts/hidden.ts', 'src/view.html', 'src/other.ts']
  const files = paths.map(file => ({ file, symbols: [] }))
  return createScanObservation({
    scanner: { language, engine: 'fixture', engineVersion: '1' },
    root: { kind: 'package', name: 'Fixture', file: 'package.json' },
    files, scopes: [{ id: 'app', name: 'App' }, { id: 'scripts', name: 'Scripts' }],
    placements: files.map(({ file }) => ({ file, scope: file.startsWith('scripts/') ? 'scripts' : 'app' })),
    relationships: [{ source: 'src/kept.ts', target: 'scripts/hidden.ts', kind: 'import' }],
    operations: paths.filter(file => file.endsWith('.ts')).map(file => ({ id: file, file, name: file, position: 0 })),
    invocations: [
      { source: paths[0]!, targets: [paths[1]!], unresolved: false, line: 1, binding: { file: paths[2]!, line: 1 } },
      { source: paths[0]!, targets: [paths[1]!, paths[3]!], unresolved: false, line: 2 },
      { source: paths[1]!, targets: [paths[0]!], unresolved: false, line: 3 },
      { source: paths[0]!, targets: [paths[3]!], unresolved: false, line: 4, binding: { file: paths[2]!, line: 1 } },
      { source: paths[0]!, targets: [paths[3]!], unresolved: false, line: 5 },
    ],
    diagnostics: [],
  })
}

async function plugin(root: string, id: string, scan = observation(id)): Promise<string> {
  const source = `./plugins/${id}`
  await write(root, `${source}/package.json`, JSON.stringify({
    name: `fixture-${id}`, version: '1.0.0', type: 'module', groma: { scanner: { id, entry: './index.js' } },
  }))
  await write(root, `${source}/index.js`, `export default {
    id: ${JSON.stringify(id)}, matchesFile: file => file.endsWith('.html'),
    async scan() { return ${JSON.stringify(scan)} },
  }`)
  return source
}

for (const hidden of [false, true]) {
  test.concurrent(`scanner add, remove and setup preserve exclusions in ${hidden ? '.groma' : 'groma'}`, async () => {
    const root = await repository(hidden)
    const directory = hidden ? '.groma' : 'groma'
    const exclude = ['/scripts/', '**/*.generated.ts', '!src/keep.generated.ts']
    try {
      await configure(root, exclude, directory)
      await addScanner(root, await plugin(root, 'first'))
      const source = await plugin(root, 'second')
      const proposal = { ...await discoverScanners(root), recommendations: [{
        id: 'second', package: 'fixture-second', status: 'installable' as const,
        evidence: [], reason: 'Fixture', installSource: source,
      }] }
      await installSelectedScanners(root, proposal, ['second'])
      expect((await readScannerConfig(root)).scanners).toHaveLength(2)
      expect((await readScannerConfig(root)).exclude).toEqual(exclude)
      await removeScanner(root, 'first')
      expect((await readScannerConfig(root)).scanners.map(scanner => scanner.id)).toEqual(['second'])
      expect((await readScannerConfig(root)).exclude).toEqual(exclude)
      await configure(root, [42], directory)
      const error = await readScannerConfig(root).catch(error => error)
      expect(error).toBeInstanceOf(Error)
      expect(error.message).toContain('exclude must be an array of strings')
    } finally { await rm(root, { recursive: true, force: true }) }
  })
}

test.concurrent('Git ignore rules select evidence and watched paths while retaining language defaults', async () => {
  const root = await repository()
  const files = ['scripts/build.ts', 'src/scripts/build.ts', 'src/a.generated.ts', 'src/keep.generated.ts',
    'src/nested/a.generated.ts', 'src/tmp/a.ts', 'src/tmp/keep.ts', 'src/file1.ts', 'src/filea.ts',
    'src/#literal.ts', 'test/skipped.ts', 'src/skipped.test.ts', 'src/types.d.ts']
  try {
    for (const file of files) await write(root, file, 'export const value = 1\n')
    const initial = await loadScannerRegistry(root)
    const baseline = await initial.collectObservations(root)
    expect(baseline.flatMap(scan => scan.files.map(file => file.file))).toContain('scripts/build.ts')
    await configure(root, [])
    expect(await (await loadScannerRegistry(root)).collectObservations(root)).toEqual(baseline)
    await configure(root, ['/scripts/', '**/*.generated.ts', '!src/keep.generated.ts', 'tmp/', '!src/tmp/keep.ts',
      'src/file[0-9].ts', '\\#literal.ts'])
    const registry = await loadScannerRegistry(root)
    const remaining = (await registry.collectObservations(root)).flatMap(scan => scan.files.map(file => file.file)).sort()
    expect(remaining).toEqual(['src/filea.ts', 'src/keep.generated.ts', 'src/scripts/build.ts'])
    for (const file of files) {
      expect(registry.matchesFile(file)).toBe(remaining.includes(file))
      expect(registry.matchesFile(file.split('/').join(path.sep))).toBe(remaining.includes(file))
    }
    // Git patterns remain case-sensitive on every host.
    expect(registry.matchesFile('Scripts/build.ts')).toBe(true)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('every scanner filters complete evidence without narrowing invocation targets or leaving dangling claims', async () => {
  const root = await repository()
  try {
    for (const file of observation('fixture').files) await write(root, file.file, 'export const value = 1\n')
    for (const id of ['first', 'second']) await addScanner(root, await plugin(root, id))
    await configure(root, ['/scripts/', '**/*.html'])
    const registry = await loadScannerRegistry(root)
    const scans = await registry.collectObservations(root)
    expect(scans.map(scan => scan.scanner.language).sort()).toEqual(['first', 'second', 'typescript'])
    expect(registry.matchesFile('src/view.html')).toBe(false)
    for (const scan of scans) {
      expect(scan.files.map(file => file.file).sort()).toEqual(['src/kept.ts', 'src/other.ts'])
      expect(parseScanObservation(JSON.stringify(scan))).toEqual(scan)
      expect(scan.relationships).toEqual([])
      expect(scan.invocations).toEqual(scan.scanner.language === 'typescript' ? [] : [
        { source: 'src/kept.ts', targets: ['src/other.ts'], unresolved: false, line: 5 },
      ])
    }
    await reconcileScanObservations(root, scans)
    const model = await loadAnnotatedArchitecture(root)
    expect(model.elements.flatMap(element => element.code.map(code => code.file)).sort())
      .toEqual(['src/kept.ts', 'src/kept.ts', 'src/kept.ts', 'src/other.ts', 'src/other.ts', 'src/other.ts'])
    expect(model.relationships).toEqual([])
    await configure(root, ['**'])
    expect(await (await loadScannerRegistry(root)).collectObservations(root)).toEqual([])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('rescan keeps stored component ownership and authored content while omitting new excluded files', async () => {
  const root = await repository()
  try {
    await write(root, 'scripts/hidden.ts', 'export const value = 1\n')
    await write(root, 'src/kept.ts', 'export const value = 1\n')
    await reconcileScanObservations(root, await (await loadScannerRegistry(root)).collectObservations(root))
    const initial = await loadAnnotatedArchitecture(root)
    const stored = initial.elements.find(element => element.code.some(code => code.file === 'scripts/hidden.ts'))!
    await editArchitecture(root, { id: stored.id, overview: 'Builds the release package.' })
    await addRelation(root, { source: 'src/kept.ts', target: 'scripts/hidden.ts', description: 'Requests a build', technology: 'CLI' })
    const authored = await loadAnnotatedArchitecture(root)
    const records = (await loadArchitecture(root)).documents
    const snapshot = () => Promise.all(records.map(record => readFile(path.join(root, record.sourceFilename), 'utf8')))
    const before = await snapshot()
    await write(root, 'scripts/new.ts', 'export const another = 2\n')
    await configure(root, ['/scripts/'])
    for (let scan = 0; scan < 2; scan++) {
      await reconcileScanObservations(root, await (await loadScannerRegistry(root)).collectObservations(root))
    }
    const current = await loadAnnotatedArchitecture(root)
    expect(current.elements).toEqual(authored.elements)
    expect(current.relationships).toEqual(authored.relationships)
    expect(await snapshot()).toEqual(before)
  } finally { await rm(root, { recursive: true, force: true }) }
})
