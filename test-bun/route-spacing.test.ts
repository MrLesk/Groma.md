import { expect, test } from 'bun:test'
import { ROUTE_UNIT, crossingRouteIdsFor, type Endpoint, type FlatRoute } from '../src/sheet/route-geometry.ts'
import { orthogonal, separateRoutes, sharedPathMeasure } from '../src/sheet/route-spacing.ts'

test.concurrent('parallel strokes with distinct coordinates separate without losing endpoints or direction', () => {
  const building = (key: string, gx: number, gy: number): Endpoint => ({
    key, kind: 'building', rect: { gx, gy, w: 2, d: 2 },
  })
  const endpoints = new Map([
    building('a', 0, 0), building('b', 12, 0), building('c', 0, 6), building('d', 12, 6),
  ].map(endpoint => [endpoint.key, endpoint]))
  const route = (id: string, source: string, target: string, points: number[][]): FlatRoute => ({
    id, source, target, description: '', origin: 'observed',
    points: points.map(([x, y]) => ({ x: x! * ROUTE_UNIT, y: y! * ROUTE_UNIT })),
  })
  const routes = [
    route('first', 'a', 'b', [[2, 1], [4, 1], [4, 3], [10, 3], [10, 1], [12, 1]]),
    route('second', 'c', 'd', [[2, 7], [5, 7], [5, 3.04], [9, 3.04], [9, 7], [12, 7]]),
  ]
  const before = structuredClone(routes)
  const ids = new Set(routes.map(route => route.id))
  expect(sharedPathMeasure(routes, ids)(routes)).toBeGreaterThan(0)

  separateRoutes(endpoints, routes)

  expect(sharedPathMeasure(routes, ids)(routes)).toBe(0)
  expect(crossingRouteIdsFor(endpoints)(routes)).toEqual([])
  expect(routes.map(({ id, source, target }) => ({ id, source, target })))
    .toEqual(before.map(({ id, source, target }) => ({ id, source, target })))
  for (const [index, route] of routes.entries()) {
    expect(orthogonal(route.points)).toBe(true)
    expect(route.points[0]).toEqual(before[index]!.points[0])
    expect(route.points.at(-1)).toEqual(before[index]!.points.at(-1))
  }
  const separated = structuredClone(routes)
  separateRoutes(endpoints, routes)
  expect(routes).toEqual(separated)
})
