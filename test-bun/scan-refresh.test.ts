import { expect, test } from 'bun:test'
import { cp, mkdtemp, rm, stat, utimes } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { createScanObservation } from '@groma/scanner'
import { loadArchitecture } from '../src/architecture-reader.ts'
import { reconcileScanObservations } from '../src/scan-reconciler.ts'

test.concurrent('scan refresh writes only changed evidence and preserves its summary', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-scan-refresh-'))
  try {
    await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
    const observation = createScanObservation({
      scanner: { language: 'typescript', engine: 'fixture', engineVersion: '1' },
      root: { kind: 'package', name: 'Fixture', file: 'package.json' },
      scopes: [{ id: 'scope', name: 'Service' }],
      files: [{ file: 'worker.ts', symbols: [] }],
      placements: [{ file: 'worker.ts', scope: 'scope' }],
      relationships: [],
      diagnostics: [],
    })
    await reconcileScanObservations(root, [observation])
    const records = await loadArchitecture(root)
    const component = records.documents.find(document => document.frontmatter.type === 'C4 Component')!
    const filename = path.join(root, component.sourceFilename)
    const before = new Date('2000-01-01T00:00:00Z')
    await utimes(filename, before, before)

    expect(await reconcileScanObservations(root, [observation]))
      .toEqual({ created: 0, refreshed: 1, matched: 0 })
    expect((await stat(filename)).mtimeMs).toBe(before.getTime())

    const changed = createScanObservation({
      ...observation,
      files: [{ file: 'worker.ts', symbols: [{ id: 'worker.ts#run', name: 'run', kind: 'function' }] }],
    })
    await reconcileScanObservations(root, [changed])
    expect((await stat(filename)).mtimeMs).toBeGreaterThan(before.getTime())
    const refreshed = await loadArchitecture(root)
    const saved = refreshed.documents.find(document => document.sourceFilename === component.sourceFilename)!
    expect((saved.frontmatter.groma as { code: { symbol?: string }[] }).code[0]?.symbol).toBe('run')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
