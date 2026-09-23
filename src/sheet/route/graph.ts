import { EPSILON, visibleObstacle, type Endpoint, type Point, type PortSide } from './geometry.ts'
import type { PortChoices } from './ports.ts'
import { BUNDLE_SPACING, ROUTE_CLEARANCE, ROUTE_SPACING } from './space.ts'

/** Neighbour directions; a node's neighbours sit at `node * 4 + direction`. */
export const EAST = 0
export const SOUTH = 1
export const WEST = 2
export const NORTH = 3

/** Room around the outermost boxes and guards for routes that go around everything. */
const MARGIN = ROUTE_CLEARANCE * 4

export interface Box {
  x0: number
  x1: number
  y0: number
  y1: number
  /** The building a clearance box surrounds. */
  key?: string
}

/** A straight track routes may follow: horizontal at `at` from `from` to `to`, or vertical. */
interface Line {
  horizontal: boolean
  at: number
  from: number
  to: number
  /** A port's track belongs to the routes that may use the port; others may cross it but not run along it. Channel lines are public. */
  owners?: number[]
}

/**
 * Where routes may run: the centre lines of the free channels between building clearance boxes, plus a private track
 * straight out of every port guard. Nodes are the crossings of those lines and the guards; routes may share a channel
 * edge, and nudging later spreads the routes on it across the channel, so `capacity` counts how many lanes fit beside
 * each other there.
 */
export interface RouteGraph {
  x: number[]
  y: number[]
  /** Neighbour node per direction, or -1. */
  next: Int32Array
  /** Routes that fit across the edge leaving a node eastward or southward at the least spacing, indexed `node * 2 + axis`. */
  capacity: Uint16Array
  /** Routes that fit across the same edge at the spacing bundles prefer. */
  comfort: Uint16Array
  /** Edges on other lines of the same narrow channel, which share its lanes, by the same index. */
  beside: (number[] | undefined)[]
  /** The routes allowed along a port's private edges, by the same index; other edges are public. */
  owners: (number[] | undefined)[]
  /** The straight line each edge lies on, by the same index, so routes sharing a line can be compared along it. */
  line: Int32Array
  /** Guard node of every port choice of each request, in the order of its choices. */
  ends: { source: number[], target: number[] }[]
  boxes: readonly Box[]
}

export const exitDirection: Record<PortSide, number> = { east: EAST, south: SOUTH, west: WEST, north: NORTH }

function clearanceBoxes(endpoints: ReadonlyMap<string, Endpoint>): Box[] {
  return [...endpoints.values()].filter(endpoint => endpoint.kind === 'building').map(endpoint => {
    const polygon = visibleObstacle(endpoint, ROUTE_CLEARANCE)
    const xs = polygon.map(point => point.x)
    const ys = polygon.map(point => point.y)
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), key: endpoint.key }
  })
}

function transposed(box: Box): Box {
  return { x0: box.y0, x1: box.y1, y0: box.x0, y1: box.x1, key: box.key }
}

function overlap(a0: number, a1: number, b0: number, b1: number): number {
  return Math.min(a1, b1) - Math.max(a0, b0)
}

/** Free vertical intervals of the open strip between x0 and x1, skipping boxes that intrude into it. */
function freeIntervals(boxes: readonly Box[], x0: number, x1: number, bounds: Box): [number, number][] {
  const intruders = boxes.filter(box => box.x0 < x1 - EPSILON && box.x1 > x0 + EPSILON)
    .sort((a, b) => a.y0 - b.y0)
  const free: [number, number][] = []
  let top = bounds.y0
  for (const box of intruders) {
    if (box.y0 > top + EPSILON) free.push([top, box.y0])
    top = Math.max(top, box.y1)
  }
  if (bounds.y1 > top + EPSILON) free.push([top, bounds.y1])
  return free
}

/**
 * The narrowest vertical channels beside `box` on one side: empty rectangles whose sides touch this box and the nearest
 * facing box (or the bounds) along a common stretch.
 */
function sideChannels(box: Box, boxes: readonly Box[], bounds: Box, rightward: boolean): Box[] {
  const facing = boxes.filter(other => rightward ? other.x0 >= box.x1 - EPSILON : other.x1 <= box.x0 + EPSILON)
    .sort((a, b) => rightward ? a.x0 - b.x0 : b.x1 - a.x1)
  const edge: Box = rightward
    ? { x0: bounds.x1, x1: bounds.x1, y0: bounds.y0, y1: bounds.y1 }
    : { x0: bounds.x0, x1: bounds.x0, y0: bounds.y0, y1: bounds.y1 }
  for (const other of [...facing, edge]) {
    const x0 = rightward ? box.x1 : other.x1
    const x1 = rightward ? other.x0 : box.x0
    if (x1 - x0 < EPSILON) continue
    const channels = freeIntervals(boxes, x0, x1, bounds)
      .filter(([y0, y1]) => overlap(y0, y1, box.y0, box.y1) > EPSILON && overlap(y0, y1, other.y0, other.y1) > EPSILON)
      .map(([y0, y1]) => ({ x0, x1, y0, y1 }))
    if (channels.length > 0) return channels
  }
  return []
}

/** Centre lines of the vertical channels on both sides of every box, each channel once. */
function channelLines(boxes: readonly Box[], bounds: Box): Line[] {
  const channels = new Map<string, Box>()
  for (const box of boxes) {
    for (const rightward of [true, false]) {
      for (const channel of sideChannels(box, boxes, bounds, rightward)) {
        channels.set(`${channel.x0},${channel.x1},${channel.y0},${channel.y1}`, channel)
      }
    }
  }
  return [...channels.values()].map(channel => ({
    horizontal: false, at: (channel.x0 + channel.x1) / 2, from: channel.y0, to: channel.y1,
  }))
}

/** How far a horizontal ray from `along` at height `across` gets before it meets a box or the limit. */
function reachAlong(along: number, across: number, forward: boolean, boxes: readonly Box[], limit: number): number {
  let end = limit
  for (const box of boxes) {
    if (across <= box.y0 + EPSILON || across >= box.y1 - EPSILON) continue
    if (forward && box.x0 >= along - EPSILON) end = Math.min(end, box.x0)
    else if (!forward && box.x1 <= along + EPSILON) end = Math.max(end, box.x1)
  }
  return end
}

/** A guard's track runs straight out of its wall until the next box or the bounds. */
function portRay(guard: Point, direction: number, boxes: readonly Box[], bounds: Box, owners: number[]): Line {
  const horizontal = direction === EAST || direction === WEST
  const forward = direction === EAST || direction === SOUTH
  const frame = horizontal ? bounds : transposed(bounds)
  const along = horizontal ? guard.x : guard.y
  const across = horizontal ? guard.y : guard.x
  const end = reachAlong(along, across, forward, horizontal ? boxes : boxes.map(transposed), forward ? frame.x1 : frame.x0)
  return { horizontal, at: across, from: Math.min(along, end), to: Math.max(along, end), owners }
}

/** The far end of a port's track. */
function trackEnd(ray: Line, direction: number): Point {
  const end = direction === EAST || direction === SOUTH ? ray.to : ray.from
  return ray.horizontal ? { x: end, y: ray.at } : { x: ray.at, y: end }
}

/**
 * A public line through `point`, both ways until the next boxes or the bounds. It joins a port track that meets no
 * channel line, as in open ground away from buildings, to the lines around it.
 */
function crossLine(point: Point, horizontal: boolean, boxes: readonly Box[], bounds: Box): Line {
  const view = horizontal ? boxes : boxes.map(transposed)
  const frame = horizontal ? bounds : transposed(bounds)
  const along = horizontal ? point.x : point.y
  const across = horizontal ? point.y : point.x
  return {
    horizontal, at: across,
    from: reachAlong(along, across, false, view, frame.x0), to: reachAlong(along, across, true, view, frame.x1),
  }
}

/** Collinear overlapping lines become one line. */
function merged(lines: readonly Line[]): Line[] {
  const groups = Map.groupBy(lines, line => `${line.horizontal}:${stable(line.at)}`)
  const result: Line[] = []
  for (const group of groups.values()) {
    group.sort((a, b) => a.from - b.from)
    let current: Line | undefined
    for (const line of group) {
      if (current && line.from <= current.to + EPSILON) {
        current.to = Math.max(current.to, line.to)
        current.owners = current.owners && line.owners ? [...current.owners, ...line.owners] : undefined
      } else {
        current = { ...line }
        result.push(current)
      }
    }
  }
  return result
}

function stable(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

/** Width of the strips `Strips` files boxes in: an index for speed only, any width builds the same graph. */
const STRIP = ROUTE_CLEARANCE * 16

/** Boxes filed by the strips along one axis they reach, so an edge along that axis checks only the boxes beside it. */
class Strips {
  private strips = new Map<number, Box[]>()
  private horizontal: boolean
  private bounds: Box

  constructor(boxes: readonly Box[], horizontal: boolean, bounds: Box) {
    this.horizontal = horizontal
    this.bounds = bounds
    for (const box of boxes) {
      const [b0, b1] = horizontal ? [box.x0, box.x1] : [box.y0, box.y1]
      for (let strip = Math.floor(b0 / STRIP); strip <= Math.floor(b1 / STRIP); strip += 1) {
        const filed = this.strips.get(strip)
        if (filed) filed.push(box)
        else this.strips.set(strip, [box])
      }
    }
  }

  /** The free space across an edge at `at` from `a0` to `a1` along the axis: between the nearest boxes on both sides. */
  freeAcross(at: number, a0: number, a1: number): [number, number] {
    const free: [number, number] = this.horizontal ? [this.bounds.y0, this.bounds.y1] : [this.bounds.x0, this.bounds.x1]
    for (let strip = Math.floor(a0 / STRIP); strip <= Math.floor(a1 / STRIP); strip += 1) {
      for (const box of this.strips.get(strip) ?? []) this.narrow(free, box, at, a0, a1)
    }
    return free
  }

  /** Narrows `free` to the near side of `box` when the box runs beside the edge at `at` from `a0` to `a1`. */
  private narrow(free: [number, number], box: Box, at: number, a0: number, a1: number): void {
    const view = this.horizontal ? box : transposed(box)
    if (overlap(a0, a1, view.x0, view.x1) <= EPSILON) return
    if (view.y1 <= at + EPSILON) free[0] = Math.max(free[0], view.y1)
    else if (view.y0 >= at - EPSILON) free[1] = Math.min(free[1], view.y0)
  }
}

/**
 * Channels narrower than this many lanes (four cells) are where routes on parallel lines can run out of room, so only
 * their edges count the lines beside them.
 */
const NARROW = 32

interface Edge {
  slot: number
  horizontal: boolean
  from: number
  to: number
  free: [number, number]
}

/** For every edge in a narrow channel, the edges on other lines of the same channel that run beside it. */
function besideEdges(edges: readonly Edge[], slots: number): (number[] | undefined)[] {
  const beside: (number[] | undefined)[] = new Array(slots).fill(undefined)
  const channels = Map.groupBy(edges.filter(edge => lanes(edge.free) < NARROW),
    edge => `${edge.horizontal}:${stable(edge.free[0])}:${stable(edge.free[1])}`)
  for (const channel of channels.values()) {
    for (const edge of channel) {
      const others = channel.filter(other => other !== edge && overlap(edge.from, edge.to, other.from, other.to) > EPSILON)
      if (others.length > 0) beside[edge.slot] = others.map(other => other.slot)
    }
  }
  return beside
}

function lanes([lower, upper]: [number, number], spacing = ROUTE_SPACING): number {
  return Math.min(0xffff, Math.floor((upper - lower) / spacing + EPSILON) + 1)
}

interface Guard {
  point: Point
  side: PortSide
  /** The requests with a port choice here. */
  owners: number[]
}

/** Every distinct guard of the port choices, with the requests that may use it. */
function guardsOf(choices: readonly PortChoices[]): Guard[] {
  const guards = new Map<string, Guard>()
  for (const [index, request] of choices.entries()) {
    for (const { port } of [...request.source, ...request.target]) {
      const key = `${stable(port.guard.x)},${stable(port.guard.y)},${port.side}`
      const guard = guards.get(key)
      if (!guard) guards.set(key, { point: port.guard, side: port.side, owners: [index] })
      else if (guard.owners.at(-1) !== index) guard.owners.push(index)
    }
  }
  return [...guards.values()]
}

/** Builds the sparse routing graph for the port choices; `choices[index]` belongs to request `index`. */
export function routeGraph(endpoints: ReadonlyMap<string, Endpoint>, choices: readonly PortChoices[]): RouteGraph {
  const boxes = clearanceBoxes(endpoints)
  const guards = guardsOf(choices)
  const xs = [...boxes.flatMap(box => [box.x0, box.x1]), ...guards.map(guard => guard.point.x)]
  const ys = [...boxes.flatMap(box => [box.y0, box.y1]), ...guards.map(guard => guard.point.y)]
  const bounds: Box = {
    x0: Math.min(...xs) - MARGIN, x1: Math.max(...xs) + MARGIN,
    y0: Math.min(...ys) - MARGIN, y1: Math.max(...ys) + MARGIN,
  }
  const vertical = channelLines(boxes, bounds)
  const horizontal = channelLines(boxes.map(transposed), transposed(bounds)).map(line => ({ ...line, horizontal: true }))
  const channels = [...vertical, ...horizontal]
  const rays = guards.map(guard => portRay(guard.point, exitDirection[guard.side], boxes, bounds, guard.owners))
  const connectors = rays.flatMap((ray, index) => channels.some(channel => channel.horizontal !== ray.horizontal && crosses(ray, channel))
    ? [] : [crossLine(trackEnd(ray, exitDirection[guards[index]!.side]), !ray.horizontal, boxes, bounds)])
  const lines = merged([...channels, ...rays, ...connectors])
  const nodes = new Nodes()
  const stops = lineStops(lines, guards.map(guard => guard.point), nodes)
  const guardNodes = (end: PortChoices['source']) => end.map(({ port }) => nodes.at(port.guard.x, port.guard.y))
  const ends = choices.map(request => ({ source: guardNodes(request.source), target: guardNodes(request.target) }))
  return { x: nodes.x, y: nodes.y, ...linkLines(stops, nodes, boxes, bounds), ends, boxes }
}

/** Numbers each distinct point once. */
class Nodes {
  x: number[] = []
  y: number[] = []
  private ids = new Map<string, number>()

  at(px: number, py: number): number {
    const key = `${stable(px)},${stable(py)}`
    let id = this.ids.get(key)
    if (id === undefined) {
      id = this.x.length
      this.ids.set(key, id)
      this.x.push(px)
      this.y.push(py)
    }
    return id
  }
}

function crosses(h: Line, v: Line): boolean {
  return v.at >= h.from - EPSILON && v.at <= h.to + EPSILON && h.at >= v.from - EPSILON && h.at <= v.to + EPSILON
}

function contains(line: Line, point: Point): boolean {
  const along = line.horizontal ? point.x : point.y
  const across = line.horizontal ? point.y : point.x
  return Math.abs(across - line.at) < EPSILON && along >= line.from - EPSILON && along <= line.to + EPSILON
}

/** The nodes on every line: its crossings with perpendicular lines and any guard lying on it. */
function lineStops(lines: readonly Line[], guards: readonly Point[], nodes: Nodes): Map<Line, number[]> {
  const stops = new Map<Line, number[]>(lines.map(line => [line, []]))
  const verticals = lines.filter(line => !line.horizontal)
  for (const h of lines.filter(line => line.horizontal)) {
    for (const v of verticals.filter(v => crosses(h, v))) {
      const id = nodes.at(v.at, h.at)
      stops.get(h)!.push(id)
      stops.get(v)!.push(id)
    }
  }
  for (const guard of guards) {
    const id = nodes.at(guard.x, guard.y)
    for (const line of lines.filter(line => contains(line, guard))) stops.get(line)!.push(id)
  }
  return stops
}

/** The per-edge tables of the graph that linking the lines fills in, indexed like `RouteGraph`. */
type Links = Pick<RouteGraph, 'next' | 'capacity' | 'comfort' | 'owners' | 'line'>

/** Links consecutive stops along every line and measures the channel around each edge. */
function linkLines(stops: Map<Line, number[]>, nodes: Nodes, boxes: readonly Box[], bounds: Box): Omit<RouteGraph, 'x' | 'y' | 'ends' | 'boxes'> {
  const slots = nodes.x.length * 2
  const links: Links = {
    next: new Int32Array(nodes.x.length * 4).fill(-1),
    capacity: new Uint16Array(slots),
    comfort: new Uint16Array(slots),
    owners: new Array(slots).fill(undefined),
    line: new Int32Array(slots).fill(-1),
  }
  const strips = [new Strips(boxes, true, bounds), new Strips(boxes, false, bounds)]
  const edges = [...stops].flatMap(([line, ids], number) => linkLine(line, number, ids, nodes, strips, links))
  return { ...links, beside: besideEdges(edges, slots) }
}

/** Links the consecutive stops of line `number` and measures the room across each of its edges. */
function linkLine(line: Line, number: number, ids: readonly number[], nodes: Nodes, strips: readonly Strips[], links: Links): Edge[] {
  const along = line.horizontal ? nodes.x : nodes.y
  const [ahead, back, axis] = line.horizontal ? [EAST, WEST, 0] : [SOUTH, NORTH, 1]
  const unique = [...new Set(ids)].sort((a, b) => along[a]! - along[b]!)
  const edges: Edge[] = []
  for (let index = 1; index < unique.length; index += 1) {
    const from = unique[index - 1]!
    const to = unique[index]!
    links.next[from * 4 + ahead] = to
    links.next[to * 4 + back] = from
    const free = strips[axis]!.freeAcross(line.at, along[from]!, along[to]!)
    const slot = from * 2 + axis
    // A bundle is centred on its line and one run keeps one position along a whole line, so only the room on the
    // line's narrower side, mirrored, is sure to be free wherever the run goes.
    const half = Math.min(line.at - free[0], free[1] - line.at)
    links.capacity[slot] = lanes([line.at - half, line.at + half])
    links.comfort[slot] = lanes([line.at - half, line.at + half], BUNDLE_SPACING)
    links.owners[slot] = line.owners
    links.line[slot] = number
    edges.push({ slot, horizontal: line.horizontal, from: along[from]!, to: along[to]!, free })
  }
  return edges
}
