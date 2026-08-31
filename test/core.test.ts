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

test('reconstructs observed, missing, and planned representations from the OKF profile', async () => {
  const model = await loadArchitectureViewModel(fixtureRoot)

  assert.deepEqual(model.plans, ['next'])
  assert.deepEqual(model.elements.map(element => element.representationId), [
    'observed:api',
    'observed:buyer',
    'observed:git',
    'observed:orders',
    'observed:shop',
    'missing:legacy',
    'planned:next:stock',
  ])
  const buyer = model.elements.find(element => element.representationId === 'observed:buyer')
  assert.ok(buyer)
  assert.equal(buyer.title, 'Buyer')
  assert.equal(buyer.description, 'A person who places an order.')
  assert.equal(buyer.overview, 'Places orders in the shop.')

  const api = model.elements.find(element => element.representationId === 'observed:api')
  assert.deepEqual(api?.children, [
    'missing:legacy',
    'observed:orders',
    'planned:next:stock',
  ])
  assert.equal(model.elements.find(element => element.id === 'legacy')?.origin, 'missing')
  assert.equal(model.elements.find(element => element.id === 'stock')?.origin, 'planned')
  assert.deepEqual(model.relationships.map(relationship => [
    relationship.source,
    relationship.target,
  ]), [
    ['observed:buyer', 'observed:shop'],
    ['observed:shop', 'observed:git'],
  ])
  assert.ok(model.world.bounds.width > 0)
  assert.doesNotThrow(() => JSON.stringify(model))
})
