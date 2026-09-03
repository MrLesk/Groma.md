import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'

import { startWebViewer } from '../src/viewers/web/server.ts'
import { repositoryRoot } from './helpers.ts'

const fixtureRoot = path.join(repositoryRoot, 'test', 'fixtures', 'plain-view')

/** One process run: its exit code and stdout. */
function run(command: string, args: string[], root: string): Promise<{ code: number | null; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
    let stdout = ''
    child.stdout.on('data', chunk => {
      stdout += chunk
    })
    child.on('error', reject)
    child.on('close', code => resolve({ code, stdout }))
  })
}

const gitInit = (root: string) => run('git', ['init'], root)
const cli = path.join(repositoryRoot, 'src', 'cli.ts')
const view = (id: string, root: string) => run('bun', [cli, 'view', id], root)

async function createRepo(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-web-authoring-'))
  await cp(fixtureRoot, root, { recursive: true })
  assert.equal((await gitInit(root)).code, 0)
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
    assert.equal((await post(server.url, 'add', {
      thing: 'relation', name: 'orders', relation: 'stock-check', description: 'Asks before placing', technology: 'Function call',
    })).status, 200)
    const related = await post(server.url, 'remove', { id: 'stock-check' })
    assert.equal(related.status, 400)
    assert.equal(await related.text(), 'cannot remove stock-check: orders relate to it')
  } finally {
    await server.close()
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('the web edits meaning through the edit verb', async () => {
  const root = await createRepo()
  const server = await startWebViewer(root, { port: 0 })
  try {
    const renamed = await post(server.url, 'edit', { id: 'orders', title: 'Order intake', technology: 'Bun' })
    assert.equal(renamed.status, 200)
    assert.deepEqual(await renamed.json(), { id: 'orders' })
    const payload = await (await fetch(`${server.url}/world.json`)).json() as {
      world: { elements: { id: string; title: string; technology?: string }[] }
    }
    const orders = payload.world.elements.find(element => element.id === 'orders')
    assert.equal(orders?.title, 'Order intake')
    assert.equal(orders?.technology, 'Bun')
  } finally {
    await server.close()
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('the web relates through add, edit and remove, and groma view prints the row', async () => {
  const root = await createRepo()
  const server = await startWebViewer(root, { port: 0 })
  try {
    const ends = { name: 'stock', relation: 'orders' }
    const added = await post(server.url, 'add', {
      thing: 'relation', ...ends, description: 'Informs order placement', technology: 'In-process data',
    })
    assert.equal(added.status, 200)
    assert.match((await view('stock', root)).stdout, /->\s+Informs order placement\s+orders/)
    const twice = await post(server.url, 'add', { thing: 'relation', ...ends, description: 'Again', technology: 'Queue' })
    assert.equal(twice.status, 400)
    assert.match(await twice.text(), /groma edit relation stock orders/)

    assert.equal((await post(server.url, 'edit', { id: 'stock', relation: 'orders', technology: 'Queue' })).status, 200)
    const payload = await (await fetch(`${server.url}/world.json`)).json() as {
      world: { relationships: { source: string; target: string; description: string; technology: string }[] }
    }
    const row = payload.world.relationships.find(item => item.source === 'stock' && item.target === 'orders')
    assert.equal(row?.description, 'Informs order placement')
    assert.equal(row?.technology, 'Queue')

    assert.equal((await post(server.url, 'remove', { id: 'stock', relation: 'orders' })).status, 200)
    assert.doesNotMatch((await view('stock', root)).stdout, /Informs order placement/)
  } finally {
    await server.close()
    await rm(root, { recursive: true, force: true })
  }
})
