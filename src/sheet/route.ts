import type { WorldRelationship } from '../types.ts'
import { LANES, SLAB_RISE } from './grid.ts'
import type { CellRect, Route, RoutePoint } from './types.ts'

/** Lanes of clearance a route keeps from a foreign footprint. */
export const RING = 1
/** Lanes kept behind a foreign slab's back edges, so a ground route never shows through the raised deck. */
const SLAB_BACK = 3
/** Lanes between two ports on one side: ports sit on half-cell marks. */
const PORT_PITCH = 2
/** Route costs: one lattice step, one turn, one lane another route already uses. */
const STEP = 1
const BEND = 6
const REUSE = 4

/** Anything a route may start or end on, with the slab and island it stands in. */
export interface Endpoint {
  key: string
  kind: 'building' | 'slab' | 'island'
  rect: CellRect
  within: string[]
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
 * Routes every relationship on the quarter-cell lattice with A*: each route
 * leaves its source through a free half-cell port, keeps one lane clear of
 * every foreign footprint, enters a building or slab on a front side, and pays
 * for turns and for lanes other routes already use. Routes are solved in the
 * order given, so parallel routes take neighbouring ports.
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
  const goal = new Uint8Array(nodeCount)
  const used = new Uint8Array(nodeCount * 2)
  const usedPorts = new Set<number>()
  const g = new Float64Array(stateCount)
  const parent = new Int32Array(stateCount)
  const closed = new Uint8Array(stateCount)
  const slabLanes = [...endpoints.values()]
    .filter(endpoint => endpoint.kind === 'slab')
    .map(endpoint => lanes(endpoint.rect))

  const paint = (rect: LaneRect, back: number, front: number): void => {
    const x0 = Math.max(0, rect.x0 - back)
    const y0 = Math.max(0, rect.y0 - back)
    const x1 = Math.min(width - 1, rect.x1 + front)
    const y1 = Math.min(height - 1, rect.y1 + front)
    for (let y = y0; y <= y1; y += 1) blocked.fill(1, nodeOf(x0, y), nodeOf(x1, y) + 1)
  }

  const ports = (rect: LaneRect, sides: readonly ('x-' | 'x+' | 'y-' | 'y+')[]): number[] => {
    const result: number[] = []
    for (const side of sides) {
      if (side === 'x-' || side === 'x+') {
        const x = side === 'x-' ? rect.x0 : rect.x1
        for (let y = rect.y0 + PORT_PITCH; y < rect.y1; y += PORT_PITCH) result.push(nodeOf(x, y))
      } else {
        const y = side === 'y-' ? rect.y0 : rect.y1
        for (let x = rect.x0 + PORT_PITCH; x < rect.x1; x += PORT_PITCH) result.push(nodeOf(x, y))
      }
    }
    return result.filter(node => !usedPorts.has(node))
  }

  const outward = (rect: LaneRect, node: number): number => {
    const x = node % width
    const y = (node - x) / width
    if (x === rect.x0) return 2
    if (x === rect.x1) return 0
    return y === rect.y0 ? 3 : 1
  }

  const edgeOf = (a: number, b: number): number => 2 * Math.min(a, b) + (Math.abs(a - b) === 1 ? 0 : 1)

  const zAt = (x: number, y: number): number => slabLanes.some(slab =>
    x > slab.x0 && x < slab.x1 && y > slab.y0 && y < slab.y1) ? SLAB_RISE : 0

  const lift = (nodes: readonly number[]): RoutePoint[] => {
    const points: RoutePoint[] = []
    const at = (node: number, z: number): RoutePoint => {
      const x = node % width
      const y = (node - x) / width
      return { gx: sheet.gx + x / LANES, gy: sheet.gy + y / LANES, z }
    }
    let previousZ = 0
    nodes.forEach((node, index) => {
      const x = node % width
      const z = zAt(x, (node - x) / width)
      if (index === 0) {
        points.push(at(node, z))
      } else {
        if (z > previousZ) points.push(at(nodes[index - 1]!, z))
        if (z < previousZ) points.push(at(node, previousZ))
        points.push(at(node, z))
      }
      previousZ = z
    })
    return points.filter((point, index) => {
      if (index === 0 || index === points.length - 1) return true
      const previous = points[index - 1]!
      const next = points[index + 1]!
      return Math.sign(point.gx - previous.gx) !== Math.sign(next.gx - point.gx)
        || Math.sign(point.gy - previous.gy) !== Math.sign(next.gy - point.gy)
        || Math.sign(point.z - previous.z) !== Math.sign(next.z - point.z)
    })
  }

  const solve = (request: RouteRequest): number[] => {
    const source = endpoints.get(request.source)
    const target = endpoints.get(request.target)
    if (!source || !target) {
      throw new Error(`Relationship ${request.id} names an element the sheet did not place`)
    }
    const own = new Set([source.key, target.key])
    const free = new Set([...source.within, ...target.within])
    blocked.fill(0)
    goal.fill(0)
    for (const endpoint of endpoints.values()) {
      const rect = lanes(endpoint.rect)
      if (endpoint.kind === 'building') {
        const ring = own.has(endpoint.key) ? 0 : RING
        paint(rect, ring, ring)
      } else if (endpoint.kind === 'slab') {
        if (own.has(endpoint.key)) {
          if (!free.has(endpoint.key)) paint(rect, 0, 0)
        } else if (!free.has(endpoint.key)) {
          paint(rect, SLAB_BACK, RING)
        }
      } else if (own.has(endpoint.key) && !free.has(endpoint.key)) {
        paint(rect, 0, 0)
      }
    }
    const sourceRect = lanes(source.rect)
    const targetRect = lanes(target.rect)
    const goals = ports(targetRect, target.kind === 'island' ? ['x-', 'x+', 'y-', 'y+'] : ['x+', 'y+'])
    for (const node of goals) {
      goal[node] = 1
      blocked[node] = 0
    }
    const h = (node: number): number => {
      const x = node % width
      const y = (node - x) / width
      return Math.max(targetRect.x0 - x, 0, x - targetRect.x1) + Math.max(targetRect.y0 - y, 0, y - targetRect.y1)
    }
    g.fill(Infinity)
    parent.fill(-1)
    closed.fill(0)
    const heap = new Heap()
    const push = (state: number, cost: number, from: number): void => {
      if (cost >= g[state]!) return
      g[state] = cost
      parent[state] = from
      heap.push({ f: cost + h(state >> 2), g: cost, state })
    }
    for (const node of ports(sourceRect, ['x-', 'x+', 'y-', 'y+'])) {
      push(node * 4 + outward(sourceRect, node), 0, -1)
    }
    while (heap.size > 0) {
      const { state } = heap.pop()
      if (closed[state]) continue
      closed[state] = 1
      const node = state >> 2
      const direction = state & 3
      if (goal[node]) {
        const path: number[] = []
        for (let current = state; current !== -1; current = parent[current]!) path.push(current >> 2)
        return path.reverse()
      }
      const x = node % width
      const y = (node - x) / width
      for (let next = 0; next < 4; next += 1) {
        const nx = x + DX[next]!
        const ny = y + DY[next]!
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const neighbour = nodeOf(nx, ny)
        if (blocked[neighbour] && !goal[neighbour]) continue
        const cost = g[state]! + STEP + (next === direction ? 0 : BEND) + REUSE * used[edgeOf(node, neighbour)]!
        push(neighbour * 4 + next, cost, state)
      }
    }
    throw new Error(`No route for ${request.id} (${request.source} → ${request.target})`)
  }

  return requests.map(request => {
    const nodes = solve(request)
    usedPorts.add(nodes[0]!)
    usedPorts.add(nodes[nodes.length - 1]!)
    for (let index = 1; index < nodes.length; index += 1) {
      const edge = edgeOf(nodes[index - 1]!, nodes[index]!)
      used[edge] = Math.min(255, used[edge]! + 1)
    }
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
