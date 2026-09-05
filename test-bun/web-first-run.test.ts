import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'

import { hasComponents, isEmptyWorld } from '../src/empty-world.ts'
import type { ArchitectureWorld } from '../src/types.ts'
import { startWebViewer } from '../src/viewers/web/server.ts'
import { repositoryRoot } from './helpers.ts'

const fixtureRoot = path.join(repositoryRoot, 'test', 'fixtures', 'empty-project')

function run(command: string, args: string[], cwd: string) {
  return new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', reject)
    child.on('close', code => resolve({ code, stderr }))
  })
}

/** A freshly initialized repository: the profile exists and the map has nothing to draw. */
async function createEmptyRepo(commit = true): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-web-empty-'))
  await cp(fixtureRoot, root, { recursive: true })
  assert.equal((await run('git', ['init'], root)).code, 0)
  if (!commit) return root
  assert.equal((await run('git', ['add', '.'], root)).code, 0)
  const committed = await run('git', [
    '-c', 'user.name=Groma Test',
    '-c', 'user.email=groma@example.test',
    'commit', '-m', 'Initial project',
  ], root)
  assert.equal(committed.code, 0, committed.stderr)
  return root
}

async function draft(url: string, input: Record<string, string>): Promise<Response> {
  return fetch(`${url}/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

test.concurrent('drafting from an empty world preserves draft architecture until components exist', async () => {
  const root = await createEmptyRepo()
  const server = await startWebViewer(root, { port: 0 })
  try {
    const empty = await (await fetch(`${server.url}/world.json`)).json() as { world: ArchitectureWorld }
    assert.equal(isEmptyWorld(empty.world), true)
    assert.equal(hasComponents(empty.world), false)

    const drafted = await draft(server.url, { kind: 'system', name: 'Shop', overview: 'Sells goods.' })
    assert.equal(drafted.status, 200)
    assert.deepEqual(await drafted.json(), { id: 'shop' })
    const world = await (await fetch(`${server.url}/world.json`)).json() as {
      generation: number
      world: ArchitectureWorld
    }
    assert.deepEqual(world.world.elements.map(element => [element.id, element.origin]), [['shop', 'draft']])
    assert.equal(isEmptyWorld(world.world), false)
    assert.equal(hasComponents(world.world), false)
    const history = await (await fetch(`${server.url}/world.json`)).json() as { revisions: { id: string }[] }
    const historical = await (await fetch(`${server.url}/world.json?revision=${history.revisions[0]!.id}`)).json() as { world: ArchitectureWorld }
    assert.equal(isEmptyWorld(historical.world), true)
  } finally {
    await server.close()
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('a refused draft answers with the CLI sentence and writes nothing', async () => {
  const root = await createEmptyRepo()
  const server = await startWebViewer(root, { port: 0 })
  try {
    const refused = await draft(server.url, { kind: 'actor', name: 'Bob', overview: 'Buys.' })
    assert.equal(refused.status, 400)
    assert.equal(await refused.text(), 'kind must be system, container or component')
    const world = await (await fetch(`${server.url}/world.json`)).json() as { world: { elements: unknown[] } }
    assert.deepEqual(world.world.elements, [])
  } finally {
    await server.close()
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('a repository with no commit yet serves the invitation with an empty history', async () => {
  const root = await createEmptyRepo(false)
  const server = await startWebViewer(root, { port: 0 })
  try {
    const payload = await (await fetch(`${server.url}/world.json`)).json() as {
      revisions: unknown[]
      world: { elements: unknown[] }
    }
    assert.deepEqual(payload.revisions, [])
    assert.deepEqual(payload.world.elements, [])
  } finally {
    await server.close()
    await rm(root, { recursive: true, force: true })
  }
})
