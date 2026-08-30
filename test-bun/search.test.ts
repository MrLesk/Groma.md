import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { createArchitectureSearch } from '../src/search.ts'
import { box } from './helpers.ts'

test.concurrent('architecture search ranks semantic fields and returns ancestor context', () => {
  const system = box('groma', 'system', { x: 0, y: 0, width: 1, height: 1 }, {
    name: 'Groma',
    children: ['observed:web-viewer', 'observed:gateway'],
  })
  const viewer = box('web-viewer', 'container', { x: 0, y: 0, width: 1, height: 1 }, {
    name: 'Web viewer',
    parent: system.representationId,
    children: ['observed:source-index'],
  })
  const source = box('source-index', 'component', { x: 0, y: 0, width: 1, height: 1 }, {
    name: 'Source index',
    parent: viewer.representationId,
  })
  const gateway = box('gateway', 'container', { x: 0, y: 0, width: 1, height: 1 }, {
    name: 'Gateway',
    description: 'Delivers the Web viewer to a browser.',
    parent: system.representationId,
  })
  const search = createArchitectureSearch([gateway, source, viewer, system])

  assert.equal(search.find('web vewer')[0]?.element.representationId, viewer.representationId)
  const result = search.find('source-index')[0]!
  assert.equal(result.element.kind, 'component')
  assert.equal(result.element.origin, 'observed')
  assert.deepEqual(result.path, ['Groma', 'Web viewer'])
})

test.concurrent('architecture search returns no result for an empty query', () => {
  const search = createArchitectureSearch([
    box('web-viewer', 'container', { x: 0, y: 0, width: 1, height: 1 }),
  ])

  assert.deepEqual(search.find('   '), [])
})
