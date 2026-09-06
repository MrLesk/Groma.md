import {
  ROUTE_UNIT, assignFixedPorts, attachWalls, crossingRouteIdsFor,
  type Endpoint, type FlatRoute, type PortPair, type RouteRequest,
} from './route-geometry.ts'
import { alignFacingRoutes, compactPath, orderBuildingFans, shortenDirect, shortenEnds } from './route-finish.ts'
import { routeGrid } from './route-grid.ts'
import { RouteSearch } from './route-search.ts'
import { sharedPathMeasure } from './route-spacing.ts'
import type { Route } from './types.ts'

export type { Endpoint, RouteRequest } from './route-geometry.ts'

function routeOrder(requests: readonly RouteRequest[]): number[] {
  const degree = new Map<string, number>()
  for (const request of requests) {
    degree.set(request.source, (degree.get(request.source) ?? 0) + 1)
    degree.set(request.target, (degree.get(request.target) ?? 0) + 1)
  }
  const load = (index: number) => Math.max(degree.get(requests[index]!.source)!, degree.get(requests[index]!.target)!)
  // Busy endpoints route first while the greatest number of tracks is still free.
  return requests.map((_, index) => index).sort((a, b) => load(b) - load(a) || a - b)
}

function portsFor(endpoints: ReadonlyMap<string, Endpoint>, requests: readonly RouteRequest[]): PortPair[] {
  const fixed = assignFixedPorts(endpoints, requests)
  return requests.map(request => {
    const pair = fixed.get(request.id)
    if (!pair?.source || !pair.target) throw new Error(`No fixed ports for ${request.id}`)
    return { source: pair.source, target: pair.target }
  })
}

/** Routes every visible relationship once, keeping buildings clear and paths distinct. */
export function routeAll(endpoints: ReadonlyMap<string, Endpoint>, requests: readonly RouteRequest[]): Route[] {
  if (requests.length === 0) return []
  const ports = portsFor(endpoints, requests)
  const search = new RouteSearch(routeGrid(endpoints, requests, ports))
  const routes: FlatRoute[] = []
  for (const index of routeOrder(requests)) {
    const request = requests[index]!
    const pair = ports[index]!
    const axis = pair.source.side === 'east' || pair.source.side === 'west' ? 0 : 1
    const points = search.route(index, axis, request.id)
    routes[index] = { ...request, points: compactPath(attachWalls(points, pair)) }
  }
  orderBuildingFans(endpoints, routes)
  alignFacingRoutes(endpoints, routes)
  shortenDirect(endpoints, routes)
  shortenEnds(endpoints, routes)
  // Shortcuts can change the order of ends along a shared wall.
  orderBuildingFans(endpoints, routes)
  const crossings = crossingRouteIdsFor(endpoints)(routes)
  const shared = sharedPathMeasure(routes, new Set(routes.map(route => route.id)))(routes)
  if (crossings.length > 0 || shared > 0.001) {
    throw new Error(`Shared sheet routing safety: crossings=${crossings.join(',')}; shared=${shared}`)
  }
  return routes.map(route => ({
    ...route,
    points: route.points.map(point => ({ gx: point.x / ROUTE_UNIT, gy: point.y / ROUTE_UNIT })),
  }))
}
