import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { EMPTY_WORK_SNAPSHOT, type WorkSource } from '@groma/work-source'
import { writeScannerConfig } from '../src/scanner/modules/config.ts'
import { startWebViewer } from '../src/viewers/web/server.ts'

for (const findsComponents of [true, false]) {
  test.concurrent(`web startup waits for a scan with ${findsComponents ? 'components' : 'no components'} before opening the map`, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'groma-startup-'))
    const scanning = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const listening = Promise.withResolvers<string>()
    const gate = Bun.serve({ port: 0, async fetch() {
      scanning.resolve()
      await release.promise
      return new Response(null, { status: 204 })
    } })
    let opening: ReturnType<typeof startWebViewer> | undefined
    try {
      await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
      const git = Bun.spawn(['git', 'init', '--quiet', root], { stdout: 'ignore', stderr: 'pipe' })
      expect(await git.exited).toBe(0)
      await mkdir(path.join(root, 'plugin'))
      await writeFile(path.join(root, 'source.fixture'), 'function entry() {}')
      await writeFile(path.join(root, 'plugin/package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0',
        groma: { scanner: { id: 'fixture', entry: './index.ts' } } }))
      await writeFile(path.join(root, 'plugin/index.ts'), `export default {
        id: 'fixture', watch: { include: ['**/*.fixture'], exclude: [] }, async scan() {
          await fetch('http://localhost:${gate.port}')
          if (${!findsComponents}) return undefined
          return { scanner: { id: 'fixture', technology: 'fixture', engine: 'fixture', engineVersion: '1' }, diagnostics: [],
            roots: [{ id: 'root', name: 'Fixture', kind: 'package', file: 'package.json' }],
            files: [{ file: 'source.fixture', roots: ['root'], symbols: [{ id: 'entry', kind: 'function', name: 'entry' }] }] }
        }
      }`)
      await writeScannerConfig(root, { scanners: [{ id: 'fixture', source: './plugin' }] })
      const workSource: WorkSource = {
        async read() { return EMPTY_WORK_SNAPSHOT },
        async readItem() { throw new Error('No work items in this fixture') },
        watch() { return { close() {} } },
      }
      opening = startWebViewer(root, { port: 0, scan: true, workSource, onListening: listening.resolve })
      const url = await listening.promise
      await scanning.promise
      const loading = await (await fetch(url)).text()
      expect(loading).toContain('aria-busy="true"')
      expect(loading).not.toContain('id="empty"')
      expect(loading).not.toContain('id="world"')
      release.resolve()
      const viewer = await opening
      expect((await fetch(`${viewer.url}/ready`)).status).toBe(204)
      const { world } = await (await fetch(`${viewer.url}/world.json`)).json()
      expect(world.elements.some((element: { kind: string }) => element.kind === 'component')).toBe(findsComponents)
    } finally {
      release.resolve()
      await (await opening)?.close()
      await gate.stop(true)
      await rm(root, { recursive: true, force: true })
    }
  })
}
