import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { flowEndpointLabel, projectFlowStep } from '../src/viewers/tui/flow.ts'
import { visibleIn } from '../src/viewers/tui/projection-camera.ts'
import { mapAnchors, projectWorld } from '../src/viewers/tui/projection.ts'
import {
  box,
  mapViewportOf,
  navigationWorld,
  uses,
  worldOf,
} from './helpers.ts'

function groupedWorld() {
  return worldOf([
    box('person', 'actor', { x: 0, y: 0, width: 1, height: 1 }),
    box('product', 'system', { x: 0, y: 0, width: 1, height: 1 }, {
      children: ['observed:service'],
    }),
    box('service', 'container', { x: 0, y: 0, width: 1, height: 1 }, {
      parent: 'observed:product',
      children: ['observed:read', 'observed:write'],
    }),
    box('read', 'component', { x: 0, y: 0, width: 1, height: 1 }, {
      parent: 'observed:service',
      group: 'Queries',
    }),
    box('write', 'component', { x: 0, y: 0, width: 1, height: 1 }, {
      parent: 'observed:service',
      group: 'Commands',
    }),
    box('vendor', 'system', { x: 0, y: 0, width: 1, height: 1 }, { external: true }),
  ], [
    uses('person-uses-product', 'person', 'product'),
    uses('write-uses-vendor', 'write', 'vendor'),
  ])
}

test.concurrent('root projection shows the architecture surfaces without component cards', () => {
  const model = groupedWorld()
  const projection = projectWorld(model, { viewport: mapViewportOf({ width: 200, height: 60 }) })

  assert.ok(projection.items.some(item => item.kind === 'actor' && item.shape === 'card'))
  assert.ok(projection.items.some(item => item.kind === 'system' && !item.external))
  assert.ok(projection.items.some(item => item.kind === 'system' && item.external))
  assert.ok(projection.items.some(item => item.kind === 'container' && item.shape === 'boundary'))
  assert.ok(projection.items.some(item => item.kind === 'group' && item.shape === 'group'))
  assert.equal(projection.items.some(item => item.kind === 'component'), false)
  assert.equal(projection.currentId, 'observed:product')
})

test.concurrent('container projection contains only its groups and component cards', () => {
  const model = groupedWorld()
  const projection = projectWorld(model, {
    viewport: mapViewportOf({ width: 120, height: 36 }),
    level: 'components',
    currentId: 'observed:read',
  })

  assert.equal(projection.currentId, 'observed:read')
  assert.deepEqual(
    new Set(projection.items.filter(item => item.representationId).map(item => item.representationId)),
    new Set(['observed:service', 'observed:read', 'observed:write']),
  )
  assert.equal(projection.items.filter(item => item.kind === 'group').length, 2)
  assert.equal(mapAnchors(model, 'components', 'observed:read').has('observed:service'), false)
})

test.concurrent('selection changes the camera but never the world layout', () => {
  const model = navigationWorld()
  const viewport = mapViewportOf({ width: 80, height: 24 })
  const start = projectWorld(model, { viewport, currentId: 'observed:alpha' })
  const before = structuredClone(model.sheet)
  const moved = projectWorld(model, {
    viewport,
    currentId: 'observed:ext',
    camera: start.camera,
  })

  assert.notDeepEqual(moved.camera, start.camera)
  assert.deepEqual(model.sheet, before)
  assert.deepEqual(
    moved.items.map(item => [item.key, item.worldBounds]),
    start.items.map(item => [item.key, item.worldBounds]),
  )
})

test.concurrent('routes use the same world cells while selection stays visible', () => {
  const model = groupedWorld()
  const viewport = mapViewportOf({ width: 200, height: 60 })
  const start = projectWorld(model, { viewport, currentId: 'observed:product' })
  const next = projectWorld(model, {
    viewport,
    currentId: 'observed:service',
    camera: start.camera,
  })

  assert.deepEqual(next.camera, start.camera)
  assert.deepEqual(
    next.relationships.map(route => [route.source, route.target, route.cellRoute]),
    start.relationships.map(route => [route.source, route.target, route.cellRoute]),
  )
})

test.concurrent('flow steps keep exact endpoints while marking their visible ancestors', () => {
  const model = groupedWorld()
  const projection = projectWorld(model, {
    viewport: mapViewportOf({ width: 200, height: 60 }),
  })
  const step = projectFlowStep(
    model,
    projection,
    'write-uses-vendor',
    undefined,
    0,
  )

  assert.equal(step?.source.name, 'write')
  assert.equal(step?.source.visibleName, 'service')
  assert.equal(step?.source.visibleKey, 'observed:service')
  assert.equal(flowEndpointLabel(step!.source), 'service / write')
  assert.equal(step?.target.name, 'vendor')
  assert.equal(step?.target.visibleKey, 'observed:vendor')

  const local = projectFlowStep(model, projectWorld(model, {
    viewport: mapViewportOf({ width: 120, height: 36 }),
    level: 'components',
    currentId: 'observed:write',
  }), 'write-uses-vendor', undefined, 0)
  assert.equal(local?.target.visibleKey, 'observed:service')
  assert.equal(flowEndpointLabel(local!.target), 'vendor')
})

test.concurrent('flow attention reveals its destination without changing selection', () => {
  const model = groupedWorld()
  const viewport = mapViewportOf({ width: 60, height: 24 })
  const start = projectWorld(model, { viewport, currentId: 'observed:product' })
  const followed = projectWorld(model, {
    viewport,
    currentId: 'observed:product',
    attentionIds: ['observed:vendor'],
    camera: start.camera,
  })
  const target = followed.items.find(item => item.representationId === 'observed:vendor')

  assert.equal(followed.currentId, 'observed:product')
  assert.ok(target)
  assert.equal(visibleIn(target.cellBounds, viewport), true)
})

test.concurrent('task attention frames every visible touched element together', () => {
  const model = navigationWorld()
  const viewport = mapViewportOf({ width: 120, height: 36 })
  const start = projectWorld(model, { viewport, currentId: 'observed:cfar' })
  const followed = projectWorld(model, {
    viewport,
    currentId: 'observed:alpha',
    attentionIds: ['observed:cleft', 'observed:cright'],
    camera: start.camera,
  })
  const touched = followed.items.filter(item => {
    return item.representationId === 'observed:cleft'
      || item.representationId === 'observed:cright'
  })

  assert.equal(followed.currentId, 'observed:alpha')
  assert.equal(touched.length, 2)
  assert.equal(touched.every(item => visibleIn(item.cellBounds, viewport)), true)
})

test.concurrent('oversized task attention keeps the complete set centered', () => {
  const viewport = { x: 0, y: 0, width: 20, height: 8 }
  const projection = projectWorld(navigationWorld(), {
    viewport,
    currentId: 'observed:alpha',
    attentionIds: ['observed:cleft', 'observed:cright'],
  })
  const touched = projection.items.filter(item => {
    return item.representationId === 'observed:cleft'
      || item.representationId === 'observed:cright'
  })
  const left = Math.min(...touched.map(item => item.worldBounds.x))
  const right = Math.max(...touched.map(item => item.worldBounds.x + item.worldBounds.width))

  assert.equal(right - left > viewport.width, true)
  assert.ok(Math.abs(projection.camera.x + viewport.width / 2 - (left + right) / 2) <= 0.5)
})
