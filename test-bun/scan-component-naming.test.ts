import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createScanObservation } from '@groma/scanner'

import { loadArchitecture } from '../src/architecture-reader.ts'
import { draftElement } from '../src/draft.ts'
import { componentNames } from '../src/scan-component-naming.ts'
import { reconcileScanObservations } from '../src/scan-reconciler.ts'

function names(files: string[], occupied: string[] = []) {
  return componentNames(files.map(file => ({ file, parent: 'scanner' })), new Set(occupied))
}

function observation(files: string[], language = 'fixture') {
  const scan = createScanObservation({
    scanner: { language, engine: 'fixture', engineVersion: '1' },
    root: { kind: 'package', name: 'Example', file: 'package.json' },
    scopes: [{ id: 'scope', name: 'Scanner' }],
    files: files.map(file => ({ file, symbols: [] })),
    placements: files.map(file => ({ file, scope: 'scope' })),
    relationships: [], diagnostics: [],
  })
  // Exercise the reconciler independently of contract sorting.
  scan.files.reverse()
  return scan
}

async function repository(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-component-naming-'))
  await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
  return root
}

async function components(root: string) {
  return (await loadArchitecture(root)).documents.flatMap(document => {
    if (document.frontmatter.type !== 'C4 Component') return []
    const groma = document.frontmatter.groma as {
      id: string; code?: { file: string; scanner: string }[]
    }
    return [{ ...groma, title: document.frontmatter.title, status: document.frontmatter.status }]
  })
}

test.concurrent('source context separates repeated roles as a batch before a hash', () => {
  const files = ['vue', 'react', 'java'].map(language => `plugins/scanners/${language}/build.ts`)
  for (const order of [files, [...files].reverse()]) {
    const allocated = names(order)
    for (const language of ['vue', 'react', 'java']) {
      expect(allocated.get(`plugins/scanners/${language}/build.ts`)?.id).toBe(`${language}-scanner-build`)
    }
  }
  const nested = ['first/src/build.ts', 'second/src/build.ts']
  expect([...names(nested).values()].map(value => value.id)).toEqual([
    'first-src-scanner-build', 'second-src-scanner-build',
  ])
  expect(names(['unique.ts']).get('unique.ts')?.id).toBe('unique')
  expect(names(['src/index.ts']).get('src/index.ts')?.id).toBe('scanner-index')
})

test.concurrent('normalized collisions hash exact paths including extensions and preserve readable titles', () => {
  const files = ['same/Thing.ts', 'same/thing.ts', 'same/thing.js', 'same/thing!.ts']
  const allocated = names(files)
  for (const file of files) {
    const suffix = createHash('sha256').update(file).digest('hex').slice(0, 8)
    expect(allocated.get(file)).toEqual({ id: `same-scanner-thing-${suffix}`, name: 'Same scanner thing' })
  }
  expect(names([...files].reverse())).toEqual(allocated)
})

test.concurrent('matching short hashes extend together and avoid occupied IDs', () => {
  // These exact paths share their first eight SHA-256 digits.
  const files = ['same/item.ext8508', 'same/item.ext36832']
  const allocated = names(files)
  for (const file of files) {
    const hash = createHash('sha256').update(file).digest('hex')
    expect(allocated.get(file)?.id).toBe(`same-scanner-item-${hash.slice(0, 9)}`)
  }
  const file = files[0]!
  const hash = createHash('sha256').update(file).digest('hex')
  const occupied = ['item', 'scanner-item', 'same-scanner-item', `same-scanner-item-${hash.slice(0, 8)}`]
  expect(names([file], occupied).get(file)?.id).toBe(`same-scanner-item-${hash.slice(0, 9)}`)
})

test.concurrent('file and scanner order share one owner and preserve IDs on later scans', async () => {
  const files = ['vue', 'react', 'java'].map(language => `plugins/scanners/${language}/build.ts`)
  const roots = await Promise.all([repository(), repository()])
  try {
    const scans = [observation(files.slice(0, 2), 'one'), observation(files.slice(1).reverse(), 'two')]
    await reconcileScanObservations(roots[0]!, scans)
    await reconcileScanObservations(roots[1]!, [...scans].reverse())
    const initial = await components(roots[0]!)
    expect(await components(roots[1]!)).toEqual(initial)
    expect(initial).toHaveLength(3)
    expect(initial.find(item => item.id === 'react-scanner-build')?.code).toHaveLength(2)
    for (const language of ['vue', 'react', 'java']) {
      expect(initial.find(item => item.id === `${language}-scanner-build`)?.code?.[0]?.file)
        .toBe(`plugins/scanners/${language}/build.ts`)
    }
    const changed = scans.map(scan => ({ ...scan, files: scan.files.map(file => ({
      ...file, symbols: [{ id: 'changed', name: 'changed', kind: 'function' }],
    })) }))
    expect((await reconcileScanObservations(roots[0]!, changed)).created).toBe(0)
    expect((await components(roots[0]!)).map(item => item.id)).toEqual(initial.map(item => item.id))
    await reconcileScanObservations(roots[0]!, [observation(['later/build.ts'])])
    const later = await components(roots[0]!)
    expect(later.filter(item => initial.some(prior => prior.id === item.id))).toHaveLength(3)
  } finally { await Promise.all(roots.map(root => rm(root, { recursive: true, force: true }))) }
})

test.concurrent('matching a draft keeps its identity and draft status', async () => {
  const root = await repository()
  try {
    await reconcileScanObservations(root, [observation([])])
    await draftElement(root, { kind: 'component', name: 'Worker', parent: 'scanner', overview: '' })
    const summary = await reconcileScanObservations(root, [observation(['src/worker.ts'])])
    expect(summary).toEqual({ created: 0, refreshed: 0, matched: 1 })
    expect(await components(root)).toEqual([expect.objectContaining({
      id: 'worker', status: 'draft', code: [{ scanner: 'fixture', file: 'src/worker.ts' }],
    })])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('overlapping fresh scopes reuse their pending container and an existing ID wins over new collisions', async () => {
  const root = await repository()
  try {
    const first = observation(['first/build.ts'])
    const overlap = observation(['first/build.ts'], 'other')
    overlap.scopes[0]!.name = 'Other scanner'
    await reconcileScanObservations(root, [first, overlap])
    const records = await loadArchitecture(root)
    expect(records.documents.filter(document => document.frontmatter.type === 'C4 Container')).toHaveLength(1)
    const existing = (await components(root))[0]!
    expect(existing.id).toBe('build')
    expect(existing.code).toHaveLength(2)
    await reconcileScanObservations(root, [observation(['first/build.ts', 'second/build.ts'])])
    const later = await components(root)
    expect(later.find(item => item.code?.some(code => code.file === 'first/build.ts'))?.id).toBe('build')
    expect(later).toHaveLength(2)
  } finally { await rm(root, { recursive: true, force: true }) }
})
