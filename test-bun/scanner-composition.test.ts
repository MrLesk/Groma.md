import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createScanObservation, parseScanObservation, type ScanObservation } from '@groma/scanner'

import { scanTypeScriptSource } from '../plugins/scanners/typescript/src/scan.ts'
import { loadArchitecture } from '../src/architecture-reader.ts'
import { loadAnnotatedArchitecture, reconcileScanObservations } from '../src/core.ts'
import { editArchitecture } from '../src/edit.ts'
import { addRelation } from '../src/relation.ts'
import { inferRelationships } from '../src/relationship-inference.ts'
import { composeInvocations } from '../src/scan-evidence.ts'
import { formatScanReport, scanRepository } from '../src/scanner.ts'
import { addScanner } from '../src/scanner/modules/inventory.ts'
import type { AnnotatedArchitectureModel } from '../src/types.ts'

const fixture = path.resolve(import.meta.dir, '../test/fixtures/scanner-composition')
const ends = { source: 'src/emitter.ts', target: 'src/handler.ts' }

async function observation(language: string, target = 'handler', unresolved = false): Promise<ScanObservation> {
  const emitter = await readFile(path.join(fixture, 'emitter.ts'), 'utf8')
  const host = await readFile(path.join(fixture, 'host.html'), 'utf8')
  const id = (name: string) => `${language}-compiler-id-${name}`
  const files = ['emitter.ts', 'handler.ts', 'alternate.ts', 'host.html'].map(file => `src/${file}`)
  return createScanObservation({
    scanner: { language, engine: 'fixture', engineVersion: '1' },
    root: { kind: 'package', name: 'Fixture', file: 'package.json' },
    scopes: [{ id: `${language}-scope`, name: 'Service' }],
    files: files.map(file => ({ file, symbols: [] })),
    placements: files.map(file => ({ file, scope: `${language}-scope` })),
    relationships: [],
    operations: ['emitter', 'handler', 'alternate'].map(name => ({
      id: id(name), file: `src/${name}.ts`, name, position: 0,
    })),
    invocations: [{
      source: id('emitter'), targets: unresolved ? [] : [id(target)], unresolved,
      line: 2, position: emitter.indexOf('output.emit'), member: 'saved',
      binding: { file: 'src/host.html', line: 1, position: host.indexOf('(saved)') },
    }],
    diagnostics: [],
  })
}

function owners(observation: ScanObservation): Map<string, string> {
  return new Map(observation.files.map(file => [file.file, file.file]))
}

async function repository(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-composition-'))
  await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
  await cp(fixture, path.join(root, 'src'), { recursive: true })
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture' }))
  const child = Bun.spawn(['git', 'init', '--quiet'], { cwd: root, stdout: 'ignore', stderr: 'pipe' })
  expect(await child.exited, await new Response(child.stderr).text()).toBe(0)
  return root
}

function owner(model: AnnotatedArchitectureModel, file: string) {
  const matches = model.elements.filter(element => element.code.some(reference => reference.file === file))
  expect(matches).toHaveLength(1)
  return matches[0]!
}

async function documents(root: string): Promise<Map<string, string>> {
  const records = await loadArchitecture(root)
  return new Map(await Promise.all(records.documents.map(async document => [
    document.sourceFilename, await readFile(path.join(root, document.sourceFilename), 'utf8'),
  ] as const)))
}

test.concurrent('the shared contract keeps source positions independent of compiler IDs', async () => {
  const scan = await observation('typescript')
  expect(parseScanObservation(JSON.stringify(scan))).toEqual(scan)
  expect(() => createScanObservation({
    ...scan, operations: [{ ...scan.operations![0]!, position: -1 }], invocations: [],
  })).toThrow('source position')
  expect(() => parseScanObservation(JSON.stringify({
    ...scan, invocations: [{ ...scan.invocations![0]!, position: 1.5 }],
  }))).toThrow('source position')
  expect(() => createScanObservation({
    ...scan, invocations: [{ ...scan.invocations![0]!, binding: { file: 'src/host.html', line: 1, position: -1 } }],
  })).toThrow('source position')
})

test.concurrent('a complementary named binding survives unresolved observations from another compiler', async () => {
  const typescript = await observation('typescript', 'handler', true)
  const angular = await observation('angular')
  typescript.invocations!.push({ ...typescript.invocations![0]!, binding: undefined })
  for (const scans of [[typescript, angular], [angular, typescript]]) {
    expect(composeInvocations(scans).conflicts).toEqual([])
    expect(inferRelationships(scans, owners(angular))).toEqual([
      expect.objectContaining({ ...ends, authored: false }),
    ])
  }
})

test.concurrent('agreeing source providers combine across compiler IDs without multiplying interactions', async () => {
  const typescript = await observation('typescript')
  const angular = await observation('angular')
  expect(typescript.operations![0]!.id).not.toBe(angular.operations![0]!.id)
  const forward = inferRelationships([typescript, angular, typescript], owners(typescript))
  expect(forward).toEqual(inferRelationships([angular, typescript], owners(typescript)))
  expect(forward).toEqual([expect.objectContaining({ ...ends, technology: 'angular, typescript' })])
  expect(composeInvocations([typescript, angular]).conflicts).toEqual([])
})

test.concurrent('incompatible certain providers are reported and cannot establish a relationship in either order', async () => {
  const typescript = await observation('typescript')
  const angular = await observation('angular', 'alternate')
  const ownership = owners(typescript)
  ownership.set('src/alternate.ts', ownership.get('src/handler.ts')!)
  const forward = composeInvocations([typescript, angular])
  expect(forward.conflicts).toHaveLength(1)
  expect(forward.conflicts[0]!.code).toBe('conflicting-providers')
  expect(forward.conflicts).toEqual(composeInvocations([angular, typescript]).conflicts)
  expect(inferRelationships([typescript, angular], ownership)).toEqual([])
  expect(inferRelationships([angular, typescript], ownership)).toEqual([])
})

test.concurrent('overlapping observations preserve curated membership and authored relationships through conflicts and rescans', async () => {
  const root = await repository()
  try {
    const typescript = await observation('typescript')
    const angular = await observation('angular')
    await reconcileScanObservations(root, [typescript])
    const initial = await loadAnnotatedArchitecture(root)
    const source = owner(initial, ends.source)
    await editArchitecture(root, { id: source.id, combine: [owner(initial, 'src/host.html').id] })
    await editArchitecture(root, { id: source.id, overview: 'Dispatches the completed result.' })
    await addRelation(root, { ...ends, description: 'Delivers the completed result', technology: 'Output' })
    const authored = (await loadAnnotatedArchitecture(root)).relationships
    await reconcileScanObservations(root, [angular, typescript])
    const overlap = await loadAnnotatedArchitecture(root)
    for (const file of typescript.files) {
      expect(owner(overlap, file.file).code.filter(reference => reference.file === file.file)).toHaveLength(2)
    }
    const conflict = await observation('angular', 'alternate')
    conflict.root.name = 'Framework'
    conflict.scopes[0]!.name = 'Framework'
    const summary = await reconcileScanObservations(root, [conflict, typescript])
    expect(summary.created).toBe(0)
    expect(summary.evidenceConflicts).toHaveLength(1)
    expect(formatScanReport(root, summary)).toContain('conflicting-providers')
    const before = await documents(root)
    await reconcileScanObservations(root, [typescript, conflict])
    expect(await documents(root)).toEqual(before)
    const current = await loadAnnotatedArchitecture(root)
    expect(owner(current, ends.source).id).toBe(source.id)
    expect(owner(current, 'src/host.html').id).toBe(source.id)
    expect(current.relationships).toEqual(authored)
    expect(current.relationships.flatMap(relationship => relationship.connections ?? []).every(connection => connection.authored)).toBe(true)
    await reconcileScanObservations(root, [angular, typescript])
    const agreeing = await documents(root)
    await reconcileScanObservations(root, [typescript, angular])
    expect(await documents(root)).toEqual(agreeing)
    expect((await loadAnnotatedArchitecture(root)).relationships).toEqual(authored)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('a failed enabled scanner prevents reconciliation of otherwise successful overlapping evidence', async () => {
  const root = await repository()
  try {
    await reconcileScanObservations(root, [await observation('typescript'), await observation('angular')])
    const plugin = path.join(root, 'failing')
    await mkdir(plugin)
    await writeFile(path.join(plugin, 'package.json'), JSON.stringify({
      name: 'fixture-failing', version: '1.0.0', type: 'module', groma: { scanner: { id: 'failing', entry: './index.js' } },
    }))
    await writeFile(path.join(plugin, 'index.js'), `export default {
      id: 'failing', matchesFile() { return false },
      async scan() { throw new Error('fixture scanner failed') },
    }`)
    await addScanner(root, './failing')
    const before = await documents(root)
    await expect(scanRepository(root)).rejects.toThrow('fixture scanner failed')
    expect(await documents(root)).toEqual(before)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('embedded TypeScript locates declarations and invocations using source offsets', async () => {
  const root = await repository()
  try {
    const scan = (await scanTypeScriptSource(root))!
    const source = await readFile(path.join(root, 'src/emitter.ts'), 'utf8')
    const call = scan.invocations!.find(invocation => invocation.member === 'emit')!
    const operation = scan.operations!.find(operation => operation.id === call.source)!
    expect(source.slice(operation.position, operation.position! + 15)).toBe('export function')
    expect(source.slice(call.position, call.position! + 11)).toBe('output.emit')
    expect(call.unresolved).toBe(true)
    expect(parseScanObservation(JSON.stringify(scan))).toEqual(scan)
  } finally { await rm(root, { recursive: true, force: true }) }
})
