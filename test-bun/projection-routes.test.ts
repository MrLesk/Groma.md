import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { projectWorld } from '../src/viewers/tui/projection.ts'
import type { ArchitectureWorld, WorldElement } from '../src/types.ts'
import { box } from './helpers.ts'

function routeWorld(target: 'container' | 'system'): ArchitectureWorld {
  const actor: WorldElement = {
    representationId: 'observed:ann',
    id: 'ann',
    kind: 'actor',
    name: 'Ann',
    description: '',
    parent: null,
    children: [],
    external: false,
    code: [],
    origin: 'observed',
    bounds: { x: 0, y: 0, width: 20, height: 20 },
  }
  const system: WorldElement = {
    representationId: 'observed:shop',
    id: 'shop',
    kind: 'system',
    name: 'Shop',
    description: '',
    parent: null,
    children: ['observed:api'],
    external: false,
    code: [],
    origin: 'observed',
    bounds: { x: 40, y: 0, width: 80, height: 80 },
  }
  const container: WorldElement = {
    representationId: 'observed:api',
    id: 'api',
    kind: 'container',
    name: 'Api',
    description: '',
    parent: 'observed:shop',
    children: [],
    external: false,
    code: [],
    origin: 'observed',
    bounds: { x: 70, y: 50, width: 20, height: 20 },
  }
  return {
    bounds: { x: 0, y: 0, width: 140, height: 200 },
    groups: [],
    elements: [actor, system, container],
    relationships: [{
      id: 'reads',
      source: 'observed:ann',
      target: target === 'container' ? 'observed:api' : 'observed:shop',
      description: 'Reads the architecture',
      technology: '',
      origin: 'observed',
      route: [
        { x: 10, y: 10 },
        { x: 30, y: 10 },
        { x: 30, y: 180 },
        { x: 80, y: 180 },
        { x: 80, y: 60 },
      ],
      label: { x: 30, y: 180, width: 10, height: 2 },
    }],
  }
}

test.concurrent('a route reaches its displayed endpoint inside an ancestor boundary', () => {
  const world = routeWorld('container')
  const projection = projectWorld(world, {
    viewport: { x: 0, y: 0, width: 80, height: 36 },
    level: 'context',
    currentId: 'observed:ann',
  })
  const relationship = projection.relationships[0]
  assert.ok(relationship)
  assert.equal(relationship.displaySource, 'observed:ann')
  assert.equal(relationship.displayTarget, 'observed:shop')
})

test.concurrent('authored endpoint routes keep their laid-out bend', () => {
  const world = routeWorld('system')
  const projection = projectWorld(world, {
    viewport: { x: 0, y: 0, width: 80, height: 36 },
    level: 'context',
    currentId: 'observed:ann',
    camera: { zoom: 1, centerX: 70, centerY: 100 },
  })
  const route = projection.relationships[0]?.cellRoute
  assert.ok(route)
  const ys = new Set(route.map(point => point.y))
  assert.ok(ys.size > 1)
})

function containerFlowWorld(): ArchitectureWorld {
  return {
    bounds: { x: 0, y: 0, width: 200, height: 60 },
    groups: [],
    elements: [
      box('shop', 'system', { x: 10, y: 0, width: 180, height: 56 }, {
        children: ['observed:api', 'observed:store'],
      }),
      box('api', 'container', { x: 16, y: 6, width: 40, height: 40 }, {
        parent: 'observed:shop',
        children: ['observed:handler'],
      }),
      box('store', 'container', { x: 80, y: 6, width: 40, height: 40 }, {
        parent: 'observed:shop',
        children: ['observed:table'],
      }),
      box('handler', 'component', { x: 20, y: 12, width: 14, height: 8 }, {
        parent: 'observed:api',
      }),
      box('table', 'component', { x: 84, y: 12, width: 14, height: 8 }, {
        parent: 'observed:store',
      }),
    ],
    relationships: [{
      id: 'handler-table',
      source: 'observed:handler',
      target: 'observed:table',
      description: 'stores',
      technology: '',
      origin: 'observed',
      route: [{ x: 34, y: 26 }, { x: 84, y: 26 }],
      label: null,
    }],
  }
}

test.concurrent('lighting a promoted container route leaves its geometry stable', () => {
  const world = containerFlowWorld()
  const view = {
    viewport: { x: 0, y: 0, width: 100, height: 36 },
    level: 'components' as const,
    currentId: 'observed:handler',
  }
  const normal = projectWorld(world, view)
  const lit = projectWorld(world, { ...view, litIds: new Set(['handler-table']) })
  const route = lit.relationships.find(item => item.id === 'handler-table')
  assert.ok(route)
  assert.equal(route.displaySource, 'observed:handler')
  assert.equal(route.displayTarget, 'observed:api')

  assert.deepEqual(
    lit.elements.map(item => item.cellBounds),
    normal.elements.map(item => item.cellBounds),
  )
  assert.deepEqual(route.cellRoute, normal.relationships[0]?.cellRoute)
})
