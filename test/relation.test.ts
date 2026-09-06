import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

import { loadAnnotatedArchitecture } from '../src/core.ts'
import { copyFixture, groma, projectRoot, readTree } from './cli-helpers.ts'

const fixtureRoot = path.join(projectRoot, 'test', 'fixtures', 'edit')
const stockPath = 'groma/relationships.md'
const informs = [
  'add', 'relation', 'src/stock.ts', 'src/orders.ts', '--description', 'Informs order placement', '--technology', 'In-process data',
]

async function relationOf(root: string, source: string, target: string) {
  const world = await loadAnnotatedArchitecture(root)
  return world.relationships.find(item => item.source === source && item.target === target)
}

test('groma add relation writes one relationship per ordered file pair in the relationship record', { concurrency: true }, async t => {
  const root = await copyFixture(t, fixtureRoot, 'groma-relation-')
  const added = await groma(root, informs)
  assert.equal(added.code, 0, added.stderr)
  const row = await relationOf(root, 'stock', 'orders')
  assert.equal(row?.description, 'Informs order placement')
  assert.equal(row?.technology, 'In-process data')

  const before = await readTree(root)
  const duplicate = await groma(root, informs)
  assert.notEqual(duplicate.code, 0)
  assert.match(duplicate.stderr, /groma edit relation/)
  assert.deepEqual(await readTree(root), before)

  const removed = await groma(root, ['remove', 'relation', 'src/stock.ts', 'src/orders.ts'])
  assert.notEqual(removed.code, 0)
  assert.match(removed.stderr, /only draft relationships can be removed/)
  assert.deepEqual(await readTree(root), before)
})

test('groma edit relation rewords a draft and groma remove relation deletes it, even after the target was renamed', { concurrency: true }, async t => {
  const root = await copyFixture(t, fixtureRoot, 'groma-relation-')
  const original = await readFile(path.join(root, stockPath), 'utf8')
  assert.equal((await groma(root, ['draft', ...informs.slice(1)])).code, 0)
  const reworded = await groma(root, ['edit', 'relation', 'src/stock.ts', 'src/orders.ts', '--description', 'Warns order placement'])
  assert.equal(reworded.code, 0, reworded.stderr)
  const row = await relationOf(root, 'stock', 'orders')
  assert.equal(row?.description, 'Warns order placement')
  assert.equal(row?.technology, 'In-process data')

  assert.equal((await groma(root, ['edit', 'orders', '--title', 'Order intake'])).code, 0)
  const removed = await groma(root, ['remove', 'relation', 'src/stock.ts', 'src/orders.ts'])
  assert.equal(removed.code, 0, removed.stderr)
  assert.equal(
    (await readFile(path.join(root, stockPath), 'utf8')).replaceAll('\r\n', '\n'),
    original.replaceAll('\r\n', '\n'),
  )
  assert.equal(await relationOf(root, 'stock', 'orders'), undefined)
})

test('relation verbs refuse unknown ends, missing flags, element flags without writes', { concurrency: true }, async t => {
  const root = await copyFixture(t, fixtureRoot, 'groma-relation-')
  const before = await readTree(root)
  const cases: Array<{ name: string, args: string[] }> = [
    { name: 'unknown target', args: ['add', 'relation', 'stock', 'nope', '--description', 'x', '--technology', 'y'] },
    { name: 'missing flags', args: ['add', 'relation', 'src/stock.ts', 'src/orders.ts'] },
    { name: 'a second id on a person', args: ['add', 'actor', 'Support', 'agent', '--overview', 'Nope.'] },
    { name: 'one id on edit relation', args: ['edit', 'relation', 'stock', '--description', 'x'] },
    { name: 'a title on a relation', args: ['edit', 'relation', 'src/stock.ts', 'src/orders.ts', '--title', 'x'] },
    { name: 'a missing relation on remove', args: ['remove', 'relation', 'src/stock.ts', 'src/orders.ts'] },
  ]
  for (const item of cases) {
    const result = await groma(root, item.args)
    assert.notEqual(result.code, 0, item.name)
    assert.deepEqual(await readTree(root), before, item.name)
  }
})
