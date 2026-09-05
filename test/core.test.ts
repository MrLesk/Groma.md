import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { annotateArchitecture, loadAnnotatedArchitecture } from '../src/core.ts'
import { elementDocument } from './architecture-model-helpers.ts'

const fixtureRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'validate',
)

test('reconstructs observed elements, ghosts, and drafts from the OKF profile', async () => {
  const model = await loadAnnotatedArchitecture(fixtureRoot)

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
  assert.doesNotThrow(() => JSON.stringify(model))
})

test('move eligibility uses the complete Markdown body', () => {
  const system = elementDocument({
    id: 'shop',
    kind: 'system',
    sourceFilename: 'groma/systems/shop/system.md',
  })
  const container = elementDocument({
    id: 'api',
    kind: 'container',
    parent: 'shop',
    sourceFilename: 'groma/systems/shop/containers/api/container.md',
  })
  const empty = elementDocument({
    id: 'empty',
    kind: 'component',
    parent: 'api',
    sourceFilename: 'groma/systems/shop/containers/api/components/empty.md',
  })
  empty.body = ''
  empty.nodes = []
  const sectioned = elementDocument({
    id: 'sectioned',
    kind: 'component',
    parent: 'api',
    sourceFilename: 'groma/systems/shop/containers/api/components/sectioned.md',
  })
  sectioned.body = '## Requirements\n\nKeep this requirement.'
  sectioned.nodes = [
    ['h2', { id: 'requirements' }, 'Requirements'],
    ['p', {}, 'Keep this requirement.'],
  ]

  const model = annotateArchitecture({ documents: [system, container, empty, sectioned], drafts: [], flows: [] })

  assert.equal(model.elements.find(element => element.id === 'empty')?.movable, true)
  assert.equal(model.elements.find(element => element.id === 'sectioned')?.movable, false)
})
