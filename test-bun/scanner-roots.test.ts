import { expect, test } from 'bun:test'
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createScanObservation } from '@groma/scanner'

import { loadAnnotatedArchitecture } from '../src/core.ts'
import { loadArchitecture } from '../src/architecture-reader.ts'
import { loadProjectProfile } from '../src/project-profile.ts'
import { reconcileScanObservations } from '../src/scan-reconciler.ts'

function observation() {
  return createScanObservation({
    scanner: { id: 'fixture', technology: 'c#/.NET', engine: 'fixture', engineVersion: '1' },
    roots: [
      { id: 'shop', kind: 'solution', name: 'Shop', file: 'Shop.sln' },
      { id: 'api', kind: 'project', name: 'Api', parent: 'shop', file: 'Api.csproj' },
      { id: 'worker', kind: 'project', name: 'Worker', parent: 'shop', file: 'Worker.csproj' },
      { id: 'tools', kind: 'package', name: 'Tools' },
    ],
    files: [
      { file: 'api.cs', roots: ['api'], symbols: [] },
      { file: 'worker.cs', roots: ['worker'], symbols: [] },
      { file: 'shared.cs', roots: ['api', 'worker'], symbols: [] },
      { file: 'tools.cs', roots: ['tools'], symbols: [] },
    ],
    diagnostics: [],
  })
}

test.concurrent('root hierarchy rejects invalid parentage and duplicate identities', () => {
  const value = observation()
  expect(() => createScanObservation({ ...value,
    roots: [{ id: 'api', kind: 'project', name: 'Api', parent: 'missing' }],
  })).toThrow()
  expect(() => createScanObservation({ ...value,
    roots: [{ id: 'api', kind: 'project', name: 'Api', parent: 'worker' },
      { id: 'worker', kind: 'project', name: 'Worker', parent: 'api' }],
  })).toThrow()
  expect(() => createScanObservation({ ...value, roots: [...value.roots, value.roots[0]!] })).toThrow()
})

test.concurrent('source roots do not invent containers and shared files retain their owner', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-roots-'))
  try {
    await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
    const scan = observation()
    for (const file of scan.files) await writeFile(path.join(root, file.file), '')
    await reconcileScanObservations(root, [scan])
    const first = await loadAnnotatedArchitecture(root)
    const owner = (file: string) => first.elements.find(element => element.code.some(code => code.file === file))!
    const byId = new Map(first.elements.map(element => [element.id, element]))
    const system = (file: string) => byId.get(owner(file).parent!)!
    expect(first.elements.filter(element => element.kind === 'system')).toHaveLength(1)
    expect(system('api.cs').title).toBe((await loadProjectProfile(root))!.title)
    expect(first.elements.filter(element => element.kind === 'container')).toEqual([])
    expect(system('api.cs').id).toBe(system('worker.cs').id)
    expect(system('api.cs').id).toBe(system('tools.cs').id)
    expect(system('api.cs').kind).toBe('system')
    expect(first.elements.filter(element => element.code.some(code => code.file === 'shared.cs'))).toHaveLength(1)
    const shared = owner('shared.cs')
    const stored = (await loadArchitecture(root)).documents
      .map(document => document.frontmatter.groma as { id: string; code: unknown })
      .find(record => record?.id === shared.id)
    expect(stored?.code).toEqual([{ scanner: 'fixture', file: 'shared.cs' }])

    const changed = createScanObservation({ ...scan,
      scanner: { ...scan.scanner, technology: 'another-technology', engineVersion: '2' },
      files: scan.files.map(file => ({ ...file, roots: file.file === 'shared.cs' ? ['tools'] : file.roots })),
    })
    expect(await reconcileScanObservations(root, [changed])).toMatchObject({ created: 0 })
    const second = await loadAnnotatedArchitecture(root)
    expect(second.elements.find(element => element.id === shared.id)?.code).toEqual(shared.code)
    expect(second.elements.find(element => element.id === shared.id)?.parent).toBe(shared.parent)
  } finally { await rm(root, { recursive: true, force: true }) }
})

function sharedSourceGroups(separateRoots: boolean, separateScanners: boolean) {
  const roots = [
    { id: 'api', kind: 'project', name: 'Api' },
    { id: 'web', kind: 'project', name: 'Web' },
  ]
  const files = [
    { file: 'src/orders.ts', roots: ['api'], symbols: [] },
    { file: 'src/page.ts', roots: [separateRoots ? 'web' : 'api'], symbols: [] },
    { file: 'src/shared.ts', roots: separateRoots ? ['api', 'web'] : ['api'], symbols: [] },
  ]
  const observation = (id: string, selectedRoots = roots) => createScanObservation({
    scanner: { id, technology: 'fixture', engine: 'fixture', engineVersion: '1' },
    roots: selectedRoots,
    files: files.flatMap(file => {
      const memberships = file.roots.filter(id => selectedRoots.some(root => root.id === id))
      return memberships.length === 0 ? [] : [{ ...file, roots: memberships }]
    }),
    diagnostics: [],
  })
  return separateScanners ? roots.map(root => observation(root.id, [root])) : [observation('fixture')]
}

test.concurrent('an unmatched source root cannot add a system beside authored systems', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-declared-systems-'))
  try {
    await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
    await cp(path.resolve(import.meta.dir, '../test/fixtures/curation'), root, { recursive: true })
    const before = await loadAnnotatedArchitecture(root)
    const scan = createScanObservation({
      scanner: { id: 'fixture', technology: 'fixture', engine: 'fixture', engineVersion: '1' },
      roots: [{ id: 'library', kind: 'project', name: 'Library' }],
      files: [{ file: 'shared.cs', roots: ['library'], symbols: [] }],
      diagnostics: [],
    })
    await expect(reconcileScanObservations(root, [scan])).rejects.toThrow('shared.cs')
    expect((await loadAnnotatedArchitecture(root)).elements).toEqual(before.elements)
  } finally { await rm(root, { recursive: true, force: true }) }
})

for (const [label, separateRoots, separateScanners] of [
  ['one source group', false, false],
  ['overlapping source groups', true, false],
  ['overlapping scanners', true, true],
] as const) {
  test.concurrent(`${label} cannot choose between established containers for a new file`, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'groma-shared-placement-'))
    try {
      await cp(path.resolve(import.meta.dir, '../test/fixtures/containers-view'), root, { recursive: true })
      const before = await loadAnnotatedArchitecture(root)
      const scans = sharedSourceGroups(separateRoots, separateScanners)
      await reconcileScanObservations(root, scans)
      const after = await loadAnnotatedArchitecture(root)
      const shared = after.elements.find(element => element.code.some(code => code.file === 'src/shared.ts'))!
      expect(shared.parent).toBe('shop')
      for (const known of before.elements) {
        expect(after.elements.find(element => element.id === known.id)).toMatchObject({
          parent: known.parent, title: known.title, overview: known.overview,
        })
      }
      expect(after.elements.filter(element => element.kind === 'container')).toHaveLength(2)
      expect(after.elements.filter(element => element.kind === 'system')).toHaveLength(1)
      expect((await reconcileScanObservations(root, [...scans].reverse())).created).toBe(0)
      const repeated = await loadAnnotatedArchitecture(root)
      expect(repeated.elements.find(element => element.id === shared.id)?.parent).toBe('shop')
    } finally { await rm(root, { recursive: true, force: true }) }
  })
}
