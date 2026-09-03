import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'

import { startWebViewer } from '../src/viewers/web/server.ts'
import { repositoryRoot } from './helpers.ts'

const fixtureRoot = path.join(repositoryRoot, 'test', 'fixtures', 'plain-view')

function run(command: string, args: string[], root: string): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'ignore' })
    child.on('error', reject)
    child.on('close', resolve)
  })
}

const gitInit = (root: string) => run('git', ['init'], root)
const cli = path.join(repositoryRoot, 'src', 'cli.ts')
/** Relations have no web verb yet, so the fixture is wired through the CLI. */
const relate = (root: string, source: string, target: string) => run('bun', [
  cli, 'relate', source, target, '--description', 'Asks before placing', '--technology', 'Function call',
], root)

async function createRepo(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-web-authoring-'))
  await cp(fixtureRoot, root, { recursive: true })
  assert.equal(await gitInit(root), 0)
  return root
}

async function post(url: string, verb: string, input: unknown): Promise<Response> {
  return fetch(`${url}/${verb}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

async function elementIds(url: string): Promise<string[]> {
  const payload = await (await fetch(`${url}/world.json`)).json() as { world: { elements: { id: string }[] } }
  return payload.world.elements.map(element => element.id)
}

test.concurrent('the web adds and removes through the same verbs as the CLI', async () => {
  const root = await createRepo()
  const server = await startWebViewer(root, { port: 0 })
  try {
    assert.match(await (await fetch(server.url)).text(), /id="add"/)

    const added = await post(server.url, 'add', { thing: 'actor', name: 'Support agent', overview: 'Answers tickets.' })
    assert.equal(added.status, 200)
    assert.deepEqual(await added.json(), { id: 'support-agent' })
    assert.ok((await elementIds(server.url)).includes('support-agent'))

    const removed = await post(server.url, 'remove', { id: 'support-agent' })
    assert.equal(removed.status, 200)
    assert.deepEqual(await removed.json(), { id: 'support-agent' })
    assert.ok(!(await elementIds(server.url)).includes('support-agent'))
  } finally {
    await server.close()
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('a refused write answers with the CLI sentence and changes nothing', async () => {
  const root = await createRepo()
  const server = await startWebViewer(root, { port: 0 })
  try {
    const before = await elementIds(server.url)
    const scanned = await post(server.url, 'add', { thing: 'component', name: 'Pricing', overview: 'Prices goods.' })
    assert.equal(scanned.status, 400)
    assert.equal(await scanned.text(), 'components are found by the scanner. To draft one, run: groma draft component "Pricing" --parent <container-id>')

    const owned = await post(server.url, 'remove', { id: 'orders' })
    assert.equal(owned.status, 400)
    assert.equal(await owned.text(), 'orders is found by the scanner; remove its code or combine it instead')
    assert.deepEqual(await elementIds(server.url), before)

    assert.equal((await post(server.url, 'draft', {
      kind: 'component', name: 'Stock check', parent: 'api', overview: 'Checks stock levels.',
    })).status, 200)
    assert.equal(await relate(root, 'orders', 'stock-check'), 0)
    const related = await post(server.url, 'remove', { id: 'stock-check' })
    assert.equal(related.status, 400)
    assert.equal(await related.text(), 'cannot remove stock-check: orders relate to it')
  } finally {
    await server.close()
    await rm(root, { recursive: true, force: true })
  }
})
