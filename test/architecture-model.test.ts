import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'

import { buildArchitectureModel } from '../src/architecture-model.ts'
import { loadArchitecture } from '../src/architecture-reader.ts'
import { elementDocument, repositoryRoot } from './architecture-model-helpers.ts'

const validateRoot = path.join(repositoryRoot, 'test', 'fixtures', 'validate')

test('builds a serializable C4 graph with Code references from the one tree', async () => {
  const model = buildArchitectureModel((await loadArchitecture(validateRoot)).documents)
  const reloadedModel = buildArchitectureModel((await loadArchitecture(validateRoot)).documents)

  assert.deepEqual(model, reloadedModel)
  assert.deepEqual(Object.keys(model), ['elements', 'relationships'])
  assert.deepEqual(
    model.elements.map(element => element.id),
    ['api', 'buyer', 'git', 'orders', 'shop', 'stock'],
  )
  assert.deepEqual(
    model.elements.find(element => element.id === 'orders'),
    {
      id: 'orders',
      kind: 'component',
      title: 'Orders',
      overview: 'Places and tracks customer orders.',
      parentId: 'api',
      external: false,
      group: 'Commerce',
      code: [
        {
          scanner: 'typescript',
          file: 'src/core.ts',
          symbol: 'loadAnnotatedArchitecture',
        },
      ],
      status: 'stable',
      sourceFilename: 'groma/systems/shop/containers/api/components/orders.md',
    },
  )
  assert.deepEqual(
    model.elements.find(element => element.id === 'buyer'),
    {
      id: 'buyer',
      kind: 'actor',
      title: 'Buyer',
      description: 'A person who places an order.',
      overview: 'Places orders in the shop.',
      parentId: null,
      external: false,
      code: [],
      status: 'stable',
      sourceFilename: 'groma/actors/buyer.md',
    },
  )
  const stock = model.elements.find(element => element.id === 'stock')
  assert.equal(stock?.status, 'draft')
  assert.equal(stock?.draft, 'next')
  assert.equal(model.elements.find(element => element.id === 'git')?.external, true)
  assert.equal(model.relationships.length, 2)
  assert.deepEqual(
    model.relationships.find(relationship => relationship.sourceId === 'shop'),
    {
      status: 'stable',
      sourceId: 'shop',
      targetId: 'git',
      description: 'Versions architecture',
      technology: 'Git',
      sourceFilename: 'groma/systems/shop/system.md',
      targetSourceFilename: 'groma/externals/git.md',
    },
  )
  assert.doesNotThrow(() => JSON.stringify(model))
  assert.ok(Object.isFrozen(model))
  assert.ok(Object.isFrozen(model.elements))
  assert.ok(Object.isFrozen(model.elements[0]))
  assert.ok(Object.isFrozen(model.relationships))
  assert.ok(Object.isFrozen(model.relationships[0]))
})

test('keeps the group on the element and omits it otherwise', () => {
  const model = buildArchitectureModel([
    elementDocument({
      id: 'grouped-system',
      kind: 'system',
      group: 'Edge services',
      sourceFilename: 'groma/systems/grouped-system/system.md',
    }),
    elementDocument({
      id: 'plain-system',
      kind: 'system',
      sourceFilename: 'groma/systems/plain-system/system.md',
    }),
  ])

  const grouped = model.elements.find(element => element.id === 'grouped-system')
  const plain = model.elements.find(element => element.id === 'plain-system')
  assert.equal(grouped?.group, 'Edge services')
  assert.ok(plain)
  assert.equal(Object.hasOwn(plain, 'group'), false)
})

test('a stable element may carry the tag of the draft that touches it', () => {
  const model = buildArchitectureModel([
    elementDocument({
      id: 'touched-system',
      kind: 'system',
      draft: 'next',
      sourceFilename: 'groma/systems/touched-system/system.md',
    }),
  ])

  assert.equal(model.elements[0]?.status, 'stable')
  assert.equal(model.elements[0]?.draft, 'next')
})

test('preserves every leading prose paragraph in overview', () => {
  const document = elementDocument({
    id: 'catalog',
    kind: 'system',
    sourceFilename: 'groma/systems/catalog/system.md',
  })
  document.nodes = [
    ['p', {}, 'Owns the product catalog.'],
    ['p', {}, 'Keeps product details available to shoppers.'],
    ['h2', { id: 'requirements' }, 'Requirements'],
    ['p', {}, 'This named section is not part of the overview.'],
  ]

  const model = buildArchitectureModel([document])

  assert.equal(
    model.elements[0]?.overview,
    'Owns the product catalog.\n\nKeeps product details available to shoppers.',
  )
})

test('resolves a relationship link to the target document stable id', () => {
  const source = elementDocument({
    id: 'architect',
    kind: 'actor',
    sourceFilename: 'groma/actors/architect.md',
    relationships: [{
      href: '../systems/platform/system.md#context',
      label: 'Readable platform name',
      description: 'Uses the platform',
      technology: 'Browser',
    }],
  })
  const target = elementDocument({
    id: 'stable-platform-id',
    kind: 'system',
    sourceFilename: 'groma/systems/platform/system.md',
  })

  const model = buildArchitectureModel([target, source])

  assert.deepEqual(model.relationships, [{
    status: 'stable',
    sourceId: 'architect',
    targetId: 'stable-platform-id',
    description: 'Uses the platform',
    technology: 'Browser',
    sourceFilename: 'groma/actors/architect.md',
    targetSourceFilename: 'groma/systems/platform/system.md',
  }])
})

test('orders equivalent unchanged trees deterministically', () => {
  const system = elementDocument({
    id: 'z-system',
    kind: 'system',
    sourceFilename: 'groma/systems/z/system.md',
  })
  const actor = elementDocument({
    id: 'a-actor',
    kind: 'actor',
    sourceFilename: 'groma/actors/a.md',
    relationships: [
      {
        href: '../systems/z/system.md',
        description: 'Second alphabetically',
        technology: 'Two',
      },
      {
        href: '../systems/z/system.md',
        description: 'First alphabetically',
        technology: 'One',
      },
    ],
  })

  const first = buildArchitectureModel([system, actor])
  const second = buildArchitectureModel([actor, system])

  assert.deepEqual(first, second)
  assert.deepEqual(first.elements.map(element => element.id), ['a-actor', 'z-system'])
  assert.deepEqual(
    first.relationships.map(relationship => relationship.description),
    ['First alphabetically', 'Second alphabetically'],
  )
})

test('contains no presentation state', async () => {
  const model = buildArchitectureModel((await loadArchitecture(validateRoot)).documents)
  const forbiddenKeys = new Set([
    'coordinates',
    'x',
    'y',
    'zoom',
    'selection',
    'selected',
    'color',
    'colors',
    'position',
    'layout',
  ])

  function assertNoPresentationState(value: unknown): void {
    if (value === null || typeof value !== 'object') {
      return
    }
    for (const [key, child] of Object.entries(value)) {
      assert.equal(forbiddenKeys.has(key), false, `unexpected presentation key "${key}"`)
      assertNoPresentationState(child)
    }
  }

  assertNoPresentationState(model)
})
