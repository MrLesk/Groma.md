import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

import { loadAnnotatedArchitecture } from '../src/core.ts'
import { copyFixture, groma, projectRoot, readRelative, readTree } from './cli-helpers.ts'

const fixtureRoot = path.join(projectRoot, 'test', 'fixtures', 'plain-view')

async function exists(root: string, relative: string): Promise<boolean> {
  try {
    await access(path.join(root, ...relative.split('/')))
    return true
  } catch {
    return false
  }
}

test('groma remove deletes a person and an external nothing relates to', async t => {
  const root = await copyFixture(t, fixtureRoot, 'groma-remove-')
  const buyer = await groma(root, ['remove', 'buyer'])
  const git = await groma(root, ['remove', 'git'])

  assert.equal(buyer.code, 0, buyer.stderr)
  assert.equal(git.code, 0, git.stderr)
  assert.equal(await exists(root, 'groma/actors/buyer.md'), false)
  assert.equal(await exists(root, 'groma/externals/git.md'), false)
  const ids = (await loadAnnotatedArchitecture(root)).elements.map(element => element.id)
  assert.ok(!ids.includes('buyer') && !ids.includes('git'))
})

test('a ghost leaves once nothing relates to it, and a draft record once no ghost belongs to it', async t => {
  const root = await copyFixture(t, fixtureRoot, 'groma-remove-')
  assert.equal((await groma(root, [
    'draft', 'component', 'Stock check', '--parent', 'api', '--draft', 'next', '--overview', 'Checks stock levels.',
  ])).code, 0)
  assert.equal((await groma(root, [
    'add', 'relation', 'orders', 'stock-check', '--description', 'Asks before placing', '--technology', 'Function call',
  ])).code, 0)
  const related = await groma(root, ['remove', 'stock-check'])
  assert.notEqual(related.code, 0)
  assert.match(related.stderr, /orders relate to it/)

  const recordWhileGhost = await groma(root, ['remove', 'next'])
  assert.notEqual(recordWhileGhost.code, 0)
  assert.match(recordWhileGhost.stderr, /ghosts stock-check still belong to it/)

  assert.equal((await groma(root, ['remove', 'relation', 'orders', 'stock-check'])).code, 0)
  const ghost = await groma(root, ['remove', 'stock-check'])
  assert.equal(ghost.code, 0, ghost.stderr)
  assert.equal(await exists(root, 'groma/systems/shop/containers/api/components/stock-check.md'), false)

  assert.match(await readRelative(root, 'groma/systems/shop/containers/api/components/stock.md'), /draft: next/)
  const record = await groma(root, ['remove', 'next'])
  assert.equal(record.code, 0, record.stderr)
  assert.equal(await exists(root, 'groma/drafts/next.md'), false)
  assert.doesNotMatch(await readRelative(root, 'groma/systems/shop/containers/api/components/stock.md'), /draft: next/)
  assert.deepEqual((await loadAnnotatedArchitecture(root)).drafts, [])
})

test('the scanner keeps stable software, and a ghost keeps what it contains', async t => {
  const root = await copyFixture(t, fixtureRoot, 'groma-remove-')
  assert.equal((await groma(root, ['draft', 'container', 'Warehouse', '--parent', 'shop', '--overview', 'Stores goods.'])).code, 0)
  assert.equal((await groma(root, ['draft', 'component', 'Bins', '--parent', 'warehouse', '--overview', 'Counts bins.'])).code, 0)
  const before = await readTree(root)
  const cases: Array<{ id: string, message: RegExp }> = [
    { id: 'shop', message: /found by the scanner/ },
    { id: 'api', message: /found by the scanner/ },
    { id: 'orders', message: /found by the scanner/ },
    { id: 'warehouse', message: /it contains bins/ },
    { id: 'nope', message: /unknown id/ },
  ]
  for (const item of cases) {
    const result = await groma(root, ['remove', item.id])
    assert.notEqual(result.code, 0, item.id)
    assert.match(result.stderr, item.message, item.id)
    assert.deepEqual(await readTree(root), before, item.id)
  }
})
