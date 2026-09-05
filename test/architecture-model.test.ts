import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'

import { buildArchitectureModel } from '../src/architecture-model.ts'
import { loadArchitecture } from '../src/architecture-reader.ts'
import { elementDocument, repositoryRoot } from './architecture-model-helpers.ts'

const validateRoot = path.join(repositoryRoot, 'test', 'fixtures', 'validate')

test('builds a frozen, serializable C4 graph deterministically', { concurrency: true }, async () => {
  const model = buildArchitectureModel((await loadArchitecture(validateRoot)).documents)
  const reloadedModel = buildArchitectureModel((await loadArchitecture(validateRoot)).documents)

  assert.deepEqual(model, reloadedModel)
  assert.ok(model.elements.length > 0 && model.relationships.length > 0)
  assert.deepEqual(JSON.parse(JSON.stringify(model)), model)
  assert.ok(Object.isFrozen(model))
  assert.ok(Object.isFrozen(model.elements))
  assert.ok(Object.isFrozen(model.elements[0]))
  assert.ok(Object.isFrozen(model.relationships))
  assert.ok(Object.isFrozen(model.relationships[0]))
})

test('keeps the group on the element and omits it otherwise', { concurrency: true }, () => {
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

test('a stable element may carry the tag of the draft that touches it', { concurrency: true }, () => {
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

test('preserves every leading prose paragraph in overview', { concurrency: true }, () => {
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

test('resolves a relationship link to the target document stable id', { concurrency: true }, () => {
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

test('orders equivalent unchanged trees deterministically', { concurrency: true }, () => {
  const system = elementDocument({
    id: 'z-system',
    kind: 'system',
    sourceFilename: 'groma/systems/z/system.md',
  })
  const other = elementDocument({ id: 'b-system', kind: 'system', sourceFilename: 'groma/systems/b/system.md' })
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
        href: '../systems/b/system.md',
        description: 'First alphabetically',
        technology: 'One',
      },
    ],
  })

  const first = buildArchitectureModel([system, other, actor])
  const second = buildArchitectureModel([actor, other, system])

  assert.deepEqual(first, second)
  assert.deepEqual(first.elements.map(element => element.id), ['a-actor', 'b-system', 'z-system'])
  assert.deepEqual(
    first.relationships.map(relationship => relationship.description),
    ['First alphabetically', 'Second alphabetically'],
  )
})
