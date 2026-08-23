import type { WorldRelationship } from '../types.ts'
import { LANES, ROOF_SHADOW } from './grid.ts'
import type { CellRect, Route, RoutePoint } from './types.ts'

/** Lanes of clearance a route keeps from a foreign footprint. */
export const RING = 1
/** Lanes between two ports on one side: ports sit on half-cell marks. */
const PORT_PITCH = 2
/** Route costs: one lattice step, one turn, one lane another route already uses, a start or an end through a side not facing the other endpoint, one port step away from the middle of a one-cell side. */
const STEP = 1
const BEND = 6
const REUSE = 24
const SIDE_PENALTY = 24
const OFF_CENTRE = 8
/** Lanes a route runs straight out of its port and straight into its goal, so it leaves and meets a side square on. */
const APPROACH = 2
/**
 * Lanes from a surface border, or from a route already drawn, within which a
 * line pays to run, and what each of those lanes costs: a route holds the
 * middle of the free ground instead of tracing an edge or crowding a
 * neighbour. Foreign buildings need no such push, since RING already keeps a
 * lane clear of them.
 */
const NEAR = 2
const CROWD = 3

type Side = 'x-' | 'x+' | 'y-' | 'y+'
const SIDES: readonly Side[] = ['x-', 'x+', 'y-', 'y+']
/** Direction index a route takes when it leaves through each side, and the one it arrives with. */
const OUTWARD: Record<Side, number> = { 'x+': 0, 'y+': 1, 'x-': 2, 'y-': 3 }
const INWARD: Record<Side, number> = { 'x+': 2, 'y+': 3, 'x-': 0, 'y-': 1 }
/** A building's back sides, hidden under its roof: routes start and end behind them, where the roof's shadow ends. */
const BACK: readonly Side[] = ['x-', 'y-']

/** The sides of `rect` that face `other`: a side faces it when the other rect lies wholly beyond that side. */
function facing(rect: LaneRect, other: LaneRect): Set<Side> {
  const sides = new Set<Side>()
  if (other.x1 <= rect.x0) sides.add('x-')
  if (other.x0 >= rect.x1) sides.add('x+')
  if (other.y1 <= rect.y0) sides.add('y-')
  if (other.y0 >= rect.y1) sides.add('y+')
  return sides
}

/** Anything a route may start or end on, with the slab and island it stands in. */
export interface Endpoint {
  key: string
  kind: 'building' | 'slab' | 'island'
  rect: CellRect
  within: string[]
  /** Buildings: the roof's height above the ground plane, for departures and arrivals through a back side. */
  roof?: number
}

export type RouteRequest = Pick<WorldRelationship, 'id' | 'source' | 'target' | 'description' | 'origin'>

/** A footprint in lane units: x0..x1 and y0..y1 are its boundary lanes, inclusive. */
interface LaneRect {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** Directions a route may step: +x, +y, −x, −y. */
const DX = [1, 0, -1, 0]
const DY = [0, 1, 0, -1]

interface Open {
  f: number
  g: number
  state: number
}

/** Cheapest estimate first, then the deeper path, then the lower state: a total order, so routing is deterministic. */
function before(a: Open, b: Open): boolean {
  if (a.f !== b.f) return a.f < b.f
  if (a.g !== b.g) return a.g > b.g
  return a.state < b.state
}

class Heap {
  private readonly items: Open[] = []

  get size(): number {
    return this.items.length
  }

  push(item: Open): void {
    const items = this.items
    items.push(item)
    let index = items.length - 1
    while (index > 0) {
      const parent = (index - 1) >> 1
      if (!before(items[index]!, items[parent]!)) break
      ;[items[parent], items[index]] = [items[index]!, items[parent]!]
      index = parent
    }
  }

  pop(): Open {
    const items = this.items
    const top = items[0]!
    const last = items.pop()!
    if (items.length > 0) {
      items[0] = last
      let index = 0
      for (;;) {
        const left = 2 * index + 1
        const right = left + 1
        let smallest = index
        if (left < items.length && before(items[left]!, items[smallest]!)) smallest = left
        if (right < items.length && before(items[right]!, items[smallest]!)) smallest = right
        if (smallest === index) break
        ;[items[smallest], items[index]] = [items[index]!, items[smallest]!]
        index = smallest
      }
    }
    return top
  }
}

/**
 * Routes every relationship on the quarter-cell lattice with A*. A route
 * leaves its source from the middle of the side facing the target and
 * arrives, pointing inward, at the middle of the side of the target facing
 * it; when the two middles do not line up the line stays straight and the
 * longer side gives way. Later routes spread out around the middle. A back
 * side of a
 * building is hidden under its roof, so there a route starts or ends just
 * behind the building where the roof's shadow ends: on screen the line
 * emerges from, or its arrowhead touches, the middle of the roof's back
 * edge. Routes leave and meet a side square on, keep one lane clear of every
 * foreign footprint, pay for turns and for lanes other routes already use,
 * and pay to run within NEAR lanes of a surface border or of a route already
 * drawn, so a line holds the middle of the free ground; they are solved in
 * the order given, so parallel routes take neighbouring ports.
 */
export function routeAll(
  sheet: CellRect,
  endpoints: ReadonlyMap<string, Endpoint>,
  requests: readonly RouteRequest[],
): Route[] {
  const width = sheet.w * LANES + 1
  const height = sheet.d * LANES + 1
  const nodeCount = width * height
  const stateCount = nodeCount * 4

  const lanes = (rect: CellRect): LaneRect => ({
    x0: (rect.gx - sheet.gx) * LANES,
    y0: (rect.gy - sheet.gy) * LANES,
    x1: (rect.gx + rect.w - sheet.gx) * LANES,
    y1: (rect.gy + rect.d - sheet.gy) * LANES,
  })
  const nodeOf = (x: number, y: number): number => y * width + x
  const blocked = new Uint8Array(nodeCount)
  /** Goal nodes hold the arriving direction plus one; zero is no goal. */
  const goal = new Uint8Array(nodeCount)
  /** Each goal's extra cost: its port's distance from the middle of its side in port steps per cell, and the penalty of a side not facing the source. */
  const goalCost = new Float32Array(nodeCount)
  const used = new Uint8Array(nodeCount * 2)
  const usedPorts = new Set<number>()
  const g = new Float64Array(stateCount)
  const parent = new Int32Array(stateCount)
  const closed = new Uint8Array(stateCount)

  const sweep = new Int32Array(nodeCount)
  /** Lanes from each node out to the nearest source, NEAR at the furthest; -1 past that, where nothing is close enough to matter. */
  const measure = (room: Int32Array, sources: Iterable<number>): void => {
    room.fill(-1)
    let tail = 0
    for (const node of sources) {
      if (room[node] !== -1) continue
      room[node] = 0
      sweep[tail] = node
      tail += 1
    }
    for (let head = 0; head < tail; head += 1) {
      const node = sweep[head]!
      if (room[node]! >= NEAR) continue
      const x = node % width
      const y = (node - x) / width
      for (let direction = 0; direction < 4; direction += 1) {
        const nx = x + DX[direction]!
        const ny = y + DY[direction]!
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const next = nodeOf(nx, ny)
        if (room[next] !== -1) continue
        room[next] = room[node]! + 1
        sweep[tail] = next
        tail += 1
      }
    }
  }
  /** What a lane costs for lying that close to whatever the room was measured from. */
  const crowd = (room: Int32Array, node: number): number => (room[node] === -1 ? 0 : CROWD * (NEAR - room[node]!))

  /** The lanes along every surface's border, which a route would otherwise trace and be hard to tell from. */
  const borderLanes = function* (): Generator<number> {
    for (const endpoint of endpoints.values()) {
      if (endpoint.kind === 'building') continue
      const rect = lanes(endpoint.rect)
      for (let x = rect.x0; x <= rect.x1; x += 1) { yield nodeOf(x, rect.y0); yield nodeOf(x, rect.y1) }
      for (let y = rect.y0; y <= rect.y1; y += 1) { yield nodeOf(rect.x0, y); yield nodeOf(rect.x1, y) }
    }
  }
  const border = new Int32Array(nodeCount)
  measure(border, borderLanes())
  /** The room left around the routes drawn so far, so they push each other apart instead of squeezing into neighbouring lanes. */
  const nearRoute = new Int32Array(nodeCount).fill(-1)

  const paint = (rect: LaneRect, back: number, front: number): void => {
    const x0 = Math.max(0, rect.x0 - back)
    const y0 = Math.max(0, rect.y0 - back)
    const x1 = Math.min(width - 1, rect.x1 + front)
    const y1 = Math.min(height - 1, rect.y1 + front)
    for (let y = y0; y <= y1; y += 1) blocked.fill(1, nodeOf(x0, y), nodeOf(x1, y) + 1)
  }

  /** The free ports of one side, each with its distance from the side's middle in port steps per cell of side, so a long side yields its middle before a short one. */
  const ports = (rect: LaneRect, side: Side): { node: number; offset: number }[] => {
    const alongY = side === 'x-' || side === 'x+'
    const [from, to] = alongY ? [rect.y0, rect.y1] : [rect.x0, rect.x1]
    const cells = (to - from) / LANES
    const fixed = side === 'x-' ? rect.x0 : side === 'x+' ? rect.x1 : side === 'y-' ? rect.y0 : rect.y1
    const result: { node: number; offset: number }[] = []
    for (let lane = from + PORT_PITCH; lane < to; lane += PORT_PITCH) {
      const node = alongY ? nodeOf(fixed, lane) : nodeOf(lane, fixed)
      if (!usedPorts.has(node)) result.push({ node, offset: Math.abs(lane - (from + to) / 2) / PORT_PITCH / cells })
    }
    return result
  }

  const edgeOf = (a: number, b: number): number => 2 * Math.min(a, b) + (Math.abs(a - b) === 1 ? 0 : 1)

  /**
   * Lanes a ground route starts behind a back side so that its first point
   * lands, on screen, on the middle of the roof's back edge: the roof's
   * shadow for its height above the ground plane, rounded down so the start
   * stays hidden under the roof. Moving one lane along both axes is one lane
   * up the screen.
   */
  const shadow = (roof: number): number => Math.floor(roof * ROOF_SHADOW * LANES)

  /** The route's points: the lattice nodes with the collinear ones dropped. */
  const lift = (nodes: readonly number[]): RoutePoint[] => {
    const points = nodes.map(node => {
      const x = node % width
      return { gx: sheet.gx + x / LANES, gy: sheet.gy + (node - x) / width / LANES }
    })
    return points.filter((point, index) => {
      if (index === 0 || index === points.length - 1) return true
      const previous = points[index - 1]!
      const next = points[index + 1]!
      return Math.sign(point.gx - previous.gx) !== Math.sign(next.gx - point.gx)
        || Math.sign(point.gy - previous.gy) !== Math.sign(next.gy - point.gy)
    })
  }

  /** The nodes from `from` stepping `lanes` times in `direction`, or undefined when one is off the lattice, blocked or on a lane in use. */
  const run = (from: number, direction: number, lanes: number): number[] | undefined => {
    const nodes = [from]
    let x = from % width
    let y = (from - x) / width
    for (let step = 0; step < lanes; step += 1) {
      x += DX[direction]!
      y += DY[direction]!
      if (x < 0 || y < 0 || x >= width || y >= height) return undefined
      const next = nodeOf(x, y)
      if (blocked[next] || used[edgeOf(nodes[nodes.length - 1]!, next)]) return undefined
      nodes.push(next)
    }
    return nodes
  }

  /** The lattice node where a route through `side` of `rect` starts or ends: the port, or the node behind it where the roof's shadow ends. */
  const anchor = (endpoint: Endpoint, side: Side, port: number): number | undefined => {
    const behind = endpoint.kind === 'building' && BACK.includes(side) ? shadow(endpoint.roof ?? 0) : 0
    const x = port % width - behind
    const y = (port - port % width) / width - behind
    if (x < 0 || y < 0) return undefined
    const node = nodeOf(x, y)
    return behind > 0 && blocked[node] ? undefined : node
  }

  const solve = (request: RouteRequest): { nodes: number[]; port: number; goalPort: number } => {
    const source = endpoints.get(request.source)
    const target = endpoints.get(request.target)
    if (!source || !target) {
      throw new Error(`Relationship ${request.id} names an element the sheet did not place`)
    }
    const own = new Set([source.key, target.key])
    const free = new Set([...source.within, ...target.within])
    blocked.fill(0)
    goal.fill(0)
    goalCost.fill(0)
    for (const endpoint of endpoints.values()) {
      const rect = lanes(endpoint.rect)
      if (endpoint.kind === 'building') {
        const ring = own.has(endpoint.key) ? 0 : RING
        paint(rect, ring, ring)
      } else if (endpoint.kind === 'slab') {
        if (own.has(endpoint.key)) {
          if (!free.has(endpoint.key)) paint(rect, 0, 0)
        } else if (!free.has(endpoint.key)) {
          paint(rect, RING, RING)
        }
      } else if (own.has(endpoint.key) && !free.has(endpoint.key)) {
        paint(rect, 0, 0)
      }
    }
    const sourceRect = lanes(source.rect)
    const targetRect = lanes(target.rect)
    const targetFacing = facing(targetRect, sourceRect)
    /** The port each goal stands for and the straight run from the goal into its anchor. */
    const goals = new Map<number, { port: number; suffix: number[] }>()
    for (const side of SIDES) {
      for (const { node, offset } of ports(targetRect, side)) {
        const end = anchor(target, side, node)
        const approach = end === undefined ? undefined : run(end, OUTWARD[side], APPROACH)
        if (approach === undefined) continue
        const last = approach[approach.length - 1]!
        goal[last] = INWARD[side] + 1
        goalCost[last] = offset * OFF_CENTRE + (targetFacing.has(side) ? 0 : SIDE_PENALTY)
        goals.set(last, { port: node, suffix: approach.slice(0, -1).reverse() })
      }
    }
    /** Goals lie up to this far outside the target, so the distance to its footprint overestimates by as much. */
    const reach = APPROACH + (target.kind === 'building' ? shadow(target.roof ?? 0) : 0)
    const h = (node: number): number => {
      const x = node % width
      const y = (node - x) / width
      const away = Math.max(targetRect.x0 - x, 0, x - targetRect.x1) + Math.max(targetRect.y0 - y, 0, y - targetRect.y1)
      return Math.max(0, away - reach)
    }
    g.fill(Infinity)
    parent.fill(-1)
    closed.fill(0)
    const heap = new Heap()
    /** The port each start state leaves through and the straight run from its anchor to the start. */
    const starts = new Map<number, { port: number; prefix: number[] }>()
    const push = (state: number, cost: number, from: number): void => {
      if (cost >= g[state]!) return
      g[state] = cost
      parent[state] = from
      heap.push({ f: cost + h(state >> 2), g: cost, state })
    }
    const sourceFacing = facing(sourceRect, targetRect)
    for (const side of SIDES) {
      const direction = OUTWARD[side]
      for (const { node, offset } of ports(sourceRect, side)) {
        const from = anchor(source, side, node)
        const out = from === undefined ? undefined : run(from, direction, APPROACH)
        if (out === undefined) continue
        const start = out[out.length - 1]!
        const cost = (sourceFacing.has(side) ? 0 : SIDE_PENALTY) + offset * OFF_CENTRE + APPROACH * STEP
        push(start * 4 + direction, cost, -1)
        starts.set(start * 4 + direction, { port: node, prefix: out.slice(0, -1) })
      }
    }
    while (heap.size > 0) {
      const { state } = heap.pop()
      if (closed[state]) continue
      closed[state] = 1
      const node = state >> 2
      const direction = state & 3
      if (goal[node] === direction + 1) {
        const path: number[] = []
        let start = state
        for (let current = state; current !== -1; current = parent[current]!) {
          path.push(current >> 2)
          start = current
        }
        const departure = starts.get(start)!
        const arrival = goals.get(node)!
        return {
          nodes: [...departure.prefix, ...path.reverse(), ...arrival.suffix],
          port: departure.port,
          goalPort: arrival.port,
        }
      }
      const x = node % width
      const y = (node - x) / width
      for (let next = 0; next < 4; next += 1) {
        const nx = x + DX[next]!
        const ny = y + DY[next]!
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const neighbour = nodeOf(nx, ny)
        if (blocked[neighbour]) continue
        const cost = g[state]! + STEP + (next === direction ? 0 : BEND) + REUSE * used[edgeOf(node, neighbour)]!
          + crowd(border, neighbour) + crowd(nearRoute, neighbour) + (goal[neighbour] ? goalCost[neighbour]! : 0)
        push(neighbour * 4 + next, cost, state)
      }
    }
    throw new Error(`No route for ${request.id} (${request.source} → ${request.target})`)
  }

  const drawn: number[] = []
  return requests.map(request => {
    const { nodes, port, goalPort } = solve(request)
    usedPorts.add(port)
    usedPorts.add(goalPort)
    for (let index = 1; index < nodes.length; index += 1) {
      const edge = edgeOf(nodes[index - 1]!, nodes[index]!)
      used[edge] = Math.min(255, used[edge]! + 1)
    }
    drawn.push(...nodes)
    measure(nearRoute, drawn)
    return {
      id: request.id,
      source: request.source,
      target: request.target,
      description: request.description,
      origin: request.origin,
      points: lift(nodes),
    }
  })
}
