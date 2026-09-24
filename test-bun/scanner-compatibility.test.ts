import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadAnnotatedArchitecture } from '../src/core.ts'
import { loadScannerRegistry } from '../src/scanner/registry.ts'
import { createScannerSession } from '../src/scanner/session.ts'
import { writeScannerConfig } from '../src/scanner/modules/config.ts'
import { checkScannerReadiness } from '../src/scanner/modules/readiness.ts'

async function plugin(root: string, id: string, groma: string, blocked: boolean) {
  const source = path.join(root, id)
  await mkdir(source)
  await writeFile(path.join(source, 'package.json'), JSON.stringify({ name: id, version: '1.0.0',
    groma: { scanner: { id, entry: './index.js', include: ['**/*.fixture'], discovery: {
      technologies: ['react'], rules: [{ type: 'dependency', files: ['**/package.json'], technology: 'react', kind: 'framework', package: 'react' }],
      compatibility: { groma },
    } } },
  }))
  await writeFile(path.join(source, 'index.js'), blocked ? 'throw new Error("Incompatible plugin was imported")' : `
    import { appendFile } from 'node:fs/promises';
    export default { id: '${id}',
      async scan(root) { await appendFile(root + '/calls.txt', 'x'); return undefined } }`)
  return { id, source, include: ['**/*.fixture'] }
}

test.concurrent('a Groma mismatch blocks plugin code while another selection can scan', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'groma-compatibility-'))
    let session: Awaited<ReturnType<typeof createScannerSession>> | undefined
    try {
      await cp(path.resolve(import.meta.dir, '../test/fixtures/flows'), root, { recursive: true })
      const git = Bun.spawn(['git', 'init', '--quiet', root], { stdout: 'ignore', stderr: 'pipe' })
      expect(await git.exited).toBe(0)
      await writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: { react: '19.0.0' } }))
      const blocked = await plugin(root, 'blocked', '>=99.0.0', true)
      const eligible = await plugin(root, 'eligible', '*', false)
      await writeScannerConfig(root, { scanners: [blocked, eligible] })
      const before = await loadAnnotatedArchitecture(root)
      const registry = await loadScannerRegistry(root)
      expect(registry.scannerIds).toEqual(['eligible'])
      await registry.collectObservations(root)
      await registry.collectObservations(root, ['changed.fixture'])
      expect((await readFile(path.join(root, 'calls.txt'), 'utf8'))).toHaveLength(2)
      const checks = await checkScannerReadiness(root)
      expect(checks.find(item => item.id === 'blocked')?.project).toBe('blocked')
      session = await createScannerSession(root)
      await session.reconfigure()
      await session.change({ action: 'retry' })
      expect((await readFile(path.join(root, 'calls.txt'), 'utf8'))).toHaveLength(4)
      expect(session.state.scanners.find(item => item.id === 'blocked')?.status).toBe('blocked')
      await session.change({ action: 'remove', id: 'eligible' })
      expect((await loadScannerRegistry(root)).scannerIds).toEqual([])
      expect((await loadAnnotatedArchitecture(root)).elements).toEqual(before.elements)
      expect((await loadAnnotatedArchitecture(root)).relationships).toEqual(before.relationships)
    } finally { await session?.close(); await rm(root, { recursive: true, force: true }) }
  })
