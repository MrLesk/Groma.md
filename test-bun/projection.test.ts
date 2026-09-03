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

test.concurrent('root projection shows systems, containers, collapsed groups, actors, and external systems', () => {
  const model = groupedWorld()
  const projection = projectWorld(model, { viewport: mapViewportOf({ width: 200, height: 60 }) })

  assert.ok(projection.items.some(item => item.shape === 'island' && item.kind === 'actor'))
  assert.ok(projection.items.some(item => item.shape === 'card' && item.kind === 'actor'))
  assert.ok(projection.items.some(item => item.shape === 'island' && item.kind === 'system' && !item.external))
  assert.ok(projection.items.some(item => item.shape === 'island' && item.external))
  assert.ok(projection.items.some(item => item.shape === 'slab' && item.kind === 'container'))
  assert.ok(projection.items.some(item => item.shape === 'group'))
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
  const viewport = mapViewportOf({ width: 120, height: 36 })
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

test.concurrent('a larger viewport reveals more of the same fixed world', () => {
  const model = navigationWorld()
  const small = projectWorld(model, {
    viewport: mapViewportOf({ width: 120, height: 36 }),
    currentId: 'observed:alpha',
  })
  const large = projectWorld(model, {
    viewport: mapViewportOf({ width: 200, height: 60 }),
    currentId: 'observed:alpha',
  })

  assert.deepEqual(large.worldBounds, small.worldBounds)
  assert.deepEqual(
    large.items.map(item => [item.key, item.worldBounds]),
    small.items.map(item => [item.key, item.worldBounds]),
  )
  assert.deepEqual(
    large.relationships.map(route => [route.ids, route.worldRoute]),
    small.relationships.map(route => [route.ids, route.worldRoute]),
  )
})

test.concurrent('routes use the same world cells while selection stays visible', () => {
  const model = groupedWorld()
  const viewport = mapViewportOf({ width: 320, height: 120 })
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

  assert.equal(step?.source.title, 'write')
  assert.equal(step?.source.visibleTitle, 'service')
  assert.equal(step?.source.visibleKey, 'observed:service')
  assert.equal(flowEndpointLabel(step!.source), 'service / write')
  assert.equal(step?.target.title, 'vendor')
  assert.equal(step?.target.visibleKey, 'observed:vendor')

  const local = projectFlowStep(model, projectWorld(model, {
    viewport: mapViewportOf({ width: 120, height: 36 }),
    level: 'components',
    currentId: 'observed:write',
  }), 'write-uses-vendor', undefined, 0)
  assert.equal(local?.target.visibleKey, 'observed:service')
  assert.equal(flowEndpointLabel(local!.target), 'vendor')
})

test.concurrent('flow attention reveals its endpoint without changing selection', () => {
  const model = groupedWorld()
  const viewport = mapViewportOf({ width: 120, height: 36 })
  const start = projectWorld(model, { viewport, currentId: 'observed:product' })
  const followed = projectWorld(model, {
    viewport,
    currentId: 'observed:product',
    attentionIds: ['observed:vendor'],
    camera: start.camera,
  })

  assert.equal(followed.currentId, 'observed:product')
  const vendor = followed.items.find(item => item.representationId === 'observed:vendor')!
  assert.equal(visibleIn(vendor.cellBounds, viewport), true)
  assert.deepEqual(
    followed.items.map(item => [item.key, item.worldBounds]),
    start.items.map(item => [item.key, item.worldBounds]),
  )
})

test.concurrent('task attention frames every visible touched element together', () => {
  const model = navigationWorld()
  const viewport = mapViewportOf({ width: 200, height: 60 })
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

test.concurrent('a component selection at root stands on its visible container', () => {
  const model = navigationWorld()
  const viewport = mapViewportOf({ width: 120, height: 36 })
  const projection = projectWorld(model, { viewport, currentId: 'observed:pleft' })
  assert.equal(projection.currentId, 'observed:cleft')
  const container = projection.items.find(item => item.representationId === 'observed:cleft')!
  assert.equal(container.shape, 'slab')
  assert.equal(visibleIn(container.cellBounds, viewport), true)
})
