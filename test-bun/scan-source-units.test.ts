import { expect, test } from 'bun:test'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createScanObservation, parseScanObservation, type ScanSourceUnit } from '@groma/scanner'
import { combineObservations, relocateObservation } from '../plugins/scanners/observations.ts'
import { loadAnnotatedArchitecture, reconcileScanObservations } from '../src/core.ts'
import { editArchitecture } from '../src/edit.ts'
import { addRelation } from '../src/relation.ts'
import type { AnnotatedArchitectureModel } from '../src/types.ts'

const paths = ['emitter.ts', 'handler.ts', 'alternate.ts', 'host.html']
const unit = { primary: 'emitter.ts', files: ['emitter.ts', 'host.html'] }

function observation(units: ScanSourceUnit[] = [unit], scanner = 'fixture') {
  return createScanObservation({
    scanner: { id: scanner, technology: scanner, engine: 'fixture', engineVersion: '1' },
    roots: [{ id: 'app', kind: 'project', name: 'App' }],
    files: paths.map(file => ({ file, roots: ['app'], symbols: [] })),
    sourceUnits: units,
    operations: paths.slice(0, 2).map(file => ({ id: file, file, name: file, position: 0 })),
    invocations: [{ source: 'emitter.ts', targets: ['handler.ts'], unresolved: false, line: 2,
      member: 'saved', binding: { file: 'host.html', line: 1 } }],
    diagnostics: [],
  })
}

async function repository() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-units-'))
  await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
  await cp(path.resolve(import.meta.dir, '../test/fixtures/scanner-composition'), root, { recursive: true })
  return root
}

function owner(model: AnnotatedArchitectureModel, file: string) {
  const found = model.elements.filter(element => element.code.some(code => code.file === file))
  expect(found).toHaveLength(1)
  return found[0]!
}

test.concurrent('source units survive parsing, project relocation, and overlapping compiler contexts', () => {
  const scan = observation()
  expect(parseScanObservation(JSON.stringify(scan))).toEqual(scan)
  const shifted = relocateObservation(scan, 'packages/view')
  expect(shifted.sourceUnits).toEqual([{ primary: 'packages/view/emitter.ts',
    files: ['packages/view/emitter.ts', 'packages/view/host.html'] }])
  const combined = combineObservations([{ key: 'one', observation: shifted }, { key: 'two', observation: shifted }])!
  expect(combined.sourceUnits).toEqual(shifted.sourceUnits)
  expect(combined.files).toHaveLength(scan.files.length)
  expect(() => createScanObservation({ ...scan, sourceUnits: [{ primary: 'missing.ts', files: ['missing.ts'] }] }))
    .toThrow('unknown file')
  expect(() => parseScanObservation(JSON.stringify({ ...scan, sourceUnits: [{ primary: 'emitter.ts', files: ['host.html'] }] })))
    .toThrow('omits primary')
})

test.concurrent('one source unit owns every file and scanner reference through reorder and repeat scans', async () => {
  const root = await repository()
  try {
    const scan = observation(), overlap = observation([], 'other')
    await reconcileScanObservations(root, [scan, overlap])
    const before = await loadAnnotatedArchitecture(root)
    const component = owner(before, 'emitter.ts')
    expect(owner(before, 'host.html').id).toBe(component.id)
    expect(component.code).toHaveLength(4)
    expect(before.relationships).toHaveLength(1)
    const summary = await reconcileScanObservations(root, [overlap, scan])
    expect(summary.created).toBe(0)
    expect(summary.evidenceConflicts).toBeUndefined()
    expect((await loadAnnotatedArchitecture(root)).elements).toEqual(before.elements)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('new companion joins a curated owner and later missing associations retain its meaning and relationships', async () => {
  const root = await repository()
  try {
    const first = observation()
    first.files = first.files.filter(file => file.file !== 'alternate.ts')
    await reconcileScanObservations(root, [first])
    const initial = await loadAnnotatedArchitecture(root)
    const id = owner(initial, unit.primary).id
    await editArchitecture(root, { id, title: 'Result dispatch', description: 'Coordinates callbacks.', overview: 'Delivers results.' })
    await addRelation(root, { source: 'emitter.ts', target: 'handler.ts', description: 'Delivers the result', technology: 'Callback' })
    const attached = observation([{ ...unit, files: [...unit.files, 'alternate.ts'] }])
    await reconcileScanObservations(root, [attached])
    const current = await loadAnnotatedArchitecture(root)
    expect(owner(current, 'alternate.ts').id).toBe(id)
    expect(owner(current, unit.primary).title).toBe('Result dispatch')
    const summary = await reconcileScanObservations(root, [observation([])])
    expect(summary.evidenceConflicts).toBeUndefined()
    expect(await loadAnnotatedArchitecture(root)).toEqual(current)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('shared proposals and separately established owners are never silently merged', async () => {
  const root = await repository()
  try {
    const overlapping = observation([unit, { primary: 'handler.ts', files: ['handler.ts', 'host.html'] }])
    const conflict = await reconcileScanObservations(root, [overlapping])
    expect(conflict.evidenceConflicts?.filter(item => item.code === 'shared-source-unit-file')).toHaveLength(2)
    const before = await loadAnnotatedArchitecture(root)
    expect(new Set(paths.map(file => owner(before, file).id)).size).toBe(4)
    const existing = await reconcileScanObservations(root, [observation()])
    expect(existing.evidenceConflicts?.map(item => item.code)).toContain('conflicting-source-unit-owners')
    expect((await loadAnnotatedArchitecture(root)).elements).toEqual(before.elements)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('relationships inside a source unit do not become architecture self-links', async () => {
  const root = await repository()
  try {
    await reconcileScanObservations(root, [observation([{ primary: 'emitter.ts', files: ['emitter.ts', 'handler.ts'] }])])
    const model = await loadAnnotatedArchitecture(root)
    expect(owner(model, 'emitter.ts').id).toBe(owner(model, 'handler.ts').id)
    expect(model.relationships).toHaveLength(0)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('manual combines and moves remain authoritative without warnings when source units are scanned again', async () => {
  const root = await repository()
  try {
    const scan = observation()
    scan.roots.push({ id: 'other', kind: 'project', name: 'Other' })
    await reconcileScanObservations(root, [scan])
    const initial = await loadAnnotatedArchitecture(root)
    const component = owner(initial, 'emitter.ts')
    const destination = initial.elements.find(element => element.kind === 'container' && element.id !== component.parent)!
    await editArchitecture(root, { id: component.id, combine: [owner(initial, 'alternate.ts').id] })
    await editArchitecture(root, { id: component.id, parent: destination.id })
    const curated = await loadAnnotatedArchitecture(root)
    expect((await reconcileScanObservations(root, [scan])).evidenceConflicts).toBeUndefined()
    const current = await loadAnnotatedArchitecture(root)
    expect(owner(current, 'emitter.ts').parent).toBe(destination.id)
    for (const file of ['emitter.ts', 'host.html', 'alternate.ts']) {
      expect(owner(current, file)).toEqual(owner(curated, file))
    }
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('a removed companion declaration keeps its owner without a warning when the scanner stops inventorying that file', async () => {
  const root = await repository()
  try {
    await reconcileScanObservations(root, [observation()])
    const before = await loadAnnotatedArchitecture(root)
    const changed = observation([])
    changed.files = changed.files.filter(file => file.file !== 'host.html')
    changed.invocations = []
    const summary = await reconcileScanObservations(root, [changed])
    expect(summary.evidenceConflicts).toBeUndefined()
    const retained = owner(await loadAnnotatedArchitecture(root), 'host.html')
    expect(retained.id).toBe(owner(before, 'host.html').id)
    expect(retained.code.map(code => code.file)).toEqual(owner(before, 'host.html').code.map(code => code.file))
  } finally { await rm(root, { recursive: true, force: true }) }
})
