import {
  LANE_GAP, ROUTE_CLEARANCE, visibleObstacle,
  type Endpoint, type Point, type PortPair, type RoutePort, type RouteRequest,
} from './route-geometry.ts'

interface ObstacleBox {
  x0: number
  x1: number
  y0: number
  y1: number
}

export interface RouteGrid {
  xs: number[]
  ys: number[]
  blocked: Uint8Array
  reserved: Uint32Array
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

function obstacleBoxes(endpoints: ReadonlyMap<string, Endpoint>): ObstacleBox[] {
  return [...endpoints.values()].filter(endpoint => endpoint.kind === 'building').map(endpoint => {
    const polygon = visibleObstacle(endpoint, ROUTE_CLEARANCE)
    return {
      x0: Math.min(...polygon.map(point => point.x)),
      x1: Math.max(...polygon.map(point => point.x)),
      y0: Math.min(...polygon.map(point => point.y)),
      y1: Math.max(...polygon.map(point => point.y)),
    }
  })
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

/** Each port adds a turning track outside its wall, including busy shared walls. */
function fanAxes(groups: readonly RoutePort[][]): { x: number[]; y: number[] } {
  const axes = { x: [] as number[], y: [] as number[] }
  for (const group of groups) {
    for (const [index, port] of group.entries()) {
      const axis = port.side === 'east' || port.side === 'west' ? 'x' : 'y'
      const sign = port.side === 'east' || port.side === 'south' ? 1 : -1
      axes[axis].push(port.guard[axis] + sign * LANE_GAP * (index + 1) / (group.length + 1))
    }
  }
  return axes
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

function reservePorts(grid: RouteGrid): void {
  for (const [index, pair] of grid.ends.entries()) {
    for (const node of pair) {
      if (grid.reserved[node] && grid.reserved[node] !== index + 1) throw new Error('Routes share a fixed port')
      grid.reserved[node] = index + 1
      grid.blocked[node] = 0
    }
  }
}

/** A shared coordinate grid keeps all paths orthogonal and reserves used edges. */
export function routeGrid(
  endpoints: ReadonlyMap<string, Endpoint>,
  requests: readonly RouteRequest[],
  ports: readonly PortPair[],
): RouteGrid {
  const boxes = obstacleBoxes(endpoints)
  const fans = fanAxes(portGroups(ports, requests))
  const xs = ordered(boxes.flatMap(box => [box.x0 - LANE_GAP, box.x0, (box.x0 + box.x1) / 2, box.x1, box.x1 + LANE_GAP])
    .concat(ports.flatMap(pair => [pair.source.guard.x, pair.target.guard.x]), fans.x))
  const ys = ordered(boxes.flatMap(box => [box.y0 - LANE_GAP, box.y0, (box.y0 + box.y1) / 2, box.y1, box.y1 + LANE_GAP])
    .concat(ports.flatMap(pair => [pair.source.guard.y, pair.target.guard.y]), fans.y))
  const size = xs.length * ys.length
  const node = (point: Point) => lower(ys, stable(point.y)) * xs.length + lower(xs, stable(point.x))
  const grid: RouteGrid = {
    xs, ys,
    blocked: new Uint8Array(size),
    reserved: new Uint32Array(size),
    used: new Uint8Array(size),
    ends: ports.map(pair => [node(pair.source.guard), node(pair.target.guard)]),
  }
  // Boundaries are blocked too: only a route's own port may open its wall.
  blockBuildings(grid, boxes)
  reservePorts(grid)
  return grid
}
