import { AvoidLib } from 'libavoid-js'

import {
  LANE_GAP,
  ROUTE_UNIT,
  assignFixedPorts,
  attachWalls,
  buildingPorts,
  crossingRouteIdsFor,
  routingAnchor,
  visibleObstacle,
  type Endpoint,
  type FlatRoute,
  type Point,
  type PortPair,
  type RoutePort,
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
type AvoidRouter = InstanceType<typeof Avoid.Router>
type AvoidShape = InstanceType<typeof Avoid.ShapeRef>
type AvoidPin = InstanceType<typeof Avoid.ShapeConnectionPin>
type AvoidEnd = InstanceType<typeof Avoid.ConnEnd>
type AvoidDirection = NonNullable<ConstructorParameters<typeof Avoid.ShapeConnectionPin>[2]>

interface RoutedPolyline {
  size(): number
  ps: { get(index: number): { x: number; y: number } }
}

interface BuildingConnection {
  ports: RoutePort[]
  shape: AvoidShape
  pins: AvoidPin[]
}

const BUILDING_PORT_CLASS = 1
const PORT_EPSILON = 0.01
const STRAIGHT_RUN = LANE_GAP
// libavoid-js does not expose this C++ enum at runtime.
const CONNECTION_DIRECTION: Record<RoutePort['side'], number> = {
  north: 1,
  south: 2,
  west: 4,
  east: 8,
}

function buildingConnections(
  router: AvoidRouter,
  endpoints: ReadonlyMap<string, Endpoint>,
): Map<string, BuildingConnection> {
  const connections = new Map<string, BuildingConnection>()
  for (const endpoint of endpoints.values()) {
    if (endpoint.kind !== 'building') continue
    const points = visibleObstacle(endpoint, STRAIGHT_RUN)
    const polygon = new Avoid.Polygon(points.length)
    for (const [index, point] of points.entries()) {
      polygon.setPoint(index, new Avoid.Point(point.x, point.y))
    }
    const shape = new Avoid.ShapeRef(router, polygon)
    const minX = Math.min(...points.map(point => point.x))
    const minY = Math.min(...points.map(point => point.y))
    const ports = buildingPorts(endpoint)
    const pins = ports.map(port => {
      const outward = {
        x: port.wall.x + (port.side === 'east' ? STRAIGHT_RUN : port.side === 'west' ? -STRAIGHT_RUN : 0),
        y: port.wall.y + (port.side === 'south' ? STRAIGHT_RUN : port.side === 'north' ? -STRAIGHT_RUN : 0),
      }
      const pin = new Avoid.ShapeConnectionPin(
        shape,
        BUILDING_PORT_CLASS,
        outward.x - minX,
        outward.y - minY,
        false,
        STRAIGHT_RUN,
        CONNECTION_DIRECTION[port.side] as AvoidDirection,
      )
      pin.setExclusive(true)
      return pin
    })
    connections.set(endpoint.key, { ports, shape, pins })
  }
  return connections
}

function fixedPort(
  fixed: ReadonlyMap<string, Partial<PortPair>>,
  request: RouteRequest,
  role: keyof PortPair,
): RoutePort {
  const port = fixed.get(request.id)?.[role]
  if (!port) throw new Error(`No ${role} port for ${request.id}`)
  return port
}

function connectorEnd(
  request: RouteRequest,
  role: keyof PortPair,
  connections: ReadonlyMap<string, BuildingConnection>,
  fixed: ReadonlyMap<string, Partial<PortPair>>,
  endpoints: ReadonlyMap<string, Endpoint>,
): AvoidEnd {
  const endpointId = request[role]
  const connection = connections.get(endpointId)
  if (connection) return new Avoid.ConnEnd(connection.shape, BUILDING_PORT_CLASS)
  const point = routingAnchor(fixedPort(fixed, request, role), endpointId, endpoints)
  return new Avoid.ConnEnd(new Avoid.Point(point.x, point.y))
}

function matchingPort(point: Point, connection: BuildingConnection, request: RouteRequest, role: keyof PortPair): RoutePort {
  const distance = (port: RoutePort) => Math.abs(port.wall.x - point.x) + Math.abs(port.wall.y - point.y)
  const port = [...connection.ports].sort((a, b) => distance(a) - distance(b))[0]
  if (!port || distance(port) > LANE_GAP / 2 + PORT_EPSILON) {
    throw new Error(`Libavoid did not select a ${role} building port for ${request.id}`)
  }
  return {
    ...port,
    wall: { ...point },
    guard: { ...point },
  }
}

function selectedPort(
  point: Point,
  request: RouteRequest,
  role: keyof PortPair,
  connections: ReadonlyMap<string, BuildingConnection>,
  fixed: ReadonlyMap<string, Partial<PortPair>>,
): RoutePort {
  const connection = connections.get(request[role])
  return connection ? matchingPort(point, connection, request, role) : fixedPort(fixed, request, role)
}

interface RouteEndRun {
  route: FlatRoute
  indices: number[]
  bend: number
  slotAxis: 'x' | 'y'
  slot: number
  run: number
  turn: number
}

function routeEndRun(route: FlatRoute, fromStart: boolean): RouteEndRun | undefined {
  const indices = Array.from({ length: route.points.length }, (_, index) =>
    fromStart ? index : route.points.length - 1 - index)
  const end = route.points[indices[0]!]!
  const next = route.points[indices[1]!]!
  const slotAxis = Math.abs(next.y - end.y) > PORT_EPSILON ? 'x' : 'y'
  const runAxis = slotAxis === 'x' ? 'y' : 'x'
  const bend = indices.findIndex(index => Math.abs(route.points[index]![slotAxis] - end[slotAxis]) > PORT_EPSILON) - 1
  if (bend < 1 || bend + 1 >= indices.length) return undefined
  const bendPoint = route.points[indices[bend]!]!
  const turnedPoint = route.points[indices[bend + 1]!]!
  return {
    route,
    indices,
    bend,
    slotAxis,
    slot: end[slotAxis],
    run: Math.abs(bendPoint[runAxis] - end[runAxis]),
    turn: Math.sign(turnedPoint[slotAxis] - bendPoint[slotAxis]),
  }
}

function endDirection(end: RouteEndRun): number {
  const first = end.route.points[end.indices[0]!]!
  const next = end.route.points[end.indices[1]!]!
  const runAxis = end.slotAxis === 'x' ? 'y' : 'x'
  return Math.sign(next[runAxis] - first[runAxis])
}

function wallSpan(endpoint: Endpoint, end: RouteEndRun): [number, number] {
  const polygon = visibleObstacle(endpoint)
  const direction = endDirection(end)
  const edge = end.slotAxis === 'x'
    ? direction < 0 ? [polygon[0]!, polygon[1]!] : [polygon[3]!, polygon[4]!]
    : direction < 0 ? [polygon[5]!, polygon[0]!] : [polygon[2]!, polygon[3]!]
  const values = edge.map(point => point[end.slotAxis])
  return [Math.min(...values), Math.max(...values)]
}

function facingRoutePoints(
  endpoints: ReadonlyMap<string, Endpoint>,
  route: FlatRoute,
): Point[] | undefined {
  if (route.points.length !== 4) return undefined
  const source = routeEndRun(route, true)
  const target = routeEndRun(route, false)
  const sourceEndpoint = endpoints.get(route.source)
  const targetEndpoint = endpoints.get(route.target)
  if (!source || !target || sourceEndpoint?.kind !== 'building' || targetEndpoint?.kind !== 'building'
    || source.slotAxis !== target.slotAxis || endDirection(source) !== -endDirection(target)) return undefined
  const runAxis = source.slotAxis === 'x' ? 'y' : 'x'
  const start = route.points[0]!
  const finish = route.points.at(-1)!
  if (Math.sign(finish[runAxis] - start[runAxis]) !== endDirection(source)) return undefined
  const sourceSpan = wallSpan(sourceEndpoint, source)
  const targetSpan = wallSpan(targetEndpoint, target)
  const lower = Math.max(sourceSpan[0], targetSpan[0])
  const upper = Math.min(sourceSpan[1], targetSpan[1])
  if (lower > upper + PORT_EPSILON) return undefined
  const coordinate = Math.min(upper, Math.max(lower, source.slot))
  return [
    { ...start, [source.slotAxis]: coordinate },
    { ...finish, [source.slotAxis]: coordinate },
  ]
}

function fanKey(endpointId: string, end: RouteEndRun): string {
  return `${endpointId}\0${end.slotAxis}\0${endDirection(end)}`
}

function buildingFans(
  endpoints: ReadonlyMap<string, Endpoint>,
  routes: FlatRoute[],
): Map<string, RouteEndRun[]> {
  const groups = new Map<string, RouteEndRun[]>()
  for (const route of routes) {
    for (const [endpointId, fromStart] of [[route.source, true], [route.target, false]] as const) {
      if (endpoints.get(endpointId)?.kind !== 'building') continue
      const end = routeEndRun(route, fromStart)
      if (!end || end.turn === 0) continue
      const key = fanKey(endpointId, end)
      const group = groups.get(key) ?? []
      group.push(end)
      groups.set(key, group)
    }
  }
  return groups
}

function orderFan(group: RouteEndRun[]): void {
  if (group.length < 2 || group.some(end => end.turn !== group[0]!.turn)) return
  const turn = group[0]!.turn
  const slots = group.map(end => end.slot).sort((a, b) => a - b)
  group.sort((a, b) => {
    const distance = turn < 0 ? a.run - b.run : b.run - a.run
    return Math.abs(distance) > PORT_EPSILON ? distance : a.slot - b.slot
  })
  for (const [position, end] of group.entries()) {
    for (let offset = 0; offset <= end.bend; offset += 1) {
      end.route.points[end.indices[offset]!]![end.slotAxis] = slots[position]!
    }
  }
}

function segmentCrosses(a0: Point, a1: Point, b0: Point, b1: Point): boolean {
  const aHorizontal = Math.abs(a0.y - a1.y) < PORT_EPSILON
  const bHorizontal = Math.abs(b0.y - b1.y) < PORT_EPSILON
  if (aHorizontal === bHorizontal) return false
  const [horizontal0, horizontal1] = aHorizontal ? [a0, a1] : [b0, b1]
  const [vertical0, vertical1] = aHorizontal ? [b0, b1] : [a0, a1]
  const between = (value: number, from: number, to: number) =>
    value > Math.min(from, to) + PORT_EPSILON && value < Math.max(from, to) - PORT_EPSILON
  return between(vertical0.x, horizontal0.x, horizontal1.x)
    && between(horizontal0.y, vertical0.y, vertical1.y)
}

function routesCross(a: FlatRoute, b: FlatRoute): boolean {
  for (let left = 1; left < a.points.length; left += 1) {
    for (let right = 1; right < b.points.length; right += 1) {
      if (segmentCrosses(a.points[left - 1]!, a.points[left]!, b.points[right - 1]!, b.points[right]!)) return true
    }
  }
  return false
}

function fanCrossings(group: readonly RouteEndRun[]): number {
  let crossings = 0
  for (let left = 0; left < group.length; left += 1) {
    for (let right = left + 1; right < group.length; right += 1) {
      if (routesCross(group[left]!.route, group[right]!.route)) crossings += 1
    }
  }
  return crossings
}

function safeRoutes(endpoints: ReadonlyMap<string, Endpoint>, routes: readonly FlatRoute[]): boolean {
  if (crossingRouteIdsFor(endpoints)(routes).length > 0) return false
  const routeIds = new Set(routes.map(route => route.id))
  const [spacing] = routeSpacingIndex(routes, routeIds).measure(routes, [ROUTE_UNIT * 0.75])
  return spacing.sharedPathLength <= PORT_EPSILON
}

function routeCrossings(route: FlatRoute, routes: readonly FlatRoute[]): number {
  return routes.filter(other => other.id !== route.id && routesCross(route, other)).length
}

function alignFacingRoutes(
  endpoints: ReadonlyMap<string, Endpoint>,
  routes: FlatRoute[],
): void {
  for (const route of routes) {
    const points = facingRoutePoints(endpoints, route)
    if (!points) continue
    const candidate = { ...route, points }
    const changed = routes.map(other => other.id === route.id ? candidate : other)
    if (routeCrossings(candidate, changed) <= routeCrossings(route, routes) && safeRoutes(endpoints, changed)) {
      route.points = points
    }
  }
}

function improveFan(
  endpoints: ReadonlyMap<string, Endpoint>,
  routes: FlatRoute[],
  group: RouteEndRun[],
): void {
  const before = fanCrossings(group)
  if (before === 0) return
  const originals = new Map(group.map(end => [end.route, end.route.points.map(point => ({ ...point }))]))
  orderFan(group)
  if (fanCrossings(group) < before && safeRoutes(endpoints, routes)) return
  for (const [route, points] of originals) route.points = points
}

/** Orders equivalent pins so nested routes fan out instead of crossing beside their shared building. */
function orderBuildingFans(
  endpoints: ReadonlyMap<string, Endpoint>,
  routes: FlatRoute[],
): void {
  for (const group of buildingFans(endpoints, routes).values()) improveFan(endpoints, routes, group)
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

  const connections = buildingConnections(router, endpoints)
  const fixed = assignFixedPorts(endpoints, requests)
  const connectors = requests.map(request => {
    const connector = new Avoid.ConnRef(
      router,
      connectorEnd(request, 'source', connections, fixed, endpoints),
      connectorEnd(request, 'target', connections, fixed, endpoints),
    )
    connector.setRoutingType(enumNumber(Avoid.ConnType.ConnType_Orthogonal))
    connector.setHateCrossings(true)
    return { request, connector }
  })
  router.processTransaction()

  const raw: FlatRoute[] = connectors.map(({ request, connector }) => {
    const polyline = connector.displayRoute() as unknown as RoutedPolyline
    const points = Array.from({ length: polyline.size() }, (_, index) => {
      const point = polyline.ps.get(index)
      return { x: point.x, y: point.y }
    })
    if (points.length < 2) throw new Error(`Libavoid could not route ${request.id}`)
    const pair = {
      source: selectedPort(points[0]!, request, 'source', connections, fixed),
      target: selectedPort(points.at(-1)!, request, 'target', connections, fixed),
    }
    return { ...request, points: attachWalls(points, pair) }
  })
  const routes = refineRoutes(endpoints, raw)
  orderBuildingFans(endpoints, routes)
  alignFacingRoutes(endpoints, routes)
  const crossing = crossingRouteIdsFor(endpoints)(routes)
  const routeIds = new Set(routes.map(route => route.id))
  const [spacing] = routeSpacingIndex(routes, routeIds).measure(routes, [ROUTE_UNIT * 0.75])
  if (crossing.length > 0 || spacing.sharedPathLength > 0.001) {
    throw new Error(`Shared sheet routing safety: crossings=${crossing.join(',')}; shared=${spacing.sharedPathLength}`)
  }
  // Keep Libavoid's shape and pin wrappers alive until every route has been extracted.
  void connections
  return routes.map(route => ({
    ...route,
    points: route.points.map(point => ({ gx: point.x / ROUTE_UNIT, gy: point.y / ROUTE_UNIT })),
  }))
}
