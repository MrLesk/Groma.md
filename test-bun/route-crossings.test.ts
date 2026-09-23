import assert from 'node:assert/strict'
import { test } from 'bun:test'
import { routeAll } from '../src/sheet/route/route.ts'
import type { Endpoint, FlatRoute } from '../src/sheet/route/geometry.ts'
import { ROUTE_UNIT } from '../src/sheet/route/space.ts'
import { orthogonal, sharedPathMeasure, crossingRouteIdsFor, routesCross } from '../src/sheet/route/checks.ts'

// Diagonally paired corners admit separate paths around the outside, but the
// distance-only router sends both through the middle and crosses them.
test.concurrent('routing goes around a crossing when the endpoints have a clear outer path', () => {
  const positions = [[0, 0], [12, 12], [0, 12], [12, 0]] as const
  const endpoints = new Map<string, Endpoint>(positions.map(([gx, gy], index) => [String(index), {
    key: String(index), kind: 'building', rect: { gx, gy, w: 2, d: 2 },
  }]))
  const requests = [[0, 1], [2, 3]].map(([source, target], index) => ({
    id: String(index), source: String(source), target: String(target), description: '', origin: 'observed' as const,
  }))
  const before = structuredClone(endpoints)
  const routes = routeAll(endpoints, requests)
  const flat: FlatRoute[] = routes.map(route => ({
    ...route, points: route.points.map(point => ({ x: point.gx * ROUTE_UNIT, y: point.gy * ROUTE_UNIT })),
  }))

  assert.equal(routesCross(flat[0]!, flat[1]!), false)
  assert.deepEqual(flat.map(({ id, source, target }) => ({ id, source, target })),
    requests.map(({ id, source, target }) => ({ id, source, target })))
  assert.ok(flat.every(route => orthogonal(route.points)))
  assert.deepEqual(crossingRouteIdsFor(endpoints)(flat), [])
  assert.equal(sharedPathMeasure(flat, new Set(flat.map(route => route.id)))(flat), 0)
  assert.deepEqual(endpoints, before)
  assert.deepEqual(routeAll(endpoints, requests), routes)
})
