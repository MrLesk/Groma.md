import {
  LANE_GAP, ROUTE_CLEARANCE, ROUTE_SPACING, visibleObstacle,
  type Endpoint, type Point, type PortPair, type RoutePort, type RouteRequest,
} from './route-geometry.ts'
import { connectionCounts } from './route-space.ts'

interface ObstacleBox {
  x0: number
  x1: number
  y0: number
  y1: number
  lanes: number
}

export interface RouteGrid {
  xs: number[]
  ys: number[]
  blocked: Uint8Array
  reserved: Uint32Array
  reservedEdges: Uint32Array
  used: Uint8Array
  ends: [number, number][]
}

function stable(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

function ordered(values: number[]): number[] {
  return [...new Set(values.map(stable))].sort((a, b) => a - b)
}

function lower(values: number[], value: number): number {
  let start = 0
  let end = values.length
  while (start < end) {
    const middle = (start + end) >>> 1
    if (values[middle]! < value) start = middle + 1
    else end = middle
  }
  return start
}

/** Grid edges that would draw a parallel stroke within the same physical lane. */
export function* parallelEdges(grid: RouteGrid, edge: number, axis: number): Generator<number> {
  const horizontal = axis === 0
  const coordinates = horizontal ? grid.ys : grid.xs
  const index = horizontal ? Math.floor(edge / grid.xs.length) : edge % grid.xs.length
  const stride = horizontal ? grid.xs.length : 1
  const from = lower(coordinates, coordinates[index]! - ROUTE_SPACING + 0.001)
  const to = lower(coordinates, coordinates[index]! + ROUTE_SPACING - 0.001)
  for (let at = from; at < to; at += 1) yield edge + (at - index) * stride
}

function obstacleBoxes(endpoints: ReadonlyMap<string, Endpoint>, requests: readonly RouteRequest[]): ObstacleBox[] {
  const counts = connectionCounts(requests)
  return [...endpoints.values()].filter(endpoint => endpoint.kind === 'building').map(endpoint => {
    const polygon = visibleObstacle(endpoint, ROUTE_CLEARANCE)
    return {
      lanes: (counts.get(endpoint.key) ?? 0) + 1,
      x0: Math.min(...polygon.map(point => point.x)),
      x1: Math.max(...polygon.map(point => point.x)),
      y0: Math.min(...polygon.map(point => point.y)),
      y1: Math.max(...polygon.map(point => point.y)),
    }
  })
}

/** Every side needs bypass lanes, even when its own ports face another direction. */
function obstacleTracks(lower: number, upper: number, lanes: number): number[] {
  return [lower, (lower + upper) / 2, upper, lower - LANE_GAP, upper + LANE_GAP,
    ...Array.from({ length: lanes }, (_, index) => [
      lower - (index + 1) * ROUTE_SPACING, upper + (index + 1) * ROUTE_SPACING,
    ]).flat()]
}

function portGroups(ports: readonly PortPair[], requests: readonly RouteRequest[]): RoutePort[][] {
  const groups = new Map<string, RoutePort[]>()
  for (const [index, pair] of ports.entries()) {
    for (const role of ['source', 'target'] as const) {
      const port = pair[role]
      const key = `${requests[index]![role]}\0${port.side}`
      const group = groups.get(key) ?? []
      group.push(port)
      groups.set(key, group)
    }
  }
  return [...groups.values()]
}

/** Add outward turning tracks for each wall's ports. */
function portFans(groups: readonly RoutePort[][]): { x: number[]; y: number[] } {
  const fans = { x: [] as number[], y: [] as number[] }
  for (const group of groups) {
    for (const [index, port] of group.entries()) {
      const axis = port.side === 'east' || port.side === 'west' ? 'x' : 'y'
      const sign = port.side === 'east' || port.side === 'south' ? 1 : -1
      const gap = sign * ROUTE_SPACING
      fans[axis].push(port.guard[axis] + gap * (index + 1))
    }
  }
  return fans
}

function blockBuildings(grid: RouteGrid, boxes: readonly ObstacleBox[]): void {
  const width = grid.xs.length
  for (const box of boxes) {
    const x0 = lower(grid.xs, box.x0 - 0.001)
    const x1 = lower(grid.xs, box.x1 + 0.001)
    const y0 = lower(grid.ys, box.y0 - 0.001)
    const y1 = lower(grid.ys, box.y1 + 0.001)
    for (let y = y0; y < y1; y += 1) grid.blocked.fill(1, y * width + x0, y * width + x1)
  }
}

/** Reserve the nearest outward track; a longer run can overlap a facing wall's exit. */
function reserveExit(grid: RouteGrid, start: number, port: RoutePort, owner: number): void {
  const horizontal = port.side === 'east' || port.side === 'west'
  const sign = port.side === 'east' || port.side === 'south' ? 1 : -1
  const step = sign * (horizontal ? 1 : grid.xs.length)
  for (const node of [start, start + step]) {
    if (grid.reserved[node] && grid.reserved[node] !== owner) throw new Error('Routes share a fixed port exit')
    grid.reserved[node] = owner
  }
  reservePortRoom(grid, start + step, owner)
  const axis = horizontal ? 0 : 1
  for (const edge of parallelEdges(grid, Math.min(start, start + step), axis)) {
    const slot = edge * 2 + axis
    const previous = grid.reservedEdges[slot]
    // An intermediate track inside two port margins belongs to neither route.
    grid.reservedEdges[slot] = previous && previous !== owner ? 0xffffffff : owner
  }
  grid.blocked[start] = 0
}

/** A later port needs turning room, not just a point that an earlier stroke can surround. */
function reservePortRoom(grid: RouteGrid, node: number, owner: number): void {
  const x = grid.xs[node % grid.xs.length]!
  const y = grid.ys[Math.floor(node / grid.xs.length)]!
  const x0 = lower(grid.xs, x - ROUTE_SPACING + 0.001)
  const x1 = lower(grid.xs, x + ROUTE_SPACING - 0.001)
  const y0 = lower(grid.ys, y - ROUTE_SPACING + 0.001)
  const y1 = lower(grid.ys, y + ROUTE_SPACING - 0.001)
  for (let row = y0; row < y1; row += 1) {
    for (let column = x0; column < x1; column += 1) {
      const at = row * grid.xs.length + column
      const previous = grid.reserved[at]
      grid.reserved[at] = previous && previous !== owner ? 0xffffffff : owner
    }
  }
}

/** A shared coordinate grid keeps all paths orthogonal and reserves used edges. */
export function routeGrid(
  endpoints: ReadonlyMap<string, Endpoint>,
  requests: readonly RouteRequest[],
  ports: readonly PortPair[],
): RouteGrid {
  const boxes = obstacleBoxes(endpoints, requests)
  const fans = portFans(portGroups(ports, requests))
  const xs = ordered(boxes.flatMap(box => obstacleTracks(box.x0, box.x1, box.lanes))
    .concat(ports.flatMap(pair => [pair.source.guard.x, pair.target.guard.x]), fans.x))
  const ys = ordered(boxes.flatMap(box => obstacleTracks(box.y0, box.y1, box.lanes))
    .concat(ports.flatMap(pair => [pair.source.guard.y, pair.target.guard.y]), fans.y))
  const size = xs.length * ys.length
  const node = (point: Point) => lower(ys, stable(point.y)) * xs.length + lower(xs, stable(point.x))
  const grid: RouteGrid = {
    xs, ys,
    blocked: new Uint8Array(size),
    reserved: new Uint32Array(size),
    reservedEdges: new Uint32Array(size * 2),
    used: new Uint8Array(size),
    ends: ports.map(pair => [node(pair.source.guard), node(pair.target.guard)]),
  }
  // Boundaries are blocked too: only a route's own port may open its wall.
  blockBuildings(grid, boxes)
  for (const [index, pair] of ports.entries()) {
    reserveExit(grid, grid.ends[index]![0], pair.source, index + 1)
    reserveExit(grid, grid.ends[index]![1], pair.target, index + 1)
  }
  return grid
}
