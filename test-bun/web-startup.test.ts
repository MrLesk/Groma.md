import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { EMPTY_WORK_SNAPSHOT, type WorkSource } from '@groma/work-source'
import { writeScannerConfig } from '../src/scanner/modules/config.ts'
import { startWebViewer } from '../src/viewers/web/server.ts'
import { loadProjectProfile } from '../src/project-profile.ts'
import { createScannerSession } from '../src/scanner/session.ts'

function emptyWorkSource(): WorkSource {
  return {
    async read() { return EMPTY_WORK_SNAPSHOT },
    async readItem() { throw new Error('No work items in this fixture') },
    watch() { return { close() {} } },
  }
}

async function startupPhases(url: string) {
  const response = await fetch(`${url}/startup-events`)
  expect(response.headers.get('content-type')).toContain('text/event-stream')
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  const phases: string[] = []
  const listeners = new Map<string, () => void>()
  const reading = (async () => {
    let buffer = ''
    while (true) {
      const { value, done } = await reader.read()
      if (done) return
      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop()!
      for (const event of events) {
        const phase: string = JSON.parse(event.slice('data: '.length)).phase
        phases.push(phase)
        listeners.get(phase)?.()
      }
    }
  })()
  return {
    phases,
    async waitFor(phase: string) {
      if (!phases.includes(phase)) await new Promise<void>(resolve => listeners.set(phase, resolve))
    },
    async close() { await reader.cancel(); await reading },
  }
}

async function worldNamed(response: Response, name: string) {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) throw new Error('World events ended before the source update')
      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop()!
      for (const event of events) {
        if (!event.startsWith('event: world\n')) continue
        const { world } = JSON.parse(event.slice(event.indexOf('data: ') + 'data: '.length))
        if (world.elements.some((element: { title: string }) => element.title === name)) return
      }
    }
  } finally {
    await reader.cancel()
  }
}

for (const findsComponents of [true, false]) {
  test.concurrent(`web startup waits for a scan with ${findsComponents ? 'components' : 'no components'} before opening the map`, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'groma-startup-'))
    const scanning = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const listening = Promise.withResolvers<string>()
    let scans = 0
    const gate = Bun.serve({ port: 0, async fetch() {
      scans++
      scanning.resolve()
      await release.promise
      return new Response(null, { status: 204 })
    } })
    let opening: ReturnType<typeof startWebViewer> | undefined
    let progress: Awaited<ReturnType<typeof startupPhases>> | undefined
    try {
      await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
      const git = Bun.spawn(['git', 'init', '--quiet', root], { stdout: 'ignore', stderr: 'pipe' })
      expect(await git.exited).toBe(0)
      await mkdir(path.join(root, 'plugin'))
      await writeFile(path.join(root, 'source.fixture'), 'Fixture')
      await writeFile(path.join(root, 'plugin/package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0',
        groma: { scanner: { id: 'fixture', entry: './index.ts' } } }))
      await writeFile(path.join(root, 'plugin/index.ts'), `export default {
        id: 'fixture', watch: { include: ['**/*.fixture'], exclude: [] }, async scan(root) {
          await fetch('http://localhost:${gate.port}')
          if (${!findsComponents}) return undefined
          const files = await Array.fromAsync(new Bun.Glob('*.fixture').scan({ cwd: root }))
          return { scanner: { id: 'fixture', technology: 'fixture', engine: 'fixture', engineVersion: '1' }, diagnostics: [],
            roots: [{ id: 'root', name: 'Fixture', kind: 'package', file: 'package.json' }],
            files: files.map(file => ({ file, roots: ['root'], symbols: [{ id: 'entry', kind: 'function', name: 'entry' }] })) }
        }
      }`)
      await writeScannerConfig(root, { scanners: [{ id: 'fixture', source: './plugin' }] })
      opening = startWebViewer(root, { port: 0, scan: true, workSource: emptyWorkSource(), onListening: listening.resolve })
      const url = await listening.promise
      progress = await startupPhases(url)
      await scanning.promise
      await progress.waitFor('scanning')
      expect(progress.phases).not.toContain('preparing-map')
      expect(progress.phases).not.toContain('opening-map')
      const loading = await (await fetch(url)).text()
      expect(loading).toContain('aria-busy="true"')
      expect(loading).not.toContain('id="empty"')
      expect(loading).not.toContain('id="world"')
      release.resolve()
      const viewer = await opening
      await progress.waitFor('opening-map')
      const afterScan = progress.phases.slice(progress.phases.indexOf('scanning'))
      expect(afterScan).toEqual(findsComponents
        ? ['scanning', 'updating-architecture', 'loading-architecture', 'preparing-map', 'opening-map']
        : ['scanning', 'loading-architecture', 'preparing-map', 'opening-map'])
      expect(progress.phases.filter(phase => phase === 'preparing-map')).toHaveLength(1)
      expect((await fetch(`${viewer.url}/ready`)).status).toBe(204)
      const { world } = await (await fetch(`${viewer.url}/world.json`)).json()
      expect(world.elements.some((element: { kind: string }) => element.kind === 'component')).toBe(findsComponents)
      if (findsComponents) {
        const updated = worldNamed(await fetch(`${viewer.url}/events`), 'Updated')
        await writeFile(path.join(root, 'updated.fixture'), 'function updated() {}')
        await updated
        await progress.close()
        progress = undefined
        await viewer.close()
        const previousScans = scans
        opening = startWebViewer(root, { port: 0, scan: false, workSource: emptyWorkSource() })
        const savedViewer = await opening
        const saved = await (await fetch(`${savedViewer.url}/world.json`)).json()
        expect(saved.world.elements.some((element: { title: string }) => element.title === 'Updated')).toBe(true)
        expect(scans).toBe(previousScans)
      }
    } finally {
      release.resolve()
      await progress?.close()
      await (await opening)?.close()
      await gate.stop(true)
      await rm(root, { recursive: true, force: true })
    }
  })
}

test.concurrent('setup reports its real work and readiness waits for initialization before scanner selection', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-setup-progress-'))
  const creating = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  let viewer: Awaited<ReturnType<typeof startWebViewer>> | undefined
  let progress: Awaited<ReturnType<typeof startupPhases>> | undefined
  let initialize: Promise<Response> | undefined
  try {
    await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
    await rm(path.join(root, 'groma'), { recursive: true })
    const git = Bun.spawn(['git', 'init', '--quiet', root], { stdout: 'ignore', stderr: 'pipe' })
    expect(await git.exited).toBe(0)
    viewer = await startWebViewer(root, {
      port: 0, workSource: emptyWorkSource(), initDependencies: {
        async gitInitialized() { creating.resolve(); await release.promise; return true },
        backlogAvailable: () => false,
      },
    })
    const watching = startupPhases(viewer.url)
    initialize = fetch(`${viewer.url}/initialize`, {
      method: 'POST', redirect: 'manual', body: new URLSearchParams({ projectName: 'Example', directory: 'groma' }),
    })
    progress = await watching
    await creating.promise
    await progress.waitFor('creating-project')
    let ready = false
    const waiting = fetch(`${viewer.url}/ready`).then(response => { ready = true; return response })
    await fetch(viewer.url)
    expect(ready).toBe(false)
    release.resolve()
    expect((await initialize).status).toBe(303)
    expect((await waiting).status).toBe(204)
    await progress.waitFor('finding-scanners')
    expect((await loadProjectProfile(root))?.title).toBe('Example')
    const scan = await fetch(`${viewer.url}/scanners`, { method: 'POST', redirect: 'manual', body: new FormData() })
    expect(scan.status).toBe(303)
    await progress.waitFor('opening-map')
    expect(progress.phases).not.toContain('installing-scanners')
    expect(progress.phases).not.toContain('scanning')
    expect(progress.phases).not.toContain('updating-architecture')
    const { world } = await (await fetch(`${viewer.url}/world.json`)).json()
    expect(world.elements).toEqual([])
  } finally {
    release.resolve()
    await initialize
    await progress?.close()
    await viewer?.close()
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('startup does not report scanning when every selected source is excluded', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-excluded-startup-'))
  let session: Awaited<ReturnType<typeof createScannerSession>> | undefined
  try {
    await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
    await mkdir(path.join(root, 'plugin'))
    await writeFile(path.join(root, 'source.fixture'), 'source')
    await writeFile(path.join(root, 'plugin/package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0',
      groma: { scanner: { id: 'fixture', entry: './index.ts' } } }))
    await writeFile(path.join(root, 'plugin/index.ts'), `export default {
      id: 'fixture', watch: { include: ['**/*.fixture'], exclude: [] },
      async listSourceFiles() { return ['source.fixture'] },
      async scan() { throw new Error('Excluded sources must not be scanned') },
    }`)
    await writeScannerConfig(root, { scanners: [{ id: 'fixture', source: './plugin' }], exclude: ['*.fixture'] })
    const phases: string[] = []
    session = await createScannerSession(root, { scan: true, onProgress: phase => phases.push(phase) })
    await session.ready
    expect(phases).toEqual(['preparing-scanners'])
  } finally {
    await session?.close()
    await rm(root, { recursive: true, force: true })
  }
})
