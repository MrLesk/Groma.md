import assert from 'node:assert/strict'

import { test } from 'bun:test'

import { loadAnnotatedArchitecture } from '../src/core.ts'
import {
  ROUTE_CLEARANCE,
  ROUTE_UNIT,
  crossingRouteIdsFor,
  visibleObstacle,
  type Endpoint,
  type FlatRoute,
  type Point,
} from '../src/sheet/route-geometry.ts'
import { artifactRouteIds, orthogonal, sharedPathMeasure } from '../src/sheet/route-spacing.ts'
import { routeAll } from '../src/sheet/route.ts'
import { orderBuildingFans } from '../src/sheet/route-finish.ts'
import { sheetScene } from '../src/sheet/scene.ts'
import type { SheetScene } from '../src/sheet/types.ts'
import type { ArchitectureGraph } from '../src/types.ts'
import { openclawFixtureRoot, viewerFixtureRoot } from './helpers.ts'


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

function onVisibleCorner(point: Point, endpoint: Endpoint): boolean {
  return visibleObstacle(endpoint).some(corner =>
    Math.abs(point.x - corner.x) < 0.01 && Math.abs(point.y - corner.y) < 0.01)
}

function endpointRunLength(points: readonly Point[], fromStart: boolean): number {
  const ordered = fromStart ? points : [...points].reverse()
  const first = { x: ordered[1]!.x - ordered[0]!.x, y: ordered[1]!.y - ordered[0]!.y }
  let length = 0
  for (let index = 1; index < ordered.length; index += 1) {
    const step = { x: ordered[index]!.x - ordered[index - 1]!.x, y: ordered[index]!.y - ordered[index - 1]!.y }
    if (Math.abs(first.x * step.y - first.y * step.x) >= 0.01
      || first.x * step.x + first.y * step.y <= 0) break
    length += Math.abs(step.x) + Math.abs(step.y)
  }
  return length
}

function segmentsCross(a0: Point, a1: Point, b0: Point, b1: Point): boolean {
  const between = (value: number, from: number, to: number) =>
    value > Math.min(from, to) + 0.01 && value < Math.max(from, to) - 0.01
  const aHorizontal = Math.abs(a0.y - a1.y) < 0.01
  const bHorizontal = Math.abs(b0.y - b1.y) < 0.01
  if (aHorizontal === bHorizontal) return false
  const [horizontal0, horizontal1] = aHorizontal ? [a0, a1] : [b0, b1]
  const [vertical0, vertical1] = aHorizontal ? [b0, b1] : [a0, a1]
  return between(vertical0.x, horizontal0.x, horizontal1.x)
    && between(horizontal0.y, vertical0.y, vertical1.y)
}

function routesCross(a: FlatRoute, b: FlatRoute): boolean {
  for (let left = 1; left < a.points.length; left += 1) {
    for (let right = 1; right < b.points.length; right += 1) {
      const a0 = a.points[left - 1]!
      const a1 = a.points[left]!
      const b0 = b.points[right - 1]!
      const b1 = b.points[right]!
      if (segmentsCross(a0, a1, b0, b1)) return true
    }
  }
  return false
}

async function fixture(root: string): Promise<{ scene: SheetScene; world: ArchitectureGraph }> {
  const world = await loadAnnotatedArchitecture(root)
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
    assert.ok(endpointRunLength(route.points, true) >= ROUTE_CLEARANCE - 0.01, `${route.id} source run`)
    assert.ok(endpointRunLength(route.points, false) >= ROUTE_CLEARANCE - 0.01, `${route.id} target run`)
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
    const shared = sharedPathMeasure(routes, ids)(routes)

    assert.deepEqual(crossingRouteIdsFor(endpoints)(routes), [])
    assert.equal(shared, 0)
  }
})

test.concurrent('the supported viewer fixture has no staircase, reversal, or overloaded fan artifact', async () => {
  const { scene } = await fixture(viewerFixtureRoot)
  assert.deepEqual(artifactRouteIds(flatRoutes(scene)), [])
})


test.concurrent('a busy building still routes every relationship', () => {
  const building = (key: string, gx: number, gy: number): Endpoint => ({
    key,
    kind: 'building',
    rect: { gx, gy, w: 3, d: 2 },
    owner: 'surface',
    roof: 1,
  })
  const endpoints = new Map<string, Endpoint>([['hub', building('hub', 20, 20)]])
  const requests = Array.from({ length: 12 }, (_, index) => {
    const key = `node-${index}`
    endpoints.set(key, building(key, index * 5, 2 + (index % 2) * 4))
    return {
      id: `relationship:${index}`,
      source: key,
      target: 'hub',
      description: 'Uses the hub',
      origin: 'observed' as const,
    }
  })

  const routes = routeAll(endpoints, requests)

  assert.equal(routes.length, requests.length)
})

test.concurrent('connected elements choose ports independently of their owner surfaces', () => {
  const routeTo = (targetY: number) => routeAll(new Map<string, Endpoint>([
    ['west-owner', { key: 'west-owner', kind: 'slab', rect: { gx: 0, gy: 4, w: 8, d: 8 } }],
    ['east-owner', { key: 'east-owner', kind: 'slab', rect: { gx: 16, gy: 4, w: 8, d: 8 } }],
    ['source', {
      key: 'source',
      kind: 'building',
      rect: { gx: 12, gy: 7, w: 2, d: 2 },
      owner: 'west-owner',
      roof: 1,
    }],
    ['target', {
      key: 'target',
      kind: 'building',
      rect: { gx: 4, gy: targetY, w: 2, d: 2 },
      owner: 'east-owner',
      roof: 1,
    }],
  ]), [{
    id: 'relationship:0',
    source: 'source',
    target: 'target',
    description: 'uses',
    origin: 'observed',
  }])[0]!

  const north = routeTo(0)
  const south = routeTo(16)
  assert.ok(north.points[1]!.gy < north.points[0]!.gy)
  assert.ok(south.points[1]!.gy > south.points[0]!.gy)
})

test.concurrent('overlapping facing walls share one straight route coordinate', () => {
  const endpoints = new Map<string, Endpoint>([
    ['source', { key: 'source', kind: 'building', rect: { gx: 0, gy: 10, w: 3, d: 2 }, roof: 3.5 }],
    ['target', { key: 'target', kind: 'building', rect: { gx: 7, gy: 10, w: 3, d: 3 }, roof: 3.5 }],
  ])
  const [route] = routeAll(endpoints, [{
    id: 'relationship:0',
    source: 'source',
    target: 'target',
    description: 'uses',
    origin: 'observed',
  }])

  assert.equal(route!.points.length, 2)
  assert.equal(route!.points[0]!.gy, route!.points[1]!.gy)
})

test.concurrent('a facing route stays inside both wall spans instead of attaching at a corner', () => {
  const endpoints = new Map<string, Endpoint>([
    ['source', { key: 'source', kind: 'building', rect: { gx: 2, gy: 8, w: 4, d: 3 }, roof: 4 }],
    ['target', { key: 'target', kind: 'building', rect: { gx: 0, gy: 0, w: 3, d: 2 }, roof: 3.5 }],
  ])
  const [route] = routeAll(endpoints, [{
    id: 'relationship:0',
    source: 'source',
    target: 'target',
    description: 'uses',
    origin: 'observed',
  }])
  const points = route!.points.map(point => ({ x: point.gx * ROUTE_UNIT, y: point.gy * ROUTE_UNIT }))

  assert.equal(points.length, 2)
  assert.equal(onVisibleCorner(points[0]!, endpoints.get('source')!), false)
  assert.equal(onVisibleCorner(points.at(-1)!, endpoints.get('target')!), false)
})

test.concurrent('a corner-only facing overlap keeps the routed dogleg', () => {
  const endpoints = new Map<string, Endpoint>([
    ['source', { key: 'source', kind: 'building', rect: { gx: 0, gy: 0, w: 2, d: 2 }, roof: 3 }],
    ['target', { key: 'target', kind: 'building', rect: { gx: 8, gy: 0, w: 2, d: 2 }, roof: 4 }],
  ])
  const [route] = routeAll(endpoints, [{
    id: 'relationship:0',
    source: 'source',
    target: 'target',
    description: 'uses',
    origin: 'observed',
  }])
  const points = route!.points.map(point => ({ x: point.gx * ROUTE_UNIT, y: point.gy * ROUTE_UNIT }))

  assert.equal(points.length, 4)
  assert.equal(onVisibleCorner(points[0]!, endpoints.get('source')!), false)
  assert.equal(onVisibleCorner(points.at(-1)!, endpoints.get('target')!), false)
})

test.concurrent('nested routes sharing a building side use a non-crossing pin order', () => {
  const endpoints = new Map<string, Endpoint>([
    ['source', { key: 'source', kind: 'building', rect: { gx: 10, gy: 0, w: 3, d: 5 }, roof: 1 }],
    ['blocker', { key: 'blocker', kind: 'building', rect: { gx: 6, gy: 0, w: 2, d: 5 }, roof: 1 }],
    ['near', { key: 'near', kind: 'building', rect: { gx: 3, gy: 15, w: 4, d: 2 }, roof: 1 }],
    ['middle', { key: 'middle', kind: 'building', rect: { gx: 6.5, gy: 23, w: 3, d: 3 }, roof: 1 }],
    ['far', { key: 'far', kind: 'building', rect: { gx: 5, gy: 31, w: 4, d: 3 }, roof: 1 }],
  ])
  const targets = ['near', 'middle', 'far']
  const routes: FlatRoute[] = routeAll(endpoints, targets.map((target, index) => ({
    id: `relationship:${index}`,
    source: 'source',
    target,
    description: 'uses',
    origin: 'observed',
  }))).map(route => ({
    ...route,
    points: route.points.map(point => ({ x: point.gx, y: point.gy })),
  }))

  assert.deepEqual(routes.map(route => [route.source, route.target]), targets.map(target => ['source', target]))
  assert.equal(routes.some((route, index) => routes.slice(index + 1).some(other => routesCross(route, other))), false)
})

test.concurrent('mixed turns do not block a non-crossing shared-side pin order', () => {
  const endpoints = new Map<string, Endpoint>([
    ['blocker', { key: 'blocker', kind: 'building', rect: { gx: 0, gy: 5, w: 5, d: 5 }, roof: 1 }],
    ['source', { key: 'source', kind: 'building', rect: { gx: 0, gy: 12, w: 4, d: 4 }, roof: 1 }],
    ['early-north', { key: 'early-north', kind: 'building', rect: { gx: 15, gy: 0, w: 3, d: 3 }, roof: 1 }],
    ['later-north', { key: 'later-north', kind: 'building', rect: { gx: 15, gy: 7, w: 3, d: 3 }, roof: 1 }],
    ['south', { key: 'south', kind: 'building', rect: { gx: 15, gy: 30, w: 2, d: 4 }, roof: 1 }],
  ])
  // Exercise fan ordering before shortcuts may select another central wall.
  const paths = [
    { target: 'early-north', points: [[4, 15], [12, 15], [12, 1], [14.5, 1]] },
    { target: 'south', points: [[4, 14], [10, 14], [10, 31], [14.5, 31]] },
    { target: 'later-north', points: [[4, 13], [14, 13], [14, 8], [14.5, 8]] },
  ]
  const routes: FlatRoute[] = paths.map(({ target, points }, index) => ({
    id: `relationship:${index}`,
    source: 'source',
    target,
    description: 'uses',
    origin: 'observed',
    points: points.map(([x, y]) => ({ x: x! * ROUTE_UNIT, y: y! * ROUTE_UNIT })),
  }))
  assert.equal(routes.some((route, index) => routes.slice(index + 1).some(other => routesCross(route, other))), true)
  orderBuildingFans(endpoints, routes)
  const byTarget = new Map(routes.map(route => [route.target, route]))
  const early = byTarget.get('early-north')!
  const later = byTarget.get('later-north')!
  const south = byTarget.get('south')!

  assert.ok(early.points[0]!.y < later.points[0]!.y)
  assert.ok(early.points[2]!.y < early.points[1]!.y)
  assert.ok(later.points[2]!.y < later.points[1]!.y)
  assert.ok(south.points[2]!.y > south.points[1]!.y)
  assert.equal(routes.some((route, index) => routes.slice(index + 1).some(other => routesCross(route, other))), false)
})

test.concurrent('routing fails clearly when a relationship names an element that was not placed', () => {
  assert.throws(() => routeAll(new Map(), [{
    id: 'relationship:missing',
    source: 'missing-source',
    target: 'missing-target',
    description: 'uses',
    origin: 'observed',
  }]))
})
