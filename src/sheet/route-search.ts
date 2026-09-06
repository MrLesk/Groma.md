import { LANE_GAP, type Point } from './route-geometry.ts'
import type { RouteGrid } from './route-grid.ts'

/** Parallel arrays avoid an object allocation for every queued search state. */
class SearchQueue {
  private states: number[] = []
  private costs: number[] = []
  private priorities: number[] = []
  size = 0
  state = 0
  cost = 0

  private copy(from: number, to: number): void {
    this.states[to] = this.states[from]!
    this.costs[to] = this.costs[from]!
    this.priorities[to] = this.priorities[from]!
  }

  push(state: number, cost: number, priority: number): void {
    let index = this.size++
    while (index > 0) {
      const parent = (index - 1) >>> 1
      if (this.priorities[parent]! <= priority) break
      this.copy(parent, index)
      index = parent
    }
    this.states[index] = state
    this.costs[index] = cost
    this.priorities[index] = priority
  }

  pop(): void {
    this.state = this.states[0]!
    this.cost = this.costs[0]!
    const end = --this.size
    if (end === 0) return
    const state = this.states[end]!
    const cost = this.costs[end]!
    const priority = this.priorities[end]!
    let index = 0
    while (index * 2 + 1 < end) {
      let child = index * 2 + 1
      if (child + 1 < end && this.priorities[child + 1]! < this.priorities[child]!) child += 1
      if (priority <= this.priorities[child]!) break
      this.copy(child, index)
      index = child
    }
    this.states[index] = state
    this.costs[index] = cost
    this.priorities[index] = priority
  }
}

/** Search state includes the incoming axis so turns have a cost. */
export class RouteSearch {
  private grid: RouteGrid
  private scores: Float64Array
  private seen: Uint32Array
  private parents: Int32Array
  private closed: Uint32Array
  private run = 0
  private targetX = 0
  private targetY = 0
  private queue = new SearchQueue()

  constructor(grid: RouteGrid) {
    this.grid = grid
    const states = grid.blocked.length * 2
    this.scores = new Float64Array(states)
    this.seen = new Uint32Array(states)
    this.parents = new Int32Array(states)
    this.closed = new Uint32Array(states)
  }

  private heuristic(node: number): number {
    const width = this.grid.xs.length
    return Math.abs(this.grid.xs[node % width]! - this.targetX)
      + Math.abs(this.grid.ys[Math.floor(node / width)]! - this.targetY)
  }

  private available(node: number, edge: number, mask: number): boolean {
    const reserved = this.grid.reserved[node]!
    return !this.grid.blocked[node] && !(this.grid.used[edge]! & mask)
      && (reserved === 0 || reserved === this.run)
  }

  private relax(state: number, cost: number, next: number, axis: number, distance: number): void {
    const node = state >>> 1
    const edge = Math.min(node, next)
    if (!this.available(next, edge, axis + 1)) return
    const nextState = next * 2 + axis
    if (this.closed[nextState] === this.run) return
    const nextCost = cost + distance + (axis === (state & 1) ? 0 : LANE_GAP)
    if (this.seen[nextState] === this.run && nextCost >= this.scores[nextState]!) return
    this.scores[nextState] = nextCost
    this.seen[nextState] = this.run
    this.parents[nextState] = state
    this.queue.push(nextState, nextCost, nextCost + this.heuristic(next) * 1.15)
  }

  private expand(state: number, cost: number): void {
    const { xs, ys } = this.grid
    const node = state >>> 1
    const x = node % xs.length
    const y = Math.floor(node / xs.length)
    // Stable neighbour order also fixes the queue's tie order.
    if (x > 0) this.relax(state, cost, node - 1, 0, xs[x]! - xs[x - 1]!)
    if (x + 1 < xs.length) this.relax(state, cost, node + 1, 0, xs[x + 1]! - xs[x]!)
    if (y > 0) this.relax(state, cost, node - xs.length, 1, ys[y]! - ys[y - 1]!)
    if (y + 1 < ys.length) this.relax(state, cost, node + xs.length, 1, ys[y + 1]! - ys[y]!)
  }

  private path(finish: number): Point[] {
    const nodes: number[] = []
    for (let state = finish; state !== -1; state = this.parents[state]!) nodes.push(state >>> 1)
    nodes.reverse()
    for (let index = 1; index < nodes.length; index += 1) {
      const a = nodes[index - 1]!
      const b = nodes[index]!
      const edge = Math.min(a, b)
      this.grid.used[edge] = this.grid.used[edge]! | (Math.abs(a - b) === 1 ? 1 : 2)
    }
    const width = this.grid.xs.length
    return nodes.map(node => ({ x: this.grid.xs[node % width]!, y: this.grid.ys[Math.floor(node / width)]! }))
  }

  route(index: number, axis: number, id: string): Point[] {
    const [start, target] = this.grid.ends[index]!
    this.run = index + 1
    this.targetX = this.grid.xs[target % this.grid.xs.length]!
    this.targetY = this.grid.ys[Math.floor(target / this.grid.xs.length)]!
    this.queue.size = 0
    const first = start * 2 + axis
    this.scores[first] = 0
    this.seen[first] = this.run
    this.parents[first] = -1
    this.queue.push(first, 0, this.heuristic(start))
    while (this.queue.size > 0) {
      this.queue.pop()
      const { state, cost } = this.queue
      if (this.closed[state] === this.run || this.scores[state] !== cost) continue
      this.closed[state] = this.run
      if (state >>> 1 === target) return this.path(state)
      this.expand(state, cost)
    }
    throw new Error(`Could not route relationship ${id}`)
  }
}
