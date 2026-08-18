import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'

import { buildArchitectureModel } from '../src/architecture-model.ts'
import { loadRevision } from '../src/architecture-reader.ts'
import {
  elementDocument,
  repositoryRoot,
  revisionRecord,
} from './architecture-model-helpers.ts'

test('exports a revision model builder', () => {
  assert.equal(typeof buildArchitectureModel, 'function')
})

test('builds a serializable revision-local C4 graph with Code references', async () => {
  const loadedRevision = await loadRevision(
    path.join(repositoryRoot, 'test', 'fixtures', 'core-view'),
    { kind: 'observed' },
  )
  const model = buildArchitectureModel(loadedRevision)
  const reloadedModel = buildArchitectureModel(await loadRevision(
    path.join(repositoryRoot, 'test', 'fixtures', 'core-view'),
    { kind: 'observed' },
  ))

  assert.deepEqual(model, reloadedModel)
  assert.deepEqual(Object.keys(model), ['revision', 'elements', 'relationships'])
  assert.deepEqual(model.revision, {
    kind: 'observed',
    sourceDirectory: 'groma/observed',
  })
  assert.deepEqual(
    model.elements.map(element => element.id),
    ['api', 'orders', 'payments', 'shop'],
  )
  assert.deepEqual(
    model.elements.find(element => element.id === 'orders'),
    {
      id: 'orders',
      kind: 'component',
      name: 'Orders',
      description: 'Places and tracks customer orders.',
      parentId: 'api',
      external: false,
      code: [
        {
          scanner: 'typescript',
          file: 'src/orders.ts',
          symbol: 'placeOrder',
        },
        {
          scanner: 'routes',
          file: 'src/routes/orders.ts',
        },
      ],
      sourceFilename:
        'groma/observed/systems/shop/containers/api/components/orders.md',
    },
  )
  assert.equal(model.relationships.length, 1)
  assert.deepEqual(
    model.relationships[0],
    {
      sourceId: 'orders',
      targetId: 'payments',
      description: 'Requests payment authorization',
      technology: 'HTTPS',
      sourceFilename:
        'groma/observed/systems/shop/containers/api/components/orders.md',
      targetSourceFilename:
        'groma/observed/systems/payments/system.md',
    },
  )
  assert.doesNotThrow(() => JSON.stringify(model))
  assert.ok(Object.isFrozen(model))
  assert.ok(Object.isFrozen(model.revision))
  assert.ok(Object.isFrozen(model.elements))
  assert.ok(Object.isFrozen(model.elements[0]))
  assert.ok(Object.isFrozen(model.relationships))
  assert.ok(Object.isFrozen(model.relationships[0]))
})

test('keeps the group on the element and omits it otherwise', () => {
  const model = buildArchitectureModel(revisionRecord([
    elementDocument({
      id: 'grouped-system',
      kind: 'system',
      group: 'Edge services',
      sourceFilename: 'groma/plans/test-revision/systems/grouped-system/system.md',
    }),
    elementDocument({
      id: 'plain-system',
      kind: 'system',
      sourceFilename: 'groma/plans/test-revision/systems/plain-system/system.md',
    }),
  ]))

  const grouped = model.elements.find(element => element.id === 'grouped-system')
  const plain = model.elements.find(element => element.id === 'plain-system')
  assert.equal(grouped?.group, 'Edge services')
  assert.ok(plain)
  assert.equal(Object.hasOwn(plain, 'group'), false)
})

test('resolves a relationship link to the target document stable id', () => {
  const source = elementDocument({
    id: 'architect',
    kind: 'person',
    sourceFilename: 'groma/plans/test-revision/people/architect.md',
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
    sourceFilename: 'groma/plans/test-revision/systems/platform/system.md',
  })

  const model = buildArchitectureModel(revisionRecord([target, source]))

  assert.deepEqual(model.relationships, [{
    sourceId: 'architect',
    targetId: 'stable-platform-id',
    description: 'Uses the platform',
    technology: 'Browser',
    sourceFilename: 'groma/plans/test-revision/people/architect.md',
    targetSourceFilename: 'groma/plans/test-revision/systems/platform/system.md',
  }])
})

test('orders equivalent unchanged revisions deterministically', () => {
  const system = elementDocument({
    id: 'z-system',
    kind: 'system',
    sourceFilename: 'groma/plans/test-revision/systems/z/system.md',
  })
  const person = elementDocument({
    id: 'a-person',
    kind: 'person',
    sourceFilename: 'groma/plans/test-revision/people/a.md',
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

  const first = buildArchitectureModel(revisionRecord([system, person]))
  const second = buildArchitectureModel(revisionRecord([person, system]))

  assert.deepEqual(first, second)
  assert.deepEqual(first.elements.map(element => element.id), ['a-person', 'z-system'])
  assert.deepEqual(
    first.relationships.map(relationship => relationship.description),
    ['First alphabetically', 'Second alphabetically'],
  )
})


test('contains no presentation state', async () => {
  const loadedRevision = await loadRevision(
    path.join(repositoryRoot, 'test', 'fixtures', 'core-view'),
    { kind: 'observed' },
  )

  const model = buildArchitectureModel(loadedRevision)
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
