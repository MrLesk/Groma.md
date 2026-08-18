import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { projectWorld } from '../src/viewers/tui/projection.ts'
import type { ArchitectureWorld, WorldElement } from '../src/types.ts'
import { box } from './helpers.ts'

function routeWorld(target: 'container' | 'system'): ArchitectureWorld {
  const person: WorldElement = {
    representationId: 'observed:ann',
    id: 'ann',
    kind: 'person',
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
    elements: [person, system, container],
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
  assert.equal(relationship.displayTarget, 'observed:api')
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

/**
 * One system holding three containers with a component each, and a
 * relationship between two of them: at Components only the focused
 * container's relationships normally draw.
 */
function threeContainerWorld(): ArchitectureWorld {
  return {
    bounds: { x: 0, y: 0, width: 200, height: 60 },
    groups: [],
    elements: [
      box('shop', 'system', { x: 10, y: 0, width: 180, height: 56 }, {
        children: ['observed:api', 'observed:store', 'observed:jobs'],
      }),
      box('api', 'container', { x: 16, y: 6, width: 40, height: 40 }, {
        parent: 'observed:shop',
        children: ['observed:handler'],
      }),
      box('store', 'container', { x: 80, y: 6, width: 40, height: 40 }, {
        parent: 'observed:shop',
        children: ['observed:table'],
      }),
      box('jobs', 'container', { x: 140, y: 6, width: 40, height: 40 }, {
        parent: 'observed:shop',
        children: ['observed:worker'],
      }),
      box('handler', 'component', { x: 20, y: 12, width: 14, height: 8 }, {
        parent: 'observed:api',
      }),
      box('table', 'component', { x: 84, y: 12, width: 14, height: 8 }, {
        parent: 'observed:store',
      }),
      box('worker', 'component', { x: 144, y: 12, width: 14, height: 8 }, {
        parent: 'observed:jobs',
      }),
    ],
    relationships: [{
      id: 'table-worker',
      source: 'observed:table',
      target: 'observed:worker',
      description: 'queues',
      technology: '',
      origin: 'observed',
      route: [{ x: 98, y: 26 }, { x: 144, y: 26 }],
      label: null,
    }],
  }
}

test.concurrent('a lit route draws at a level that would otherwise hide it', () => {
  const world = threeContainerWorld()
  const view = {
    viewport: { x: 0, y: 0, width: 100, height: 36 },
    level: 'components' as const,
    // Focus sits in Api, so neither end of the queueing route is in frame.
    currentId: 'observed:handler',
  }
  const hidden = projectWorld(world, view)
  assert.equal(hidden.relationships.length, 0)

  const lit = projectWorld(world, { ...view, litIds: new Set(['table-worker']) })
  const route = lit.relationships.find(item => item.id === 'table-worker')
  assert.ok(route)
  // Its components are out of frame, so it promotes to their containers.
  assert.equal(route.displaySource, 'observed:store')
  assert.equal(route.displayTarget, 'observed:jobs')

  // Element geometry is untouched by lighting the walk.
  assert.deepEqual(
    lit.elements.map(item => item.cellBounds),
    hidden.elements.map(item => item.cellBounds),
  )
})
