import { expect, test } from 'bun:test'
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createScanObservation } from '@groma/scanner'

import { loadAnnotatedArchitecture } from '../src/core.ts'
import { loadArchitecture } from '../src/architecture-reader.ts'
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

test.concurrent('independent roots establish separate systems while shared files retain one curated owner', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-roots-'))
  try {
    await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
    const scan = observation()
    for (const file of scan.files) await writeFile(path.join(root, file.file), '')
    await reconcileScanObservations(root, [scan])
    const first = await loadAnnotatedArchitecture(root)
    const owner = (file: string) => first.elements.find(element => element.code.some(code => code.file === file))!
    const byId = new Map(first.elements.map(element => [element.id, element]))
    const system = (file: string) => byId.get(byId.get(owner(file).parent!)!.parent!)!
    expect(system('api.cs').id).toBe(system('worker.cs').id)
    expect(system('api.cs').id).not.toBe(system('tools.cs').id)
    expect(owner('api.cs').parent).not.toBe(owner('worker.cs').parent)
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
