import type { AnnotatedRelationship } from '../types.ts'
import { ROOF_SHADOW } from './grid.ts'
import type { CellRect, Route } from './types.ts'

export const ROUTE_UNIT = 24
export const ROUTE_CLEARANCE = ROUTE_UNIT / 2
export const LANE_GAP = ROUTE_UNIT * 0.75

export interface Point {
  x: number
  y: number
}

export type PortSide = 'north' | 'east' | 'south' | 'west'

export interface RoutePort {
  side: PortSide
  wall: Point
  guard: Point
}

export interface PortPair {
  source: RoutePort
  target: RoutePort
}

/** Anything a route may start or end on, with its direct enclosing surface. */
export interface Endpoint {
  key: string
  kind: 'building' | 'slab' | 'island'
  rect: CellRect
  owner?: string
  roof?: number
  centrePorts?: boolean
}

export type RouteRequest = Pick<AnnotatedRelationship, 'id' | 'source' | 'target' | 'description' | 'origin'>
export type FlatRoute = Omit<Route, 'points'> & { points: Point[] }

interface EndpointCandidate {
  request: RouteRequest
  endpoint: Endpoint
  other: Endpoint
  role: 'source' | 'target'
  sides: PortSide[]
  sideIndex: number
  side: PortSide
}

const PORT_CAPACITY = 3
const EPSILON = 0.001

function rectOf(rect: CellRect): { x: number; y: number; width: number; height: number } {
  return {
    x: rect.gx * ROUTE_UNIT,
    y: rect.gy * ROUTE_UNIT,
    width: rect.w * ROUTE_UNIT,
    height: rect.d * ROUTE_UNIT,
  }
}

export function visibleObstacle(endpoint: Endpoint, clearance = 0): Point[] {
  const { x, y, width, height } = rectOf(endpoint.rect)
  const shadow = (endpoint.roof ?? 0) * ROOF_SHADOW * ROUTE_UNIT
  return [
    { x: x - shadow - clearance, y: y - shadow - clearance },
    { x: x + width - shadow + clearance, y: y - shadow - clearance },
    { x: x + width + clearance, y: y - clearance },
    { x: x + width + clearance, y: y + height + clearance },
    { x: x - clearance, y: y + height + clearance },
    { x: x - shadow - clearance, y: y + height - shadow + clearance },
  ]
}

function centre(endpoint: Endpoint): Point {
  const { x, y, width, height } = rectOf(endpoint.rect)
  const shadow = (endpoint.roof ?? 0) * ROOF_SHADOW * ROUTE_UNIT
  return { x: x + width / 2 - shadow / 2, y: y + height / 2 - shadow / 2 }
}

function sidesTowards(from: Endpoint, to: Endpoint): PortSide[] {
  const a = centre(from)
  const b = centre(to)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const horizontal: PortSide = dx >= 0 ? 'east' : 'west'
  const vertical: PortSide = dy >= 0 ? 'south' : 'north'
  const preferred = Math.abs(dx) >= Math.abs(dy) ? [horizontal, vertical] : [vertical, horizontal]
  const opposite: Record<PortSide, PortSide> = { north: 'south', east: 'west', south: 'north', west: 'east' }
  return [...preferred, opposite[preferred[1]!], opposite[preferred[0]!]]
}

function portAt(endpoint: Endpoint, side: PortSide, share: number): RoutePort {
  const { x, y, width, height } = rectOf(endpoint.rect)
  const shadow = (endpoint.roof ?? 0) * ROOF_SHADOW * ROUTE_UNIT
  const wall = side === 'north'
    ? { x: x - shadow + width * share, y: y - shadow }
    : side === 'east'
      ? { x: x + width, y: y + height * share }
      : side === 'south'
        ? { x: x + width * share, y: y + height }
        : { x: x - shadow, y: y - shadow + height * share }
  const guard = side === 'north'
    ? { x: wall.x, y: wall.y - ROUTE_CLEARANCE }
    : side === 'east'
      ? { x: wall.x + ROUTE_CLEARANCE, y: wall.y }
      : side === 'south'
        ? { x: wall.x, y: wall.y + ROUTE_CLEARANCE }
        : { x: wall.x - ROUTE_CLEARANCE, y: wall.y }
  return { side, wall, guard }
}

/** Equivalent building ports from which Libavoid may choose the straightest route. */
export function buildingPorts(endpoint: Endpoint): RoutePort[] {
  return (['north', 'east', 'south', 'west'] as const).flatMap(side =>
    Array.from({ length: PORT_CAPACITY }, (_, index) =>
      portAt(endpoint, side, portShare(endpoint, side, index, PORT_CAPACITY))))
}

function inside(point: Point, polygon: readonly Point[]): boolean {
  let contained = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[index]!
    const b = polygon[previous]!
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) contained = !contained
  }
  return contained
}

function portClear(
  endpoint: Endpoint,
  other: Endpoint,
  buildings: readonly Endpoint[],
  side: PortSide,
  share: number,
): boolean {
  const port = portAt(endpoint, side, share)
  return buildings.every(building => {
    if (building.key === endpoint.key || building.key === other.key) return true
    const obstacle = visibleObstacle(building, ROUTE_CLEARANCE)
    return [
      port.guard,
      { x: (port.wall.x + port.guard.x) / 2, y: (port.wall.y + port.guard.y) / 2 },
    ].every(point => !inside(point, obstacle))
  })
}

function laneCoordinate(candidate: EndpointCandidate): number {
  const other = centre(candidate.other)
  return candidate.side === 'north' || candidate.side === 'south' ? other.x : other.y
}

function portShare(endpoint: Endpoint, side: PortSide, index: number, count: number): number {
  if (count === 1) return 0.5
  const rect = rectOf(endpoint.rect)
  const length = side === 'north' || side === 'south' ? rect.width : rect.height
  const gap = Math.max(length / (count + 1), Math.min(LANE_GAP, length / (count - 1)))
  return (length / 2 - gap * (count - 1) / 2 + gap * index) / length
}

function portCapacity(candidate: EndpointCandidate): number {
  return candidate.role === 'target'
    && (candidate.endpoint.centrePorts === true || candidate.endpoint.owner === 'island:external')
    ? 1
    : PORT_CAPACITY
}

function candidateGroups(
  candidates: readonly EndpointCandidate[],
  key: (candidate: EndpointCandidate) => string,
): Map<string, EndpointCandidate[]> {
  return Map.groupBy(candidates, key)
}

function routeCandidates(
  endpoints: ReadonlyMap<string, Endpoint>,
  requests: readonly RouteRequest[],
  buildings: readonly Endpoint[],
): EndpointCandidate[] {
  const candidates: EndpointCandidate[] = []
  for (const request of requests) {
    const source = endpoints.get(request.source)
    const target = endpoints.get(request.target)
    if (!source || !target) throw new Error(`Relationship ${request.id} names an element the sheet did not place`)
    for (const [endpoint, other, role] of [[source, target, 'source'], [target, source, 'target']] as const) {
      if (endpoint.kind === 'building') continue
      const sides = sidesTowards(endpoint, other)
      const sideIndex = sides.findIndex(side => portClear(endpoint, other, buildings, side, 0.5))
      if (sideIndex < 0) throw new Error(`No clear port side for ${request.id} at ${endpoint.key}`)
      candidates.push({ request, endpoint, other, role, sides, sideIndex, side: sides[sideIndex]! })
    }
  }
  return candidates.sort((a, b) => a.endpoint.key.localeCompare(b.endpoint.key)
    || a.role.localeCompare(b.role)
    || a.request.id.localeCompare(b.request.id, undefined, { numeric: true }))
}

function moveToQuieterSide(
  candidate: EndpointCandidate,
  side: PortSide,
  loads: Map<PortSide, number>,
  capacity: number,
  buildings: readonly Endpoint[],
): void {
  const selected = candidate.sides
    .map((candidateSide, index) => ({ side: candidateSide, index }))
    .find(option => option.side !== side
      && (loads.get(option.side) ?? 0) < capacity
      && portClear(candidate.endpoint, candidate.other, buildings, option.side, 0.5))
  if (!selected) return
  candidate.side = selected.side
  candidate.sideIndex = selected.index
  loads.set(side, loads.get(side)! - 1)
  loads.set(selected.side, (loads.get(selected.side) ?? 0) + 1)
}

function balanceEndpointSides(group: EndpointCandidate[], buildings: readonly Endpoint[]): void {
  const capacity = portCapacity(group[0]!)
  const bySide = Map.groupBy(group, candidate => candidate.side)
  const loads = new Map([...bySide].map(([side, sideGroup]) => [side, sideGroup.length]))
  for (const [side, sideGroup] of bySide) {
    sideGroup.sort((a, b) => laneCoordinate(a) - laneCoordinate(b)
      || a.request.id.localeCompare(b.request.id, undefined, { numeric: true }))
    for (const candidate of sideGroup.slice(capacity)) moveToQuieterSide(candidate, side, loads, capacity, buildings)
  }
}

function balanceSideLoads(candidates: readonly EndpointCandidate[], buildings: readonly Endpoint[]): void {
  const groups = candidateGroups(candidates, candidate => `${candidate.endpoint.key}\0${candidate.role}`)
  for (const group of groups.values()) balanceEndpointSides(group, buildings)
}

function byEndpointSide(candidates: readonly EndpointCandidate[]): Map<string, EndpointCandidate[]> {
  return candidateGroups(candidates, candidate => `${candidate.endpoint.key}\0${candidate.side}`)
}

function blockedCandidate(
  groups: ReadonlyMap<string, EndpointCandidate[]>,
  buildings: readonly Endpoint[],
): EndpointCandidate | undefined {
  for (const group of groups.values()) {
    group.sort((a, b) => laneCoordinate(a) - laneCoordinate(b) || a.request.id.localeCompare(b.request.id))
    const blocked = group.find((candidate, index) => !portClear(
      candidate.endpoint,
      candidate.other,
      buildings,
      candidate.side,
      portShare(candidate.endpoint, candidate.side, index, group.length),
    ))
    if (blocked) return blocked
  }
  return undefined
}

function moveBlockedCandidate(
  candidate: EndpointCandidate,
  groups: ReadonlyMap<string, EndpointCandidate[]>,
  buildings: readonly Endpoint[],
): void {
  const choices = candidate.sides
    .map((side, index) => ({ side, index }))
    .filter(({ index, side }) => index > candidate.sideIndex
      && portClear(candidate.endpoint, candidate.other, buildings, side, 0.5))
  const next = choices.find(({ side }) =>
    (groups.get(`${candidate.endpoint.key}\0${side}`)?.length ?? 0) < PORT_CAPACITY) ?? choices[0]
  if (!next) throw new Error(`No clear distributed port for ${candidate.request.id} at ${candidate.endpoint.key}`)
  candidate.sideIndex = next.index
  candidate.side = next.side
}

function distributeClearPorts(
  candidates: readonly EndpointCandidate[],
  buildings: readonly Endpoint[],
): Map<string, EndpointCandidate[]> {
  let groups = byEndpointSide(candidates)
  for (let attempt = 0; attempt < candidates.length * 4; attempt += 1) {
    const blocked = blockedCandidate(groups, buildings)
    if (!blocked) break
    moveBlockedCandidate(blocked, groups, buildings)
    groups = byEndpointSide(candidates)
  }
  return groups
}

function pairsFrom(groups: ReadonlyMap<string, EndpointCandidate[]>): Map<string, Partial<PortPair>> {
  const pairs = new Map<string, Partial<PortPair>>()
  for (const group of groups.values()) {
    group.sort((a, b) => laneCoordinate(a) - laneCoordinate(b) || a.request.id.localeCompare(b.request.id))
    for (const [index, candidate] of group.entries()) {
      const pair = pairs.get(candidate.request.id) ?? {}
      pair[candidate.role] = portAt(
        candidate.endpoint,
        candidate.side,
        portShare(candidate.endpoint, candidate.side, index, group.length),
      )
      pairs.set(candidate.request.id, pair)
    }
  }
  return pairs
}

/** Assigns fixed ports only to endpoints that have no Libavoid building shape. */
export function assignFixedPorts(
  endpoints: ReadonlyMap<string, Endpoint>,
  requests: readonly RouteRequest[],
): Map<string, Partial<PortPair>> {
  const buildings = [...endpoints.values()].filter(endpoint => endpoint.kind === 'building')
  const candidates = routeCandidates(endpoints, requests, buildings)
  balanceSideLoads(candidates, buildings)
  return pairsFrom(distributeClearPorts(candidates, buildings))
}

export function routingAnchor(
  port: RoutePort,
  endpointId: string,
  endpoints: ReadonlyMap<string, Endpoint>,
): Point {
  const outer = {
    x: port.guard.x + port.guard.x - port.wall.x,
    y: port.guard.y + port.guard.y - port.wall.y,
  }
  return [...endpoints.values()].some(endpoint =>
    endpoint.kind === 'building'
    && endpoint.key !== endpointId
    && inside(outer, visibleObstacle(endpoint, ROUTE_CLEARANCE)))
    ? { ...port.guard }
    : outer
}

function same(a: Point | undefined, b: Point): boolean {
  return a !== undefined && Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON
}

function snapGuardRun(points: Point[], port: RoutePort, fromStart: boolean): void {
  const coordinate = port.side === 'east' || port.side === 'west' ? 'y' : 'x'
  const end = fromStart ? points[0] : points.at(-1)
  if (!end || Math.abs(end[coordinate] - port.guard[coordinate]) >= 0.1) return
  const nudged = end[coordinate]
  for (let offset = 0; offset < points.length; offset += 1) {
    const index = fromStart ? offset : points.length - 1 - offset
    const point = points[index]!
    if (Math.abs(point[coordinate] - nudged) >= EPSILON) break
    point[coordinate] = port.guard[coordinate]
  }
}

export function attachWalls(points: readonly Point[], ports: PortPair): Point[] {
  const body = points.map(point => ({ ...point }))
  snapGuardRun(body, ports.source, true)
  snapGuardRun(body, ports.target, false)
  const horizontal = (side: PortSide) => side === 'east' || side === 'west'
  const sourceBend = horizontal(ports.source.side)
    ? { x: body[0]!.x, y: ports.source.guard.y }
    : { x: ports.source.guard.x, y: body[0]!.y }
  const targetBend = horizontal(ports.target.side)
    ? { x: body.at(-1)!.x, y: ports.target.guard.y }
    : { x: ports.target.guard.x, y: body.at(-1)!.y }
  const route = [
    { ...ports.source.wall }, { ...ports.source.guard }, sourceBend,
    ...body,
    targetBend, { ...ports.target.guard }, { ...ports.target.wall },
  ]
  return route.filter((point, index) => index === 0 || !same(route[index - 1], point))
}

interface RouteObstacle {
  endpoint: Endpoint
  polygon: Point[]
  x: [number, number]
  y: [number, number]
}

function segmentEnters(from: Point, to: Point, polygon: readonly Point[]): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / (ROUTE_UNIT / 8)))
  for (let step = 1; step < steps; step += 1) {
    const point = {
      x: from.x + (to.x - from.x) * step / steps,
      y: from.y + (to.y - from.y) * step / steps,
    }
    if (inside(point, polygon)) return true
  }
  return false
}

function segmentMissesBounds(from: Point, to: Point, obstacle: RouteObstacle): boolean {
  return Math.max(from.x, to.x) < obstacle.x[0] || Math.min(from.x, to.x) > obstacle.x[1]
    || Math.max(from.y, to.y) < obstacle.y[0] || Math.min(from.y, to.y) > obstacle.y[1]
}

function segmentCrossesObstacle(
  route: FlatRoute,
  index: number,
  from: Point,
  to: Point,
  obstacle: RouteObstacle,
): boolean {
  if (obstacle.endpoint.key === route.source && index <= 2) return false
  if (obstacle.endpoint.key === route.target && index >= route.points.length - 2) return false
  return !segmentMissesBounds(from, to, obstacle) && segmentEnters(from, to, obstacle.polygon)
}

function routeCrosses(route: FlatRoute, obstacles: readonly RouteObstacle[]): boolean {
  for (let index = 1; index < route.points.length; index += 1) {
    const from = route.points[index - 1]!
    const to = route.points[index]!
    if (obstacles.some(obstacle => segmentCrossesObstacle(route, index, from, to, obstacle))) return true
  }
  return false
}

/** Returns a checker for routes whose open body enters a foreign building silhouette. */
export function crossingRouteIdsFor(
  endpoints: ReadonlyMap<string, Endpoint>,
  clearance = 0,
): (routes: readonly FlatRoute[]) => string[] {
  const obstacles = [...endpoints.values()]
    .filter(endpoint => endpoint.kind === 'building')
    .map(endpoint => {
      const polygon = visibleObstacle(endpoint, clearance)
      const xs = polygon.map(point => point.x)
      const ys = polygon.map(point => point.y)
      return {
        endpoint,
        polygon,
        x: [Math.min(...xs), Math.max(...xs)] as [number, number],
        y: [Math.min(...ys), Math.max(...ys)] as [number, number],
      }
    })
  return routes => routes.filter(route => routeCrosses(route, obstacles)).map(route => route.id)
}
