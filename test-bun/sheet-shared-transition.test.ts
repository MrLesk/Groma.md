import assert from 'node:assert/strict'

import { test } from 'bun:test'

import {
  LANE_GAP,
  ROUTE_UNIT,
  crossingRouteIdsFor,
  visibleObstacle,
  type Endpoint,
  type Point,
} from '../src/sheet/route-geometry.ts'
import { orthogonal, routeSpacingIndex } from '../src/sheet/route-spacing.ts'
import { refineRoutes } from '../src/sheet/route-lanes.ts'
import { routeAll } from '../src/sheet/route.ts'

function onBoundary(point: Point, endpoint: Endpoint): boolean {
  const polygon = visibleObstacle(endpoint)
  return polygon.some((from, index) => {
    const to = polygon[(index + 1) % polygon.length]!
    const cross = (point.x - from.x) * (to.y - from.y) - (point.y - from.y) * (to.x - from.x)
    return Math.abs(cross) < 0.01
      && point.x >= Math.min(from.x, to.x) - 0.01 && point.x <= Math.max(from.x, to.x) + 0.01
      && point.y >= Math.min(from.y, to.y) - 0.01 && point.y <= Math.max(from.y, to.y) + 0.01
  })
}

test.concurrent('long middle transitions separate routes through a constrained corridor', () => {
  const building = (key: string, gx: number, gy: number, w: number, d: number, roof: number): Endpoint =>
    ({ key, kind: 'building', rect: { gx, gy, w, d }, roof })
  const endpoints = new Map<string, Endpoint>([
    ['project', building('project', 34.16, 144.42, 3, 2, 2)],
    ['server', building('server', 29.44, 185.72, 4, 4, 4.5)],
    ['source', building('source', 40.06, 177.46, 3, 5, 7.5)],
    ['near', building('near', 31.8, 208.14, 3, 3, 10)],
    ['far', building('far', 29.44, 216.4, 4, 2, 6)],
    ['left-blocker', building('left-blocker', 28.26, 198.7, 4, 2, 3.5)],
    ['right-blocker', building('right-blocker', 38.88, 198.7, 4, 2, 4)],
  ])
  const requests = [
    { id: 'relationship:0', source: 'project', target: 'server' },
    { id: 'relationship:1', source: 'source', target: 'near' },
    { id: 'relationship:2', source: 'source', target: 'far' },
  ].map(request => ({ ...request, description: 'Uses', origin: 'observed' as const }))

  const routes = routeAll(endpoints, requests).map(route => ({
    ...route,
    points: route.points.map(point => ({ x: point.gx * ROUTE_UNIT, y: point.gy * ROUTE_UNIT })),
  }))
  const [spacing] = routeSpacingIndex(routes, new Set(routes.map(route => route.id))).measure(routes, [LANE_GAP])

  assert.equal(crossingRouteIdsFor(endpoints)(routes).length, 0)
  assert.equal(spacing.sharedPathLength, 0)
  for (const route of routes) {
    assert.ok(onBoundary(route.points[0]!, endpoints.get(route.source)!))
    assert.ok(onBoundary(route.points.at(-1)!, endpoints.get(route.target)!))
  }
})

test.concurrent('a shared highway may separate across its existing route conflicts', () => {
  const routes = [
    { id: 'a', source: 'left-a', target: 'right-a', points: [{ x: 0, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 500 }, { x: 200, y: 500 }] },
    { id: 'b', source: 'left-a', target: 'right-b', points: [{ x: 0, y: 130 }, { x: 100, y: 130 }, { x: 100, y: 250 }, { x: 200, y: 250 }] },
    { id: 'c', source: 'right-c', target: 'right-d', points: [{ x: 200, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 450 }, { x: 200, y: 450 }] },
    { id: 'd', source: 'left-d', target: 'right-c', points: [{ x: 0, y: 260 }, { x: 100, y: 260 }, { x: 100, y: 30 }, { x: 200, y: 30 }] },
  ].map(route => ({ ...route, description: 'Uses', origin: 'observed' as const }))

  const refined = refineRoutes(new Map(), routes)
  const [spacing] = routeSpacingIndex(refined, new Set(refined.map(route => route.id))).measure(refined, [LANE_GAP])

  assert.equal(spacing.sharedPathLength, 0)
})

test.concurrent('separating free interior bends keeps two clean corners and fixed endpoints', () => {
  const routes = [
    { id: 'a', source: 'source-a', target: 'target-a', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 300 }, { x: 200, y: 300 }] },
    { id: 'b', source: 'source-b', target: 'target-b', points: [{ x: 0, y: 60 }, { x: 100, y: 60 }, { x: 100, y: 240 }, { x: 200, y: 240 }] },
  ].map(route => ({ ...route, description: 'Uses', origin: 'observed' as const }))
  const original = structuredClone(routes)
  const refined = refineRoutes(new Map(), routes)
  const [spacing] = routeSpacingIndex(refined, new Set(refined.map(route => route.id))).measure(refined, [LANE_GAP])

  for (const [index, route] of refined.entries()) {
    assert.equal(route.points.length, 4)
    assert.ok(orthogonal(route.points))
    assert.deepEqual(route.points[0], routes[index]!.points[0])
    assert.deepEqual(route.points.at(-1), routes[index]!.points.at(-1))
  }
  assert.equal(spacing.sharedPathLength, 0)
  assert.equal(spacing.crowdedBodyLength, 0)
  assert.deepEqual(routes, original)
})
