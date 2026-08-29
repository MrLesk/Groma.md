import assert from 'node:assert/strict'

import { test } from 'bun:test'

import { loadArchitectureViewModel } from '../src/core.ts'
import {
  LANE_GAP,
  ROUTE_UNIT,
  crossingRouteIdsFor,
  visibleObstacle,
  type Endpoint,
  type FlatRoute,
  type Point,
} from '../src/sheet/route-geometry.ts'
import { artifactRouteIds, orthogonal, routeSpacingIndex } from '../src/sheet/route-spacing.ts'
import { routeAll } from '../src/sheet/route.ts'
import { sheetScene } from '../src/sheet/scene.ts'
import type { SheetScene } from '../src/sheet/types.ts'
import type { ArchitectureWorld } from '../src/types.ts'
import { box, openclawFixtureRoot, uses, viewerFixtureRoot, worldOf } from './helpers.ts'

const unit = { x: 0, y: 0, width: 1, height: 1 }

function endpointsOf(scene: SheetScene): Map<string, Endpoint> {
  const endpoints = new Map<string, Endpoint>()
  for (const island of scene.islands) {
    endpoints.set(island.key, { key: island.key, kind: 'island', rect: island.rect })
    if (island.element) endpoints.set(island.element.representationId, endpoints.get(island.key)!)
  }
  for (const slab of scene.slabs) {
    endpoints.set(slab.representationId, {
      key: slab.representationId,
      kind: 'slab',
      rect: slab.rect,
      owner: slab.island,
    })
  }
  for (const building of scene.buildings) {
    endpoints.set(building.representationId, {
      key: building.representationId,
      kind: 'building',
      rect: building.rect,
      owner: building.surface,
      roof: building.heightUnits,
      centrePorts: building.shape.kind === 'round',
    })
  }
  return endpoints
}

function flatRoutes(scene: SheetScene): FlatRoute[] {
  return scene.routes.map(route => ({
    ...route,
    points: route.points.map(point => ({ x: point.gx * ROUTE_UNIT, y: point.gy * ROUTE_UNIT })),
  }))
}

function pointOnSegment(point: Point, from: Point, to: Point): boolean {
  const cross = (point.x - from.x) * (to.y - from.y) - (point.y - from.y) * (to.x - from.x)
  if (Math.abs(cross) > 0.01) return false
  return point.x >= Math.min(from.x, to.x) - 0.01
    && point.x <= Math.max(from.x, to.x) + 0.01
    && point.y >= Math.min(from.y, to.y) - 0.01
    && point.y <= Math.max(from.y, to.y) + 0.01
}

function onVisibleBoundary(point: Point, endpoint: Endpoint): boolean {
  const polygon = visibleObstacle(endpoint)
  return polygon.some((from, index) => pointOnSegment(point, from, polygon[(index + 1) % polygon.length]!))
}

async function fixture(root: string): Promise<{ scene: SheetScene; world: ArchitectureWorld }> {
  const { world } = await loadArchitectureViewModel(root)
  return { scene: sheetScene(world), world }
}

test.concurrent('every authored relationship gets one deterministic orthogonal route with attached ends', async () => {
  const { scene, world } = await fixture(viewerFixtureRoot)
  const repeat = sheetScene(world)
  const endpoints = endpointsOf(scene)
  const routes = flatRoutes(scene)

  assert.deepEqual(scene.routes.map(route => route.id), world.relationships.map(route => route.id))
  assert.deepEqual(repeat.routes, scene.routes)
  for (const route of routes) {
    assert.ok(route.points.length >= 2)
    assert.equal(orthogonal(route.points), true, route.id)
    assert.equal(onVisibleBoundary(route.points[0]!, endpoints.get(route.source)!), true, `${route.id} source`)
    assert.equal(onVisibleBoundary(route.points.at(-1)!, endpoints.get(route.target)!), true, `${route.id} target`)
    for (let index = 1; index < route.points.length; index += 1) {
      assert.notDeepEqual(route.points[index], route.points[index - 1], `${route.id} repeats a point`)
    }
  }
})

test.concurrent('fixture routes avoid buildings and never share a path', async () => {
  for (const root of [viewerFixtureRoot, openclawFixtureRoot]) {
    const { scene } = await fixture(root)
    const endpoints = endpointsOf(scene)
    const routes = flatRoutes(scene)
    const ids = new Set(routes.map(route => route.id))
    const [spacing] = routeSpacingIndex(routes, ids).measure(routes, [LANE_GAP])

    assert.deepEqual(crossingRouteIdsFor(endpoints)(routes), [])
    assert.equal(spacing.sharedPathLength, 0)
  }
})

test.concurrent('the supported viewer fixture has no staircase, reversal, or overloaded fan artifact', async () => {
  const { scene } = await fixture(viewerFixtureRoot)
  assert.deepEqual(artifactRouteIds(flatRoutes(scene)), [])
})

test.concurrent('parallel relationships remain individual and use distinct ports and lanes', () => {
  const scene = sheetScene(worldOf([
    box('shop', 'system', unit),
    box('api', 'container', unit, { parent: 'observed:shop' }),
    box('a', 'component', unit, { parent: 'observed:api' }),
    box('b', 'component', unit, { parent: 'observed:api' }),
  ], [0, 1, 2].map(index => uses(`relationship:${index}`, 'a', 'b'))))
  const routes = flatRoutes(scene)
  const ports = (at: 'start' | 'end'): Set<string> => new Set(routes.map(route => {
    const point = at === 'start' ? route.points[0]! : route.points.at(-1)!
    return `${point.x},${point.y}`
  }))
  const [spacing] = routeSpacingIndex(routes, new Set(routes.map(route => route.id)))
    .measure(routes, [LANE_GAP])

  assert.equal(routes.length, 3)
  assert.equal(ports('start').size, 3)
  assert.equal(ports('end').size, 3)
  assert.equal(spacing.sharedPathLength, 0)
})

test.concurrent('container geography chooses ports even when local component positions suggest the opposite', () => {
  const endpoints = new Map<string, Endpoint>([
    ['west', { key: 'west', kind: 'slab', rect: { gx: 0, gy: 4, w: 8, d: 8 } }],
    ['east', { key: 'east', kind: 'slab', rect: { gx: 16, gy: 4, w: 8, d: 8 } }],
    ['source', { key: 'source', kind: 'building', rect: { gx: 12, gy: 7, w: 2, d: 2 }, owner: 'west', roof: 1 }],
    ['target', { key: 'target', kind: 'building', rect: { gx: 4, gy: 7, w: 2, d: 2 }, owner: 'east', roof: 1 }],
  ])
  const [route] = routeAll(endpoints, [{
    id: 'relationship:0',
    source: 'source',
    target: 'target',
    description: 'uses',
    origin: 'observed',
  }])

  assert.equal(route!.points[0]!.gx, 14)
  assert.equal(route!.points.at(-1)!.gx, 3.5)
})

test.concurrent('routing fails clearly when a relationship names an element that was not placed', () => {
  assert.throws(() => routeAll(new Map(), [{
    id: 'relationship:missing',
    source: 'missing-source',
    target: 'missing-target',
    description: 'uses',
    origin: 'observed',
  }]), /relationship:missing/)
})
