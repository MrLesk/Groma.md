/*
 * The routing domain: it draws every map relationship as an orthogonal line between placed elements. From outside this
 * folder the sheet uses only routeAll here, mapRelationships (relationships.ts) for the relationships to draw, and the
 * shared units in space.ts that placement reserves route room with.
 */

import type { Route } from '../types.ts'
import { crossingRouteIdsFor, sharedPathMeasure } from './checks.ts'
import { alignFacingRoutes, compactPath, orderBuildingFans, shortenDirect, shortenEnds } from './finish.ts'
import { EPSILON, type Endpoint, type FlatRoute, type RouteRequest } from './geometry.ts'
import { routeGraph, type Box } from './graph.ts'
import { nudgeRoutes } from './nudge.ts'
import { RoutePaths } from './paths.ts'
import { portChoices, portSpan } from './ports.ts'
import { ROUTE_UNIT } from './space.ts'

export type { Endpoint, RouteRequest } from './geometry.ts'

function routeOrder(requests: readonly RouteRequest[]): number[] {
  const degree = new Map<string, number>()
  for (const request of requests) {
    degree.set(request.source, (degree.get(request.source) ?? 0) + 1)
    degree.set(request.target, (degree.get(request.target) ?? 0) + 1)
  }
  const load = (index: number) => Math.max(degree.get(requests[index]!.source)!, degree.get(requests[index]!.target)!)
  // Busy endpoints route first while their channels are still empty.
  return requests.map((_, index) => index).sort((a, b) => load(b) - load(a) || a - b)
}

/** Spreads the found paths into bundles and applies the finishing passes. */
function drawn(endpoints: ReadonlyMap<string, Endpoint>, requests: readonly RouteRequest[], paths: RoutePaths,
  boxes: readonly Box[]): FlatRoute[] {
  const ports = requests.map((_, index) => paths.ports(index))
  // compactPath copies the points, so nudging moves the lines and never the ports.
  const lines = requests.map((_, index) => compactPath([ports[index]!.source.wall, ...paths.points(index), ports[index]!.target.wall]))
  nudgeRoutes(lines, boxes, requests.map((request, index) => ({
    source: { key: request.source, span: portSpan(endpoints.get(request.source)!, ports[index]!.source.side) },
    target: { key: request.target, span: portSpan(endpoints.get(request.target)!, ports[index]!.target.side) },
  })))
  const routes: FlatRoute[] = requests.map((request, index) => ({ ...request, points: compactPath(lines[index]!) }))
  orderBuildingFans(endpoints, routes)
  alignFacingRoutes(endpoints, routes)
  shortenDirect(endpoints, routes)
  shortenEnds(endpoints, routes)
  // Shortcuts can change the order of ends along a shared wall.
  orderBuildingFans(endpoints, routes)
  return routes
}

/**
 * Routes every visible relationship once: each finds a path along the channels between buildings, leaving and
 * entering by the walls that suit it, routes sharing a channel are spread into evenly spaced bundles, and the finishing
 * passes straighten and shorten ends. Routing fails loudly when a drawn route crosses a building or runs on top of
 * another route.
 */
export function routeAll(endpoints: ReadonlyMap<string, Endpoint>, requests: readonly RouteRequest[]): Route[] {
  if (requests.length === 0) return []
  const choices = portChoices(endpoints, requests)
  const graph = routeGraph(endpoints, choices)
  const paths = new RoutePaths(graph, choices)
  const order = routeOrder(requests)
  for (const index of order) {
    if (!paths.route(index)) throw new Error(`Could not route relationship ${requests[index]!.id}`)
  }
  // Every path once more, now that it can see all the others.
  for (const index of order) paths.improve(index)
  const routes = drawn(endpoints, requests, paths, graph.boxes)
  const crossings = crossingRouteIdsFor(endpoints)(routes)
  const shared = sharedPathMeasure(routes, new Set(routes.map(route => route.id)))(routes)
  if (crossings.length > 0 || shared > EPSILON) {
    throw new Error(`Shared sheet routing safety: crossings=${crossings.join(',')}; shared=${shared}`)
  }
  return routes.map(route => ({
    ...route,
    points: compactPath(route.points).map(point => ({ gx: point.x / ROUTE_UNIT, gy: point.y / ROUTE_UNIT })),
  }))
}
