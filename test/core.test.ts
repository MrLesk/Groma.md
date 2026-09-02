import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadArchitectureViewModel } from '../src/core.ts'

const fixtureRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'validate',
)

test('reconstructs observed elements, ghosts, and drafts from the OKF profile', async () => {
  const model = await loadArchitectureViewModel(fixtureRoot)

  assert.deepEqual(model.drafts, ['next'])
  assert.deepEqual(model.elements.map(element => element.id), [
    'api',
    'buyer',
    'git',
    'orders',
    'shop',
    'stock',
  ])
  assert.ok(model.elements.every(element => element.representationId === element.id))
  const buyer = model.elements.find(element => element.id === 'buyer')
  assert.ok(buyer)
  assert.equal(buyer.title, 'Buyer')
  assert.equal(buyer.description, 'A person who places an order.')
  assert.equal(buyer.overview, 'Places orders in the shop.')

  const api = model.elements.find(element => element.id === 'api')
  assert.deepEqual(api?.children, ['orders', 'stock'])
  const stock = model.elements.find(element => element.id === 'stock')
  assert.equal(stock?.origin, 'draft')
  assert.equal(stock?.draft, 'next')
  assert.equal(model.elements.find(element => element.id === 'orders')?.origin, 'observed')
  assert.equal(model.elements.find(element => element.id === 'git')?.external, true)
  assert.deepEqual(model.relationships.map(relationship => [
    relationship.source,
    relationship.target,
    relationship.origin,
  ]), [
    ['buyer', 'shop', 'observed'],
    ['shop', 'git', 'observed'],
  ])
  assert.ok(model.world.bounds.width > 0)
  assert.doesNotThrow(() => JSON.stringify(model))
})
