import assert from 'node:assert/strict'

import { test } from 'bun:test'

import {
  ROUTE_UNIT,
  visibleObstacle,
  type Endpoint,
  type Point,
  type RouteRequest,
} from '../src/sheet/route-geometry.ts'
import { routeAll } from '../src/sheet/route.ts'

type BuildingSpec = readonly [key: string, gx: number, gy: number, w: number, d: number, roof: number]

// Minimum geometry that makes Libavoid nudge relationship:37 away from its registered north-wall pin.
const buildingSpecs: readonly BuildingSpec[] = [
  ['block-0', 28.26, 73.62, 3, 3, 3.5],
  ['block-1', 28.26, 66.54, 4, 3, 2.5],
  ['block-2', 35.34, 66.54, 5, 2, 1.5],
  ['block-3', 44.78, 47.66, 3, 3, 2.5],
  ['block-4', 44.78, 54.74, 2, 3, 2.5],
  ['block-5', 144.36, 63.30712802768165, 3, 3, 1.5],
  ['block-6', 144.36, 70.38712802768165, 4, 2, 2.5],
  ['block-7', 144.36, 88.08712802768164, 4, 2, 3],
  ['block-8', 143.18, 104.60712802768165, 5, 2, 2],
  ['block-9', 143.18, 109.32712802768165, 3, 2, 1.5],
  ['block-10', 108.14, 137.62529411764706, 4, 4, 5],
  ['block-11', 37.7, 106.66, 3, 3, 7.5],
  ['block-12', 64.84, 100.76, 4, 3, 2],
  ['block-13', 53.04, 101.94, 4, 3, 4],
  ['block-14', 34.16, 87.78, 4, 3, 4],
  ['block-15', 110.5, 100.40529411764705, 4, 2, 1.5],
  ['block-16', 110.5, 105.12529411764704, 3, 2, 2],
]

const relationshipSpecs = [
  [17, 'block-3', 'block-7'],
  [18, 'block-3', 'block-6'],
  [19, 'block-4', 'block-7'],
  [20, 'block-4', 'block-6'],
  [37, 'block-1', 'block-10'],
  [44, 'block-2', 'block-8'],
  [45, 'block-2', 'block-9'],
  [87, 'block-14', 'block-16'],
  [88, 'block-14', 'block-13'],
] as const

function building([key, gx, gy, w, d, roof]: BuildingSpec): Endpoint {
  return { key, kind: 'building', rect: { gx, gy, w, d }, owner: 'surface', roof }
}

function relationship([id, source, target]: typeof relationshipSpecs[number]): RouteRequest {
  return { id: `relationship:${id}`, source, target, description: 'Uses', origin: 'observed' }
}

function pointOnSegment(point: Point, from: Point, to: Point): boolean {
  const cross = (point.x - from.x) * (to.y - from.y) - (point.y - from.y) * (to.x - from.x)
  return Math.abs(cross) < 0.01
    && point.x >= Math.min(from.x, to.x) - 0.01
    && point.x <= Math.max(from.x, to.x) + 0.01
    && point.y >= Math.min(from.y, to.y) - 0.01
    && point.y <= Math.max(from.y, to.y) + 0.01
}

function onVisibleBoundary(point: Point, endpoint: Endpoint): boolean {
  const polygon = visibleObstacle(endpoint)
  return polygon.some((from, index) => pointOnSegment(point, from, polygon[(index + 1) % polygon.length]!))
}

test.concurrent('nudged busy-building endpoints stay attached to visible boundaries', () => {
  const endpoints = new Map(buildingSpecs.map(spec => [spec[0], building(spec)]))
  const requests = relationshipSpecs.map(relationship)

  const routes = routeAll(endpoints, requests)

  assert.equal(routes.length, requests.length)
  for (const route of routes) {
    const source = endpoints.get(route.source)!
    const target = endpoints.get(route.target)!
    const start = { x: route.points[0]!.gx * ROUTE_UNIT, y: route.points[0]!.gy * ROUTE_UNIT }
    const end = { x: route.points.at(-1)!.gx * ROUTE_UNIT, y: route.points.at(-1)!.gy * ROUTE_UNIT }
    assert.equal(onVisibleBoundary(start, source), true, `${route.id} source`)
    assert.equal(onVisibleBoundary(end, target), true, `${route.id} target`)
  }
})
