import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'

import { buildArchitectureModel } from '../src/architecture-model.ts'
import { loadArchitecture } from '../src/architecture-reader.ts'
import { elementDocument, relationshipDocument, repositoryRoot } from './architecture-model-helpers.ts'

const validateRoot = path.join(repositoryRoot, 'test', 'fixtures', 'validate')

test('builds a frozen, serializable C4 graph deterministically', { concurrency: true }, async () => {
  const model = buildArchitectureModel((await loadArchitecture(validateRoot)).documents)
  const reloadedModel = buildArchitectureModel((await loadArchitecture(validateRoot)).documents)

  assert.deepEqual(model, reloadedModel)
  assert.ok(model.elements.length > 0 && model.relationships.length > 0)
  assert.ok(Object.isFrozen(model))
  assert.ok(Object.isFrozen(model.elements))
  assert.ok(Object.isFrozen(model.elements[0]))
  assert.ok(Object.isFrozen(model.relationships))
  assert.ok(Object.isFrozen(model.relationships[0]))
})

test('resolves a relationship link to the target document stable id', { concurrency: true }, () => {
  const source = elementDocument({
    id: 'architect',
    kind: 'actor',
    sourceFilename: 'groma/actors/architect.md',
  })
  const connections = relationshipDocument([{
      sourceHref: 'actors/architect.md',
      href: 'systems/platform/system.md#context',
      label: 'Readable platform name',
      description: 'Uses the platform',
      technology: 'Browser',
    }])
  const target = elementDocument({
    id: 'stable-platform-id',
    kind: 'system',
    sourceFilename: 'groma/systems/platform/system.md',
  })

  const model = buildArchitectureModel([target, source, connections])

  assert.deepEqual(model.relationships.map(row => [row.sourceId, row.targetId]), [['architect', 'stable-platform-id']])
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
  })
  const connections = relationshipDocument([
      {
        sourceHref: 'actors/a.md',
        href: 'systems/z/system.md',
        description: 'Second alphabetically',
        technology: 'Two',
      },
      {
        sourceHref: 'actors/a.md',
        href: 'systems/b/system.md',
        description: 'First alphabetically',
        technology: 'One',
      },
    ])

  const first = buildArchitectureModel([system, other, actor, connections])
  const second = buildArchitectureModel([connections, actor, other, system])

  assert.deepEqual(first, second)
  assert.deepEqual(first.elements.map(element => element.id), ['a-actor', 'b-system', 'z-system'])
  assert.deepEqual(
    first.relationships.map(relationship => relationship.targetId),
    ['b-system', 'z-system'],
  )
})
