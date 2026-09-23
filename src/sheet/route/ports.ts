import { ROOF_SHADOW } from '../grid.ts'
import { inside, rectOf, visibleObstacle, type Endpoint, type Point, type PortPair, type PortSide, type RoutePort, type RouteRequest } from './geometry.ts'
import { PORT_SPAN, ROUTE_CLEARANCE, ROUTE_SPACING, ROUTE_UNIT } from './space.ts'

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

/**
 * The stretch of a wall a port may slide along, across the port's exit axis: the middle half, where ports are
 * distributed. A round building's stretch is its middle point, so its ports may slide toward the middle but not away.
 */
export function portSpan(endpoint: Endpoint, side: PortSide): [number, number] {
  const [from, to] = PORT_SPAN.map(share => portAt(endpoint, side, share))
    .map(port => side === 'north' || side === 'south' ? port.wall.x : port.wall.y)
  if (!endpoint.round) return [from!, to!]
  const middle = (from! + to!) / 2
  return [middle, middle]
}

interface PortObstacle {
  key: string
  polygon: Point[]
  x0: number
  x1: number
  y0: number
  y1: number
}

/** Buckets narrow port checks; the original polygon test still decides clearance. */
class PortObstacles {
  private cells = new Map<string, PortObstacle[]>()
  private cellSize = ROUTE_UNIT * 8

  constructor(buildings: readonly Endpoint[]) {
    for (const building of buildings) this.add(building)
  }

  private add(building: Endpoint): void {
    const polygon = visibleObstacle(building, ROUTE_CLEARANCE)
    const obstacle: PortObstacle = {
      key: building.key,
      polygon,
      x0: Math.min(...polygon.map(point => point.x)),
      x1: Math.max(...polygon.map(point => point.x)),
      y0: Math.min(...polygon.map(point => point.y)),
      y1: Math.max(...polygon.map(point => point.y)),
    }
    for (let x = Math.floor(obstacle.x0 / this.cellSize); x <= Math.floor(obstacle.x1 / this.cellSize); x += 1) {
      for (let y = Math.floor(obstacle.y0 / this.cellSize); y <= Math.floor(obstacle.y1 / this.cellSize); y += 1) {
        const key = `${x},${y}`
        const bucket = this.cells.get(key) ?? []
        bucket.push(obstacle)
        this.cells.set(key, bucket)
      }
    }
  }

  clear(point: Point, endpoint: Endpoint, other: Endpoint): boolean {
    const key = `${Math.floor(point.x / this.cellSize)},${Math.floor(point.y / this.cellSize)}`
    for (const obstacle of this.cells.get(key) ?? []) {
      if (obstacle.key === endpoint.key || obstacle.key === other.key) continue
      if (point.x < obstacle.x0 || point.x > obstacle.x1 || point.y < obstacle.y0 || point.y > obstacle.y1) continue
      if (inside(point, obstacle.polygon)) return false
    }
    return true
  }
}

function portClear(
  endpoint: Endpoint,
  other: Endpoint,
  buildings: PortObstacles,
  side: PortSide,
  share: number,
): boolean {
  const port = portAt(endpoint, side, share)
  const middle = { x: (port.wall.x + port.guard.x) / 2, y: (port.wall.y + port.guard.y) / 2 }
  return buildings.clear(port.guard, endpoint, other) && buildings.clear(middle, endpoint, other)
}

function laneCoordinate(candidate: EndpointCandidate): number {
  const other = centre(candidate.other)
  return candidate.side === 'north' || candidate.side === 'south' ? other.x : other.y
}

/** Where the port `index` of `count` on one wall sits, as a share of the wall: evenly across its middle half. */
function portShare(index: number, count: number): number {
  if (count === 1) return (PORT_SPAN[0] + PORT_SPAN[1]) / 2
  return PORT_SPAN[0] + (PORT_SPAN[1] - PORT_SPAN[0]) * index / (count - 1)
}

/** Round buildings and external systems take one arriving route per wall where they have walls to spare. */
function oneArrivalPerWall(endpoint: Endpoint, role: 'source' | 'target'): boolean {
  return role === 'target' && (endpoint.round === true || endpoint.owner === 'island:external')
}

function portCapacity(candidate: EndpointCandidate): number {
  return oneArrivalPerWall(candidate.endpoint, candidate.role) ? 1 : PORT_CAPACITY
}

function routeCandidates(
  endpoints: ReadonlyMap<string, Endpoint>,
  requests: readonly RouteRequest[],
  buildings: PortObstacles,
): EndpointCandidate[] {
  const candidates: EndpointCandidate[] = []
  for (const request of requests) {
    const source = endpoints.get(request.source)
    const target = endpoints.get(request.target)
    if (!source || !target) throw new Error(`Relationship ${request.id} names an element the sheet did not place`)
    for (const [endpoint, other, role] of [[source, target, 'source'], [target, source, 'target']] as const) {
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
  buildings: PortObstacles,
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

function balanceEndpointSides(group: EndpointCandidate[], buildings: PortObstacles): void {
  // Parallel connections share the facing wall and use separate positions along it.
  if (group[0]!.endpoint.kind === 'building' && group.every(candidate => candidate.other.key === group[0]!.other.key)) return
  const capacity = portCapacity(group[0]!)
  const bySide = Map.groupBy(group, candidate => candidate.side)
  const loads = new Map([...bySide].map(([side, sideGroup]) => [side, sideGroup.length]))
  for (const [side, sideGroup] of bySide) {
    sideGroup.sort((a, b) => laneCoordinate(a) - laneCoordinate(b)
      || a.request.id.localeCompare(b.request.id, undefined, { numeric: true }))
    for (const candidate of sideGroup.slice(capacity)) moveToQuieterSide(candidate, side, loads, capacity, buildings)
  }
}

function balanceSideLoads(candidates: readonly EndpointCandidate[], buildings: PortObstacles): void {
  const groups = Map.groupBy(candidates, candidate => `${candidate.endpoint.key}\0${candidate.role}`)
  for (const group of groups.values()) balanceEndpointSides(group, buildings)
}

function byEndpointSide(candidates: readonly EndpointCandidate[]): Map<string, EndpointCandidate[]> {
  return Map.groupBy(candidates, candidate => `${candidate.endpoint.key}\0${candidate.side}`)
}

function blockedCandidate(
  groups: ReadonlyMap<string, EndpointCandidate[]>,
  buildings: PortObstacles,
): EndpointCandidate | undefined {
  for (const group of groups.values()) {
    group.sort((a, b) => laneCoordinate(a) - laneCoordinate(b) || a.request.id.localeCompare(b.request.id))
    const blocked = group.find((candidate, index) => !portClear(
      candidate.endpoint,
      candidate.other,
      buildings,
      candidate.side,
      portShare(index, group.length),
    ))
    if (blocked) return blocked
  }
  return undefined
}

function moveBlockedCandidate(
  candidate: EndpointCandidate,
  groups: ReadonlyMap<string, EndpointCandidate[]>,
  buildings: PortObstacles,
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
  buildings: PortObstacles,
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
        portShare(index, group.length),
      )
      pairs.set(candidate.request.id, pair)
    }
  }
  return pairs
}

/** Distributes distinct wall ports across each endpoint before routing. */
export function assignFixedPorts(
  endpoints: ReadonlyMap<string, Endpoint>,
  requests: readonly RouteRequest[],
): Map<string, Partial<PortPair>> {
  const buildings = new PortObstacles([...endpoints.values()].filter(endpoint => endpoint.kind === 'building'))
  const candidates = routeCandidates(endpoints, requests, buildings)
  balanceSideLoads(candidates, buildings)
  return pairsFrom(distributeClearPorts(candidates, buildings))
}

/**
 * One port a route may use at one of its ends. The port assigned before routing is preferred; at a building the middle
 * of every other clear wall is offered too, and the path search takes it when that saves crossings or length.
 */
export interface PortChoice {
  port: RoutePort
  preferred: boolean
  /** The endpoint wall, numbered across all routes, so the search can count the ports each wall holds. */
  wall: number
  /** How many ports the wall may hold, this one included, when a route takes it instead of its preferred port. */
  room: number
}

export interface PortChoices {
  source: PortChoice[]
  target: PortChoice[]
}

const SIDES: readonly PortSide[] = ['north', 'east', 'south', 'west']

/** Ports that fit side by side, at the least spacing, on the stretch of a wall where ports sit. */
function wallRoom(endpoint: Endpoint, side: PortSide): number {
  const [low, high] = portSpan(endpoint, side)
  return Math.floor((high - low) / ROUTE_SPACING + 0.001) + 1
}

function endChoices(endpoint: Endpoint, other: Endpoint, preferred: RoutePort, role: 'source' | 'target',
  buildings: PortObstacles, walls: Map<string, number>): PortChoice[] {
  const wall = (side: PortSide): number => {
    const key = `${endpoint.key}\0${side}`
    if (!walls.has(key)) walls.set(key, walls.size)
    return walls.get(key)!
  }
  const choice = (port: RoutePort, isPreferred: boolean): PortChoice => ({
    port, preferred: isPreferred, wall: wall(port.side),
    room: oneArrivalPerWall(endpoint, role) ? 1 : wallRoom(endpoint, port.side),
  })
  // A slab or island keeps its assigned wall, so no route wraps across the surface it ends on to reach another one.
  const others = endpoint.kind !== 'building' ? []
    : SIDES.filter(side => side !== preferred.side && portClear(endpoint, other, buildings, side, 0.5))
  return [choice(preferred, true), ...others.map(side => choice(portAt(endpoint, side, 0.5), false))]
}

/**
 * The ports every route may use, preferred first: the distributed ports of assignFixedPorts, and at each end that is a
 * building the middle of its other clear walls.
 */
export function portChoices(endpoints: ReadonlyMap<string, Endpoint>, requests: readonly RouteRequest[]): PortChoices[] {
  const fixed = assignFixedPorts(endpoints, requests)
  const pairs = requests.map(request => {
    const pair = fixed.get(request.id)
    if (!pair?.source || !pair.target) throw new Error(`No fixed ports for ${request.id}`)
    return { source: pair.source, target: pair.target }
  })
  const buildings = new PortObstacles([...endpoints.values()].filter(endpoint => endpoint.kind === 'building'))
  const walls = new Map<string, number>()
  return requests.map((request, index) => {
    const source = endpoints.get(request.source)!
    const target = endpoints.get(request.target)!
    return {
      source: endChoices(source, target, pairs[index]!.source, 'source', buildings, walls),
      target: endChoices(target, source, pairs[index]!.target, 'target', buildings, walls),
    }
  })
}
