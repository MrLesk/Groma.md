import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createScanObservation, type ScanObservation } from '@groma/scanner'

import { loadAnnotatedArchitecture, reconcileScanObservations } from '../src/core.ts'
import { editArchitecture } from '../src/edit.ts'
import { addRelation } from '../src/relation.ts'
import { buildPackage } from '../plugins/scanners/vue/build.ts'
import { loadScannerRegistry } from '../src/scanner/registry.ts'
import { readScannerConfig, writeScannerConfig } from '../src/scanner/modules/config.ts'
import { addScanner } from '../src/scanner/modules/inventory.ts'
import { checkScannerReadiness } from '../src/scanner/modules/readiness.ts'

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
  await addScanner(root, path.resolve(import.meta.dir, '../plugins/scanners/typescript'))
  return root
}

async function configure(root: string, exclude: unknown, directory = 'groma'): Promise<void> {
  const config = await readScannerConfig(root)
  await write(root, `${directory}/scanners.json`, JSON.stringify({ ...config, exclude }))
}

test.concurrent('fully excluded Vue sources skip readiness and scanning until they are included again', async () => {
  const root = await repository()
  const artifact = await mkdtemp(path.join(os.tmpdir(), 'groma-exclusions-vue-'))
  try {
    await cp(path.resolve(import.meta.dir, '../test/fixtures/vue-output'), path.join(root, 'fixtures/vue'), { recursive: true })
    await buildPackage(artifact)
    const scanners = [{ id: 'vue', source: artifact }]
    await writeScannerConfig(root, { scanners, exclude: ['/fixtures/'] })
    const readiness = await checkScannerReadiness(root)
    expect(readiness.map(item => item.project)).toEqual(['ready'])
    const excluded = await (await loadScannerRegistry(root)).collectObservations(root)
    expect(excluded.failures).toEqual([])
    expect(excluded.observations).toEqual([])

    await writeScannerConfig(root, { scanners })
    const included = await (await loadScannerRegistry(root)).collectObservations(root)
    expect(included.failures.map(failure => failure.scanner)).toEqual(['vue'])
    expect(included.failures[0]?.message).toContain('logic.ts')
  } finally { await Promise.all([root, artifact].map(directory => rm(directory, { recursive: true, force: true }))) }
})

test.concurrent('shared exclusions prevent readiness and scan hooks from running against excluded inputs', async () => {
  const root = await repository()
  try {
    await write(root, 'hidden/source.fixture', 'source')
    await write(root, 'plugin/package.json', JSON.stringify({ name: 'fixture-scanner', version: '1.0.0',
      groma: { scanner: { id: 'fixture', entry: './index.ts' } },
    }))
    await write(root, 'plugin/index.ts', `export default {
      id: 'fixture', watch: { include: ['**/*.fixture'], exclude: [] },
      async listSourceFiles(root, settings) { return [settings.input] },
      async checkReadiness() { throw new Error('fixture readiness failed') },
      async scan() { throw new Error('fixture scan failed') },
    }`)
    const scanners = [{ id: 'fixture', source: './plugin', settings: { input: 'hidden/source.fixture' } }]
    await writeScannerConfig(root, { scanners, exclude: ['/hidden/'] })
    expect((await checkScannerReadiness(root)).map(item => item.project)).toEqual(['ready'])
    expect((await (await loadScannerRegistry(root)).collectObservations(root)).failures).toEqual([])

    await writeScannerConfig(root, { scanners })
    expect((await checkScannerReadiness(root)).map(item => item.project)).toEqual(['blocked'])
    expect((await (await loadScannerRegistry(root)).collectObservations(root)).failures.map(failure => failure.scanner))
      .toEqual(['fixture'])
  } finally { await rm(root, { recursive: true, force: true }) }
})

function observation(language: string): ScanObservation {
  const paths = ['src/kept.ts', 'scripts/hidden.ts', 'src/view.html', 'src/other.ts']
  const files = paths.map(file => ({ file, roots: [file.startsWith('scripts/') ? 'scripts' : 'app'], symbols: [] }))
  return createScanObservation({
    scanner: { id: language, technology: 'fixture', engine: 'fixture', engineVersion: '1' },
    roots: [
      { id: 'root', kind: 'package', name: 'Fixture', file: 'package.json' },
      { kind: 'project', parent: 'root', id: 'app', name: 'App' },
      { kind: 'project', parent: 'root', id: 'scripts', name: 'Scripts' },
    ],
    files,
    sourceUnits: [
      { primary: paths[0]!, files: [paths[0]!, paths[2]!, paths[3]!] },
      { primary: paths[1]!, files: [paths[1]!, paths[3]!] },
    ],
    operations: paths.filter(file => file.endsWith('.ts')).map(file => ({ id: file, file, name: file, position: 0 })),
    invocations: [
      { source: paths[0]!, targets: [paths[1]!], unresolved: false, line: 1, binding: { file: paths[2]!, line: 1 } },
      { source: paths[0]!, targets: [paths[1]!, paths[3]!], unresolved: false, line: 2 },
      { source: paths[1]!, targets: [paths[0]!], unresolved: false, line: 3 },
      { source: paths[0]!, targets: [paths[3]!], unresolved: false, line: 4, binding: { file: paths[2]!, line: 1 } },
      { source: paths[0]!, targets: [paths[3]!], unresolved: false, line: 5 },
    ],
    httpEndpoints: [{ operation: paths[1]!, method: 'GET', path: [{ kind: 'literal', value: 'hidden' }] }],
    httpRequests: [
      { operation: paths[1]!, method: 'GET', path: [] },
      { operation: paths[0]!, method: 'GET', path: [{ kind: 'literal', value: 'hidden' }] },
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
    id: ${JSON.stringify(id)}, watch: { include: ['**/*.html'], exclude: [] },
    async scan() { return ${JSON.stringify(scan)} },
  }`)
  return source
}

test.concurrent('every scanner filters complete evidence without narrowing invocation targets or leaving dangling claims', async () => {
  const root = await repository()
  try {
    for (const file of observation('fixture').files) await write(root, file.file, 'export const value = 1\n')
    for (const id of ['first', 'second']) await addScanner(root, await plugin(root, id))
    await configure(root, ['/scripts/', '**/*.html'])
    const registry = await loadScannerRegistry(root)
    const scans = (await registry.collectObservations(root)).observations
    expect(scans.map(scan => scan.scanner.id).sort()).toEqual(['first', 'second', 'typescript'])
    for (const scan of scans) {
      expect(scan.files.map(file => file.file).sort()).toEqual(['src/kept.ts', 'src/other.ts'])
      expect(scan.roots.some(root => root.id === 'scripts')).toBeFalse()
      expect(scan.roots.some(root => root.id === 'root' || root.id === 'package')).toBeTrue()
      if (scan.scanner.id !== 'typescript') {
        expect(scan.sourceUnits).toEqual([{ primary: 'src/kept.ts', files: ['src/kept.ts', 'src/other.ts'] }])
      }
      expect(scan.invocations).toEqual(scan.scanner.id === 'typescript' ? [] : [
        { source: 'src/kept.ts', targets: ['src/other.ts'], unresolved: false, line: 5 },
      ])
      if (scan.scanner.id !== 'typescript') {
        expect(scan.httpEndpoints).toEqual([])
        expect(scan.httpRequests?.map(request => request.operation)).toEqual(['src/kept.ts'])
      }
    }
    await reconcileScanObservations(root, scans)
    const model = await loadAnnotatedArchitecture(root)
    expect(model.elements.flatMap(element => element.code.map(code => code.file)).sort())
      .toEqual(['src/kept.ts', 'src/kept.ts', 'src/kept.ts', 'src/other.ts', 'src/other.ts', 'src/other.ts'])
    expect(model.relationships).toEqual([])
    await configure(root, ['**'])
    expect((await (await loadScannerRegistry(root)).collectObservations(root)).observations).toEqual([])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('rescan keeps stored component ownership and authored content while omitting new excluded files', async () => {
  const root = await repository()
  try {
    await write(root, 'scripts/hidden.ts', 'export const value = 1\n')
    await write(root, 'src/kept.ts', 'export const value = 1\n')
    await reconcileScanObservations(root, (await (await loadScannerRegistry(root)).collectObservations(root)).observations)
    const initial = await loadAnnotatedArchitecture(root)
    const stored = initial.elements.find(element => element.code.some(code => code.file === 'scripts/hidden.ts'))!
    await editArchitecture(root, { id: stored.id, overview: 'Builds the release package.' })
    await addRelation(root, { source: 'src/kept.ts', target: 'scripts/hidden.ts', description: 'Requests a build', technology: 'CLI' })
    const authored = await loadAnnotatedArchitecture(root)
    await write(root, 'scripts/new.ts', 'export const another = 2\n')
    await configure(root, ['/scripts/'])
    for (let scan = 0; scan < 2; scan++) {
      await reconcileScanObservations(root, (await (await loadScannerRegistry(root)).collectObservations(root)).observations)
    }
    const current = await loadAnnotatedArchitecture(root)
    expect(current.elements).toEqual(authored.elements)
    expect(current.relationships).toEqual(authored.relationships)
  } finally { await rm(root, { recursive: true, force: true }) }
})
