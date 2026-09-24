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

interface StartupEvent {
  phase: string
  scanners?: string[]
  scannerNames?: string[]
}

async function startupEvents(url: string) {
  const response = await fetch(`${url}/startup-events`)
  expect(response.headers.get('content-type')).toContain('text/event-stream')
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  const phases: string[] = []
  const updates: StartupEvent[] = []
  const listeners = new Set<(update: StartupEvent) => void>()
  const reading = (async () => {
    let buffer = ''
    while (true) {
      const { value, done } = await reader.read()
      if (done) return
      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop()!
      for (const event of events) {
        const update: StartupEvent = JSON.parse(event.slice('data: '.length))
        phases.push(update.phase)
        updates.push(update)
        for (const listener of listeners) listener(update)
      }
    }
  })()
  return {
    phases,
    updates,
    async waitFor(matching: string | ((update: StartupEvent) => boolean)) {
      const matches = typeof matching === 'string' ? (update: StartupEvent) => update.phase === matching : matching
      const observed = updates.find(matches)
      if (observed) return observed
      return await new Promise<StartupEvent>(resolve => {
        const listener = (update: StartupEvent) => {
          if (!matches(update)) return
          listeners.delete(listener)
          resolve(update)
        }
        listeners.add(listener)
      })
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
  test.concurrent(`web startup tracks active scanners before opening a map with ${findsComponents ? 'components' : 'no components'}`, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'groma-startup-'))
    const scanning = Promise.withResolvers<void>()
    const companionScanning = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const releaseCompanion = Promise.withResolvers<void>()
    const listening = Promise.withResolvers<string>()
    let scans = 0
    const gate = Bun.serve({ port: 0, async fetch(request) {
      if (new URL(request.url).pathname === '/companion') {
        companionScanning.resolve()
        await releaseCompanion.promise
      } else {
        scans++
        scanning.resolve()
        await release.promise
      }
      return new Response(null, { status: 204 })
    } })
    let opening: ReturnType<typeof startWebViewer> | undefined
    let progress: Awaited<ReturnType<typeof startupEvents>> | undefined
    let lateProgress: Awaited<ReturnType<typeof startupEvents>> | undefined
    try {
      await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
      const git = Bun.spawn(['git', 'init', '--quiet', root], { stdout: 'ignore', stderr: 'pipe' })
      expect(await git.exited).toBe(0)
      await mkdir(path.join(root, 'plugin'))
      await writeFile(path.join(root, 'source.fixture'), 'Fixture')
      await writeFile(path.join(root, 'plugin/package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0',
        groma: { scanner: { id: 'fixture', entry: './index.ts', include: ['**/*.fixture'] } } }))
      await writeFile(path.join(root, 'plugin/index.ts'), `export default {
        id: 'fixture', async scan(root) {
          await fetch('http://localhost:${gate.port}')
          if (${!findsComponents}) return undefined
          const files = await Array.fromAsync(new Bun.Glob('*.fixture').scan({ cwd: root }))
          return { scanner: { id: 'fixture', technology: 'fixture', engine: 'fixture', engineVersion: '1' }, diagnostics: [],
            roots: [{ id: 'root', name: 'Fixture', kind: 'package', file: 'package.json' }],
            files: files.map(file => ({ file, roots: ['root'], symbols: [{ id: 'entry', kind: 'function', name: 'entry' }] })) }
        }
      }`)
      await mkdir(path.join(root, 'companion'))
      await writeFile(path.join(root, 'companion/package.json'), JSON.stringify({ name: 'companion', version: '1.0.0',
        groma: { scanner: { id: 'companion', entry: './index.ts', include: ['**/*.companion'] } } }))
      await writeFile(path.join(root, 'companion/index.ts'), `export default {
        id: 'companion', async scan() {
          await fetch('http://localhost:${gate.port}/companion')
          if (${findsComponents}) throw new Error('Fixture scanner failure')
          return undefined
        }
      }`)
      await writeScannerConfig(root, { scanners: [
        { id: 'fixture', source: './plugin', include: ['**/*.fixture'] }, { id: 'companion', source: './companion', include: ['**/*.companion'] },
      ] })
      opening = startWebViewer(root, { port: 0, scan: true, workSource: emptyWorkSource(), onListening: listening.resolve })
      const url = await listening.promise
      await Promise.all([scanning.promise, companionScanning.promise])
      progress = await startupEvents(url)
      const active = await progress.waitFor('scanning')
      expect(active.scanners?.toSorted()).toEqual(['companion', 'fixture'])
      expect(active.scannerNames?.toSorted()).toEqual(['Companion', 'Fixture'])
      releaseCompanion.resolve()
      const remaining = await progress.waitFor(update => update.phase === 'scanning' && update.scanners?.length === 1)
      expect(remaining.scanners).toEqual(['fixture'])
      expect(remaining.scannerNames).toEqual(['Fixture'])
      lateProgress = await startupEvents(url)
      const replayed = await lateProgress.waitFor('scanning')
      expect(replayed.scanners).toEqual(['fixture'])
      expect(replayed.scannerNames).toEqual(['Fixture'])
      await lateProgress.close()
      lateProgress = undefined
      expect(progress.phases).not.toContain('preparing-map')
      expect(progress.phases).not.toContain('opening-map')
      const loading = await (await fetch(url)).text()
      let loadingScanners = ''
      await new HTMLRewriter().on('[data-scanners]', {
        text(chunk) { loadingScanners += chunk.text },
      }).transform(new Response(loading)).text()
      expect(loadingScanners).toContain('Fixture')
      expect(loadingScanners).not.toContain('Companion')
      expect(loading).toContain('aria-busy="true"')
      expect(loading).not.toContain('id="empty"')
      expect(loading).not.toContain('id="world"')
      release.resolve()
      const viewer = await opening
      await progress.waitFor('opening-map')
      const afterScan = progress.phases.slice(progress.phases.lastIndexOf('scanning') + 1)
      expect(afterScan).toEqual(findsComponents
        ? ['preparing-scanners', 'updating-architecture', 'loading-architecture', 'preparing-map', 'opening-map']
        : ['preparing-scanners', 'loading-architecture', 'preparing-map', 'opening-map'])
      expect(progress.updates.filter(update => update.phase !== 'scanning').every(update => !update.scanners?.length)).toBe(true)
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
      releaseCompanion.resolve()
      await lateProgress?.close()
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
  let progress: Awaited<ReturnType<typeof startupEvents>> | undefined
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
    const watching = startupEvents(viewer.url)
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
      groma: { scanner: { id: 'fixture', entry: './index.ts', include: ['**/*.fixture'] } } }))
    await writeFile(path.join(root, 'plugin/index.ts'), `export default {
      id: 'fixture',
      async scan() { throw new Error('Excluded sources must not be scanned') },
    }`)
    expect(await Bun.spawn(['git', 'init', '--quiet', root]).exited).toBe(0)
    await writeScannerConfig(root, { scanners: [{ id: 'fixture', source: './plugin', include: ['**/*.fixture'] }], exclude: ['*.fixture'] })
    const phases: string[] = []
    session = await createScannerSession(root, { scan: true, onProgress: update => phases.push(update.phase) })
    await session.ready
    expect(phases).toEqual(['preparing-scanners'])
  } finally {
    await session?.close()
    await rm(root, { recursive: true, force: true })
  }
})
