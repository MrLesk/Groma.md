import { AvoidLib } from 'libavoid-js'

import {
  ROUTE_CLEARANCE,
  ROUTE_UNIT,
  assignPorts,
  attachWalls,
  crossingRouteIdsFor,
  routingAnchor,
  visibleObstacle,
  type Endpoint,
  type FlatRoute,
  type RouteRequest,
} from './route-geometry.ts'
import { refineRoutes } from './route-lanes.ts'
import { routeSpacingIndex } from './route-spacing.ts'
import type { Route } from './types.ts'

export type { Endpoint, RouteRequest } from './route-geometry.ts'

function enumNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'object' && value !== null && 'value' in value) {
    return Number((value as { value: unknown }).value)
  }
  throw new Error('Libavoid enum value is unavailable')
}

await AvoidLib.load()
const Avoid = AvoidLib.getInstance()

interface RoutedPolyline {
  size(): number
  ps: { get(index: number): { x: number; y: number } }
}

/** Routes every authored relationship once around the complete visible building silhouettes. */
export function routeAll(
  endpoints: ReadonlyMap<string, Endpoint>,
  requests: readonly RouteRequest[],
): Route[] {
  const router = new Avoid.Router(enumNumber(Avoid.RouterFlag.OrthogonalRouting))
  const parameter = (name: keyof typeof Avoid.RoutingParameter, value: number) => {
    router.setRoutingParameter(enumNumber(Avoid.RoutingParameter[name]), value)
  }
  parameter('segmentPenalty', 10)
  parameter('crossingPenalty', 700)
  parameter('fixedSharedPathPenalty', 300)
  parameter('portDirectionPenalty', 100)
  parameter('shapeBufferDistance', 0)
  parameter('idealNudgingDistance', ROUTE_UNIT * 0.75)
  parameter('reverseDirectionPenalty', 2_000)
  for (const name of [
    'penaliseOrthogonalSharedPathsAtConnEnds',
    'nudgeOrthogonalTouchingColinearSegments',
    'performUnifyingNudgingPreprocessingStep',
    'nudgeSharedPathsWithCommonEndPoint',
  ] as const) router.setRoutingOption(enumNumber(Avoid.RoutingOption[name]), true)

  const shapeReferences: unknown[] = []
  for (const endpoint of endpoints.values()) {
    if (endpoint.kind !== 'building') continue
    const points = visibleObstacle(endpoint, ROUTE_CLEARANCE)
    const polygon = new Avoid.Polygon(points.length)
    for (const [index, point] of points.entries()) {
      polygon.setPoint(index, new Avoid.Point(point.x, point.y))
    }
    shapeReferences.push(new Avoid.ShapeRef(router, polygon))
  }

  const ports = assignPorts(endpoints, requests)
  const connectors = requests.map(request => {
    const pair = ports.get(request.id)!
    const sourcePoint = routingAnchor(pair.source, request.source, endpoints)
    const targetPoint = routingAnchor(pair.target, request.target, endpoints)
    const connector = new Avoid.ConnRef(
      router,
      new Avoid.ConnEnd(new Avoid.Point(sourcePoint.x, sourcePoint.y)),
      new Avoid.ConnEnd(new Avoid.Point(targetPoint.x, targetPoint.y)),
    )
    connector.setRoutingType(enumNumber(Avoid.ConnType.ConnType_Orthogonal))
    connector.setHateCrossings(true)
    return { request, pair, connector }
  })
  router.processTransaction()

  const raw: FlatRoute[] = connectors.map(({ request, pair, connector }) => {
    const polyline = connector.displayRoute() as unknown as RoutedPolyline
    const points = Array.from({ length: polyline.size() }, (_, index) => {
      const point = polyline.ps.get(index)
      return { x: point.x, y: point.y }
    })
    if (points.length < 2) throw new Error(`Libavoid could not route ${request.id}`)
    return { ...request, points: attachWalls(points, pair) }
  })
  const routes = refineRoutes(endpoints, raw)
  const crossing = crossingRouteIdsFor(endpoints)(routes)
  const routeIds = new Set(routes.map(route => route.id))
  const [spacing] = routeSpacingIndex(routes, routeIds).measure(routes, [ROUTE_UNIT * 0.75])
  if (crossing.length > 0 || spacing.sharedPathLength > 0.001) {
    throw new Error(`Shared sheet routing safety: crossings=${crossing.join(',')}; shared=${spacing.sharedPathLength}`)
  }
  // Keep Libavoid's WASM wrappers alive until every route has been extracted.
  void shapeReferences
  return routes.map(route => ({
    ...route,
    points: route.points.map(point => ({ gx: point.x / ROUTE_UNIT, gy: point.y / ROUTE_UNIT })),
  }))
}
