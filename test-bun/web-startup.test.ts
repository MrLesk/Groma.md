import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
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

test.concurrent('a new empty project opens successfully and gains components through the live scan', async () => {
  const root = await repository()
  const server = await startWebViewer(root, { port: 0, scan: true, workSource: EMPTY_WORK_SOURCE })
  try {
    assert.equal((await initialize(server.url, 'groma')).status, 303)
    assert.equal(gromaInitialization(root).initialized, true)
    assert.equal(hasComponents((await payload(server.url)).world), false)

    await cp(path.join(fixtures, 'startup-source'), root, { recursive: true })
    const deadline = Date.now() + 5000
    let current = await payload(server.url)
    while (!hasComponents(current.world) && Date.now() < deadline) {
      await Bun.sleep(50)
      current = await payload(server.url)
    }
    assert.equal(hasComponents(current.world), true)
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
    await assert.rejects(readFile(path.join(root, 'AGENTS.md')))
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
