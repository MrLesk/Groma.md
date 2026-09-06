import { ROUTE_CLEARANCE, visibleObstacle, routesCross, crossingRouteIdsFor, type FlatRoute, type Endpoint, type Point } from './route-geometry.ts'
import { sharedPathMeasure } from './route-spacing.ts'
const PORT_EPSILON = 0.01
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
  return usableSpan(Math.min(...values), Math.max(...values))
}

/** Keep shortcuts in the same middle wall span as the original port assignment. */
function usableSpan(lower: number, upper: number): [number, number] {
  const inset = (upper - lower) / 4
  return [lower + inset, upper - inset]
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
  if (group.length < 2) return
  const slots = group.map(end => end.slot).sort((a, b) => a - b)
  group.sort((a, b) => {
    if (a.turn !== b.turn) return a.turn - b.turn
    const distance = a.turn < 0 ? a.run - b.run : b.run - a.run
    return Math.abs(distance) > PORT_EPSILON ? distance : a.slot - b.slot
  })
  for (const [position, end] of group.entries()) {
    for (let offset = 0; offset <= end.bend; offset += 1) {
      end.route.points[end.indices[offset]!]![end.slotAxis] = slots[position]!
    }
  }
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

function safeRoutes(endpoints: ReadonlyMap<string, Endpoint>, routes: readonly FlatRoute[], changed: readonly FlatRoute[]): boolean {
  if (crossingRouteIdsFor(endpoints)(changed).length > 0) return false
  const routeIds = new Set(changed.map(route => route.id))
  return sharedPathMeasure(routes, routeIds)(changed) <= PORT_EPSILON
}

function routeCrossings(route: FlatRoute, routes: readonly FlatRoute[]): number {
  return routes.filter(other => other.id !== route.id && routesCross(route, other)).length
}

export function alignFacingRoutes(
  endpoints: ReadonlyMap<string, Endpoint>,
  routes: FlatRoute[],
): void {
  for (const route of routes) {
    const points = facingRoutePoints(endpoints, route)
    if (!points) continue
    const candidate = { ...route, points }
    const changed = routes.map(other => other.id === route.id ? candidate : other)
    if (routeCrossings(candidate, changed) <= routeCrossings(route, routes) && safeRoutes(endpoints, changed, [candidate])) {
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
  if (fanCrossings(group) < before && safeRoutes(endpoints, routes, [...originals.keys()])) return
  for (const [route, points] of originals) route.points = points
}

/** Orders equivalent pins so nested routes fan out instead of crossing beside their shared building. */
export function orderBuildingFans(
  endpoints: ReadonlyMap<string, Endpoint>,
  routes: FlatRoute[],
): void {
  for (const group of buildingFans(endpoints, routes).values()) improveFan(endpoints, routes, group)
}


function same(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001
}

function collinear(a: Point, b: Point, c: Point): boolean {
  return Math.abs(a.x - b.x) < 0.001 && Math.abs(b.x - c.x) < 0.001
    || Math.abs(a.y - b.y) < 0.001 && Math.abs(b.y - c.y) < 0.001
}

export function compactPath(points: readonly Point[]): Point[] {
  const result: Point[] = []
  for (const point of points) {
    if (result.length > 0 && same(result.at(-1)!, point)) continue
    while (result.length > 1 && collinear(result.at(-2)!, result.at(-1)!, point)) result.pop()
    result.push({ ...point })
  }
  return result
}

function routeCost(points: readonly Point[]): number {
  let cost = points.length * 18
  for (let index = 1; index < points.length; index += 1) {
    cost += Math.abs(points[index]!.x - points[index - 1]!.x)
      + Math.abs(points[index]!.y - points[index - 1]!.y)
  }
  return cost
}

interface Wall {
  along: 'x' | 'y'
  run: 'x' | 'y'
  position: number
  lower: number
  upper: number
  sign: number
}

function walls(endpoint: Endpoint | undefined): Wall[] {
  if (endpoint?.kind !== 'building') return []
  const polygon = visibleObstacle(endpoint)
  return ([
    [polygon[0]!, polygon[1]!, 'x', 'y', -1],
    [polygon[2]!, polygon[3]!, 'y', 'x', 1],
    [polygon[3]!, polygon[4]!, 'x', 'y', 1],
    [polygon[5]!, polygon[0]!, 'y', 'x', -1],
  ] as const).map(([from, to, along, run, sign]) => {
    const [lower, upper] = usableSpan(Math.min(from[along], to[along]), Math.max(from[along], to[along]))
    return {
      along, run, sign,
      position: from[run],
      lower, upper,
    }
  }).filter(wall => wall.lower <= wall.upper)
}

function wallPoint(wall: Wall, coordinate: number): Point {
  const point = { x: 0, y: 0 }
  point[wall.run] = wall.position
  point[wall.along] = Math.max(wall.lower, Math.min(wall.upper, coordinate))
  return point
}

/** Only changed routes need rechecking; the complete result is checked by routeAll. */
function acceptShortest(
  endpoints: ReadonlyMap<string, Endpoint>,
  routes: FlatRoute[],
  route: FlatRoute,
  candidates: Point[][],
): void {
  if (candidates.length === 0) return
  candidates.sort((a, b) => routeCost(a) - routeCost(b))
  const crosses = crossingRouteIdsFor(endpoints, ROUTE_CLEARANCE)
  const crossings = routeCrossings(route, routes)
  const spacing = sharedPathMeasure(routes, new Set([route.id]))
  for (const points of candidates) {
    const candidate = { ...route, points }
    if (crosses([candidate]).length > 0 || routeCrossings(candidate, routes) > crossings) continue
    if (spacing([candidate]) > 0.001) continue
    route.points = points
    return
  }
}

function endShortcuts(points: Point[], endpoint: Endpoint | undefined): Point[][] {
  const candidates: Point[][] = []
  const cost = routeCost(points)
  for (const join of [1, 2, 3]) {
    if (join >= points.length - 1) continue
    const point = points[join]!
    for (const wall of walls(endpoint)) {
      if ((point[wall.run] - wall.position) * wall.sign < ROUTE_CLEARANCE) continue
      const start = wallPoint(wall, points[0]![wall.along])
      const bend = { ...start, [wall.run]: point[wall.run] }
      const shortcut = compactPath([start, bend, ...points.slice(join)])
      if (routeCost(shortcut) < cost - 0.001) candidates.push(shortcut)
    }
  }
  return candidates
}

/** A shorter departure or arrival may use another wall without moving the route body. */
export function shortenEnds(endpoints: ReadonlyMap<string, Endpoint>, routes: FlatRoute[]): void {
  for (const route of routes) {
    for (const fromStart of [true, false]) {
      const points = fromStart ? route.points : [...route.points].reverse()
      const endpoint = endpoints.get(fromStart ? route.source : route.target)
      const candidates = endShortcuts(points, endpoint).map(path => fromStart ? path : path.reverse())
      acceptShortest(endpoints, routes, route, candidates)
    }
  }
}

function directShortcut(source: Wall, target: Wall): Point[] | undefined {
  if (source.along === target.along) return undefined
  const start = wallPoint(source, target.position)
  const end = wallPoint(target, source.position)
  const bend = { ...start, [source.run]: end[source.run] }
  if ((bend[source.run] - start[source.run]) * source.sign < ROUTE_CLEARANCE
    || (bend[source.along] - end[source.along]) * target.sign < ROUTE_CLEARANCE) return undefined
  return [start, bend, end]
}

/** Nearby unobstructed endpoints can connect through one corner. */
export function shortenDirect(endpoints: ReadonlyMap<string, Endpoint>, routes: FlatRoute[]): void {
  for (const route of routes) {
    const candidates: Point[][] = []
    const cost = routeCost(route.points)
    for (const source of walls(endpoints.get(route.source))) {
      for (const target of walls(endpoints.get(route.target))) {
        const points = directShortcut(source, target)
        if (points && routeCost(points) < cost - 0.001) candidates.push(points)
      }
    }
    acceptShortest(endpoints, routes, route, candidates)
  }
}
