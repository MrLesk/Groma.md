import assert from 'node:assert/strict'
import { access, cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { test } from 'bun:test'
import { EMPTY_WORK_SOURCE } from '@groma/work-source'

import { hasComponents } from '../src/empty-world.ts'
import { gromaInitialization } from '../src/initialize.ts'
import { loadProjectProfile } from '../src/project-profile.ts'
import type { WebPayload } from '../src/viewers/web/payload.ts'
import { startWebViewer } from '../src/viewers/web/server.ts'
import { repositoryRoot } from './helpers.ts'

const fixtures = path.join(repositoryRoot, 'test', 'fixtures')

async function repository(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-startup-'))
  const child = Bun.spawn(['git', 'init', '--quiet'], { cwd: root, stdout: 'ignore', stderr: 'pipe' })
  assert.equal(await child.exited, 0, await new Response(child.stderr).text())
  return root
}

function initialize(url: string, directory: string, projectName = 'First project'): Promise<Response> {
  return fetch(`${url}/initialize`, {
    method: 'POST',
    body: new URLSearchParams({ projectName, directory }),
    redirect: 'manual',
  })
}

async function payload(url: string): Promise<WebPayload> {
  return (await fetch(`${url}/world.json`)).json() as Promise<WebPayload>
}

/** A separate scanner module per repository keeps startup paused without global mocks or timers. */
async function pausedStartup() {
  const root = await repository()
  await cp(path.join(fixtures, 'empty-project'), root, { recursive: true })
  const plugin = path.join(root, 'paused-scanner')
  await mkdir(plugin)
  await writeFile(path.join(plugin, 'package.json'), JSON.stringify({
    name: 'paused-scanner', version: '1.0.0', type: 'module',
    groma: { scanner: { id: 'paused', entry: './index.js' } },
  }))
  await writeFile(path.join(plugin, 'index.js'), `
const start = Promise.withResolvers();
const finish = Promise.withResolvers();
export const started = start.promise;
export const complete = finish.resolve;
export default {
  id: 'paused', matchesFile: () => false,
  async scan() {
    start.resolve();
    const error = await finish.promise;
    if (error) throw new Error(error);
  },
};
`)
  await writeFile(path.join(root, 'groma/scanners.json'), JSON.stringify({
    scanners: [{ id: 'paused', source: './paused-scanner' }],
  }))
  const scanner = await import(pathToFileURL(path.join(plugin, 'index.js')).href) as {
    started: Promise<void>; complete(error?: string): void;
  }
  const reservation = Bun.serve({ port: 0, fetch: () => new Response() })
  const port = reservation.port
  await reservation.stop(true)
  const startup = startWebViewer(root, { port, scan: true, workSource: EMPTY_WORK_SOURCE })
  await scanner.started
  return {
    url: `http://localhost:${port}`, complete: scanner.complete,
    async close() {
      scanner.complete()
      await (await startup).close()
      await rm(root, { recursive: true, force: true })
    },
  }
}

test.concurrent('an early browser request waits on startup before opening the ready map', async () => {
  const pending = await pausedStartup()
  try {
    const response = await fetch(pending.url)
    assert.equal(response.status, 200)
    const html = await response.text()
    assert.match(html, /<main aria-busy="true"/)
    assert.doesNotMatch(html, /role="alert"|<form/)
    let ready = false
    const readiness = fetch(`${pending.url}/ready`).then(response => {
      ready = true
      return response
    })
    await fetch(pending.url)
    assert.equal(ready, false)
    pending.complete()
    assert.equal((await readiness).status, 204)
    assert.equal((await payload(pending.url)).world.elements.length, 0)
  } finally {
    await pending.close()
  }
})

test.concurrent('a loading browser reaches the actual failure when startup rejects', async () => {
  const pending = await pausedStartup()
  try {
    const readiness = fetch(`${pending.url}/ready`)
    pending.complete('Paused scanner failed')
    assert.equal((await readiness).status, 500)
    const response = await fetch(pending.url)
    assert.equal(response.status, 500)
    const html = await response.text()
    assert.match(html, /Paused scanner failed/)
    assert.doesNotMatch(html, /<main aria-busy="true"/)
  } finally {
    await pending.close()
  }
})

test.concurrent('browser setup completes missing records in an existing folder and scans before entering the map', async () => {
  const root = await repository()
  await cp(path.join(fixtures, 'startup-source'), root, { recursive: true })
  await mkdir(path.join(root, '.groma'))
  const server = await startWebViewer(root, { port: 0, scan: true, workSource: EMPTY_WORK_SOURCE })
  try {
    assert.equal(gromaInitialization(root).initialized, false)
    assert.equal((await fetch(server.url)).status, 200)

    const result = await initialize(server.url, '.groma')
    assert.equal(result.status, 303, await result.text())
    assert.equal(result.headers.get('location'), '/')
    assert.equal(gromaInitialization(root).initialized, true)
    assert.equal((await loadProjectProfile(root))?.title, 'First project')
    assert.match(await readFile(path.join(root, 'AGENTS.md'), 'utf8'), /groma agent-instructions/)
    const world = (await payload(server.url)).world
    const components = world.elements.filter(element => element.kind === 'component')
    assert.equal(components.length, 1)
    assert.equal(components[0]?.code?.[0]?.file, 'src/main.ts')
    assert.equal(components[0]?.origin, 'observed')
  } finally {
    await server.close()
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('browser setup reuses shared initialization and creates Git first', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-web-git-init-'))
  let backlogInitializations = 0
  const server = await startWebViewer(root, {
    port: 0,
    scan: true,
    workSource: EMPTY_WORK_SOURCE,
    initDependencies: {
      backlogAvailable: () => true,
      backlogInitialized: async () => false,
      initializeBacklog: async () => {
        backlogInitializations += 1
        return true
      },
    },
  })
  try {
    const result = await initialize(server.url, 'groma', 'Web Git project')
    assert.equal(result.status, 303, await result.text())
    await access(path.join(root, '.git'))
    assert.equal(gromaInitialization(root).initialized, true)
    assert.equal((await loadProjectProfile(root))?.title, 'Web Git project')
    assert.equal(backlogInitializations, 1)
  } finally {
    await server.close()
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('a new empty project opens successfully and gains components through the live scan', async () => {
  const root = await repository()
  await mkdir(path.join(root, 'src'))
  await cp(path.join(fixtures, 'startup-source', 'package.json'), path.join(root, 'package.json'))
  const server = await startWebViewer(root, { port: 0, scan: true, workSource: EMPTY_WORK_SOURCE })
  try {
    assert.equal((await initialize(server.url, 'groma')).status, 303)
    assert.equal(gromaInitialization(root).initialized, true)
    assert.equal(hasComponents((await payload(server.url)).world), false)

    const source = await readFile(path.join(fixtures, 'startup-source', 'src', 'main.ts'), 'utf8')
    await writeFile(path.join(root, 'src', 'main.ts'), source)
    const deadline = Date.now() + 5000
    let current = await payload(server.url)
    while (!hasComponents(current.world) && Date.now() < deadline) {
      await Bun.sleep(50)
      current = await payload(server.url)
    }
    // On failure, tell apart a missed source event (no fold) from a fold whose world was never published.
    const folded = await readdir(path.join(root, 'groma'), { recursive: true })
    assert.equal(hasComponents(current.world), true, `generation ${current.generation}; groma/ holds ${folded.join(', ')}`)
    assert.ok(current.generation > 1)
  } finally {
    await server.close()
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('invalid setup input does not initialize or scan the repository', async () => {
  const root = await repository()
  const server = await startWebViewer(root, { port: 0, workSource: EMPTY_WORK_SOURCE })
  try {
    const result = await initialize(server.url, 'groma', '')
    assert.equal(result.status, 400)
    assert.equal(gromaInitialization(root).initialized, false)
    await assert.rejects(readFile(path.join(root, 'AGENTS.md')), { code: 'ENOENT' })
  } finally {
    await server.close()
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('a failed automatic scan serves an error instead of an empty architecture', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-startup-failure-'))
  await cp(path.join(fixtures, 'empty-project'), root, { recursive: true })
  const server = await startWebViewer(root, { port: 0, scan: true, workSource: EMPTY_WORK_SOURCE })
  try {
    const response = await fetch(server.url)
    assert.equal(response.status, 500)
    assert.doesNotMatch(await response.text(), /\n\s+at /)
  } finally {
    await server.close()
    await rm(root, { recursive: true, force: true })
  }
})
