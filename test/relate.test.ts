import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

import { loadAnnotatedArchitecture } from '../src/core.ts'
import { copyFixture, groma, projectRoot } from './cli-helpers.ts'

const fixtureRoot = path.join(projectRoot, 'test', 'fixtures', 'edit')
const stockPath = 'groma/systems/shop/containers/api/components/stock.md'

test('groma relate authors one validated observed relationship', async t => {
  const root = await copyFixture(t, fixtureRoot, 'groma-relate-')
  const filename = path.join(root, stockPath)
  const original = await readFile(filename, 'utf8')
  const args = [
    'relate',
    'stock',
    'orders',
    '--description',
    'Informs order placement',
    '--technology',
    'In-process data',
  ]
  const first = await groma(root, args)

  assert.equal(first.code, 0, first.stderr)
  const model = await loadAnnotatedArchitecture(root)
  assert.ok(model.relationships.some(relationship => {
    return relationship.source === 'stock'
      && relationship.target === 'orders'
      && relationship.description === 'Informs order placement'
      && relationship.technology === 'In-process data'
  }))

  const beforeDuplicate = await readFile(filename, 'utf8')
  const duplicate = await groma(root, args)
  assert.notEqual(duplicate.code, 0)
  assert.equal(await readFile(filename, 'utf8'), beforeDuplicate)

  const removed = await groma(root, ['relate', 'stock', 'orders', '--remove'])
  assert.equal(removed.code, 0, removed.stderr)
  assert.equal(
    (await readFile(filename, 'utf8')).replaceAll('\r\n', '\n'),
    original.replaceAll('\r\n', '\n'),
  )
})
