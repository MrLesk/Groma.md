import { BEND, CROSSING, CROWDING, OTHER_WALL, OVERFLOW } from './costs.ts'
import { EAST, NORTH, SOUTH, WEST, exitDirection, type RouteGraph } from './graph.ts'
import type { Point, PortPair } from './geometry.ts'
import { LineRuns, type LineRun, type RunEnds } from './order.ts'
import type { PortChoice, PortChoices } from './ports.ts'
import { SearchQueue } from './queue.ts'

const OPPOSITE = [WEST, NORTH, EAST, SOUTH]
/** The unit step of each heading, indexed like the directions. */
const STEP_X = [1, 0, -1, 0]
const STEP_Y = [0, 1, 0, -1]

const axisOf = (direction: number): number => direction & 1
/** East and south run toward larger coordinates. */
const forward = (direction: number): boolean => direction === EAST || direction === SOUTH
/** Toward larger (1) or smaller (-1) coordinates: the side of a line a move toward `direction` leaves by. */
const signOf = (direction: number): number => forward(direction) ? 1 : -1
/** By heading: a run heading forward joined its line at the low end; heading north or east, left is the -1 side. */
const ENDS: readonly RunEnds[] = [EAST, SOUTH, WEST, NORTH]
  .map(direction => ({ joinedAtLow: forward(direction), left: direction === NORTH || direction === EAST ? -1 : 1 }))
/** A search state packs a node, the heading, and how the path came onto its current line: 0 from its port, else 1 + heading. */
const STATES = 4 * 5
const stateOf = (node: number, heading: number, joined: number): number => node * STATES + heading * 5 + joined
const nodeOf = (state: number): number => Math.floor(state / STATES)
const headingOf = (state: number): number => Math.floor(state % STATES / 5)
const joinedOf = (state: number): number => state % 5

/**
 * The fewest bends any path heading `heading` needs to reach a point `ahead` along that heading and `aside` to its
 * right, arriving heading `entry`.
 */
function fewestBends(heading: number, entry: number, ahead: number, aside: number): number {
  // Graph nodes on one line share their coordinate exactly; the tolerance only keeps rounding from overestimating.
  const level = 1e-6
  if (entry === heading) return ahead > -level ? (Math.abs(aside) <= level ? 0 : 2) : 4
  if (entry === OPPOSITE[heading]) return Math.abs(aside) > level ? 2 : 4
  // Arriving across the heading: one turn where the target lies ahead and on the side the entry points to.
  const toward = entry === (heading + 1) % 4 ? aside : -aside
  return ahead > -level && toward > level ? 1 : 3
}

/** A route's path through the graph, from the guard of its chosen source port to the guard of its chosen target port. */
interface Path {
  nodes: number[]
  /** The chosen port at each end, as an index into the route's port choices. */
  source: number
  target: number
}

/** A target guard the current search may end at: entered heading `entry`, for the target port choice `choice`. */
interface Goal {
  node: number
  entry: number
  cost: number
  choice: number
}

const wallCost = (choice: PortChoice): number => choice.preferred ? 0 : OTHER_WALL

/**
 * Finds every route's path through the route graph, and the walls it leaves and enters by. Routes may share channel
 * edges up to the number that fit at the least spacing; a path pays for its length and bends, for a wall other than
 * its preferred one, for crowding a channel past its comfortable spacing, and for every route it crosses: running
 * straight over another route's line, or sharing a stretch of line with a route whose ends alternate with its own
 * round the stretch.
 */
export class RoutePaths {
  private graph: RouteGraph
  private choices: readonly PortChoices[]
  /** Routes on each edge, indexed like `graph.capacity`. */
  private loads: Uint16Array
  /** Routes running straight through each node, indexed `node * 2 + axis`. */
  private straight: Uint16Array
  /** Ports on each endpoint wall: every preferred port, whether or not its route took it, and every other one taken. */
  private wallPorts: Uint16Array
  /** The straight stretches of the placed paths, by line. */
  private placed = new LineRuns()
  private paths = new Map<number, Path>()
  /** Whether a full channel may be overfilled; only for a route that has no other path. */
  private overfill = false
  private scores: Float64Array
  private seen: Uint32Array
  private closed: Uint32Array
  /** The state before each state, or -1 - node for the first move out of the source guard `node`. */
  private parents: Int32Array
  /** The node where the path to each state joined its current line. */
  private joins: Int32Array
  /** The orders the path to each state carried round the corner where it joined its current line, when any. */
  private carried: (ReadonlyMap<number, number> | undefined)[]
  /** One stretch reused for every crossing count during a search. */
  private stretch: LineRun = { line: 0, low: 0, high: 0, lowSide: 0, highSide: 0 }
  /** The goals of the current search, and the index of the goal at each target guard node while `goalRun` marks it. */
  private goals: Goal[] = []
  private goalAt: Int32Array
  private goalRun: Uint32Array
  private run = 0
  private queue = new SearchQueue()

  constructor(graph: RouteGraph, choices: readonly PortChoices[]) {
    this.graph = graph
    this.choices = choices
    this.loads = new Uint16Array(graph.x.length * 2)
    this.straight = new Uint16Array(graph.x.length * 2)
    const walls = choices.flatMap(request => [...request.source, ...request.target].map(choice => choice.wall))
    this.wallPorts = new Uint16Array(Math.max(0, ...walls) + 1)
    for (const request of choices) {
      for (const [preferred] of [request.source, request.target]) this.wallPorts[preferred!.wall]! += 1
    }
    const states = graph.x.length * STATES
    this.scores = new Float64Array(states)
    this.seen = new Uint32Array(states)
    this.closed = new Uint32Array(states)
    this.parents = new Int32Array(states)
    this.joins = new Int32Array(states)
    this.carried = new Array(states).fill(undefined)
    this.goalAt = new Int32Array(graph.x.length)
    this.goalRun = new Uint32Array(graph.x.length)
  }

  /** The route's path from its source guard to its target guard. */
  points(index: number): Point[] {
    return this.paths.get(index)!.nodes.map(node => ({ x: this.graph.x[node]!, y: this.graph.y[node]! }))
  }

  /** The ports the route's path leaves and enters by. */
  ports(index: number): PortPair {
    const path = this.paths.get(index)!
    return { source: this.choices[index]!.source[path.source]!.port, target: this.choices[index]!.target[path.target]!.port }
  }

  /** Places the route's first path; false when it has none, even through full channels. */
  route(index: number): boolean {
    let path = this.search(index, Infinity)
    if (!path) {
      this.overfill = true
      path = this.search(index, Infinity)
      this.overfill = false
    }
    if (!path) return false
    this.take(index, path, 1)
    return true
  }

  /** Reroutes one path with every other path in place, keeping it unless a cheaper one exists. */
  improve(index: number): void {
    const original = this.paths.get(index)!
    this.take(index, original, -1)
    const better = this.search(index, this.cost(original, index))
    this.take(index, better ?? original, 1)
  }

  /** Adds or removes a path: its edges, the nodes it runs straight through, its straight stretches, and its walls other than the preferred ones. */
  private take(index: number, path: Path, change: number): void {
    if (change > 0) this.paths.set(index, path)
    this.occupy(path.nodes, change)
    if (change > 0) this.placed.add(index, this.runsOf(path.nodes))
    else this.placed.remove(index, this.runsOf(path.nodes))
    for (const choice of [this.choices[index]!.source[path.source]!, this.choices[index]!.target[path.target]!]) {
      if (!choice.preferred) this.wallPorts[choice.wall]! += change
    }
  }

  /** A preferred port is always open; another wall only while it has room for one more port. */
  private allowed(choice: PortChoice): boolean {
    return choice.preferred || this.wallPorts[choice.wall]! < choice.room
  }

  private edge(from: number, direction: number): number {
    const to = this.graph.next[from * 4 + direction]!
    return (forward(direction) ? from : to) * 2 + axisOf(direction)
  }

  private directionBetween(from: number, to: number): number {
    for (let direction = 0; direction < 4; direction += 1) if (this.graph.next[from * 4 + direction] === to) return direction
    throw new Error('Path nodes are not neighbours')
  }

  private occupy(nodes: readonly number[], change: number): void {
    let previous = -1
    for (let index = 1; index < nodes.length; index += 1) {
      const direction = this.directionBetween(nodes[index - 1]!, nodes[index]!)
      this.loads[this.edge(nodes[index - 1]!, direction)]! += change
      if (direction === previous) this.straight[nodes[index - 1]! * 2 + axisOf(direction)]! += change
      previous = direction
    }
  }

  private step(from: number, to: number): number {
    return Math.abs(this.graph.x[to]! - this.graph.x[from]!) + Math.abs(this.graph.y[to]! - this.graph.y[from]!)
  }

  /** Routes along an edge with one more, counting parallel lines in the same channel. */
  private load(edge: number): number {
    let load = this.loads[edge]! + 1
    const beside = this.graph.beside[edge]
    if (beside) for (const other of beside) load += this.loads[other]!
    return load
  }

  /**
   * Extra cost of one more route along the edge from `from` toward `direction`, which then holds `load` routes: crowding
   * past comfortable spacing and overfilling a full channel.
   */
  private crowding(from: number, direction: number, load = this.load(this.edge(from, direction))): number {
    const edge = this.edge(from, direction)
    const length = this.step(from, this.graph.next[from * 4 + direction]!)
    return CROWDING * length * Math.max(0, load - this.graph.comfort[edge]!) + OVERFLOW * Math.max(0, load - this.graph.capacity[edge]!)
  }

  /**
   * The straight stretch from `from` to `to` heading `direction`, joined after heading `before` and left toward
   * `after`; -1 for either where the path starts or ends at a port there.
   */
  private lineRun(from: number, to: number, direction: number, before: number, after: number,
    run: LineRun = { line: 0, low: 0, high: 0, lowSide: 0, highSide: 0 }): LineRun {
    const along = axisOf(direction) === 0 ? this.graph.x : this.graph.y
    const start = before < 0 ? 0 : -signOf(before)
    const end = after < 0 ? 0 : signOf(after)
    const ahead = forward(direction)
    run.line = this.graph.line[this.edge(from, direction)]!
    run.low = along[ahead ? from : to]!
    run.high = along[ahead ? to : from]!
    run.lowSide = ahead ? start : end
    run.highSide = ahead ? end : start
    return run
  }

  /** The straight stretches of a path. */
  private runsOf(nodes: readonly number[]): LineRun[] {
    const runs: LineRun[] = []
    let start = 0
    let before = -1
    for (let at = 1; at < nodes.length; at += 1) {
      const direction = this.directionBetween(nodes[at - 1]!, nodes[at]!)
      const after = at + 1 < nodes.length ? this.directionBetween(nodes[at]!, nodes[at + 1]!) : -1
      if (after === direction) continue
      runs.push(this.lineRun(nodes[start]!, nodes[at]!, direction, before, after))
      start = at
      before = direction
    }
    return runs
  }

  /**
   * Routes crossed along the stretch from `join` to `end` heading `heading`, joined after heading `before` and left
   * toward `after` (-1 at a port), with the orders `carried` round the corner at `join`. Leaves in `placed.carry` the
   * orders to carry round the corner at `end`.
   */
  private stretchCrossings(join: number, end: number, heading: number, before: number, after: number,
    carried: ReadonlyMap<number, number> | undefined): number {
    return this.placed.crossings(this.lineRun(join, end, heading, before, after, this.stretch), ENDS[heading]!, carried)
  }

  /**
   * Cost of leaving `node` toward `direction` after arriving with `heading` onto a line joined at `join` after heading
   * `before` (-1 from the port) with the orders `carried`: a straight move crosses the routes running straight across
   * the node, and a turn ends the stretch along the line, crossing the routes it alternates with there.
   */
  private moveCost(node: number, heading: number, join: number, before: number, carried: ReadonlyMap<number, number> | undefined,
    direction: number, to: number, load?: number): number {
    const base = this.step(node, to) + this.crowding(node, direction, load)
    // Going straight crosses the routes that run straight through the node on the other axis.
    if (direction === heading) return base + CROSSING * this.straight[node * 2 + (axisOf(heading) ^ 1)]!
    return base + BEND + CROSSING * this.stretchCrossings(join, node, heading, before, direction, carried)
  }

  /** Cost of a last stretch that enters a target guard at `to` heading `direction`: its wall and its crossings. */
  private arrival(to: number, direction: number, join: number, before: number, carried: ReadonlyMap<number, number> | undefined): number {
    return this.goals[this.goalAt[to]!]!.cost + CROSSING * this.stretchCrossings(join, to, direction, before, -1, carried)
  }

  private cost(path: Path, index: number): number {
    const { nodes } = path
    const source = this.choices[index]!.source[path.source]!
    let heading = exitDirection[source.port.side]
    let total = wallCost(source) + wallCost(this.choices[index]!.target[path.target]!)
      + this.step(nodes[0]!, nodes[1]!) + this.crowding(nodes[0]!, heading)
    let join = nodes[0]!
    let before = -1
    let carried: ReadonlyMap<number, number> | undefined
    for (let at = 2; at < nodes.length; at += 1) {
      const direction = this.directionBetween(nodes[at - 1]!, nodes[at]!)
      total += this.moveCost(nodes[at - 1]!, heading, join, before, carried, direction, nodes[at]!)
      if (direction !== heading) {
        join = nodes[at - 1]!
        before = heading
        // moveCost has just counted the stretch that ended at this corner, which left its orders in `carry`.
        carried = this.placed.carry
      }
      heading = direction
    }
    return total + CROSSING * this.stretchCrossings(join, nodes.at(-1)!, heading, before, -1, carried)
  }

  private isGoal(node: number): boolean {
    return this.goalRun[node] === this.run
  }

  /**
   * The least cost left from `node` heading `heading`: to the nearest target guard, its distance, the bends any path
   * there needs, and its wall's cost.
   */
  private estimate(node: number, heading: number): number {
    if (this.isGoal(node)) return 0
    let best = Infinity
    for (const goal of this.goals) {
      const dx = this.graph.x[goal.node]! - this.graph.x[node]!
      const dy = this.graph.y[goal.node]! - this.graph.y[node]!
      const ahead = dx * STEP_X[heading]! + dy * STEP_Y[heading]!
      const aside = dy * STEP_X[heading]! - dx * STEP_Y[heading]!
      best = Math.min(best, Math.abs(dx) + Math.abs(dy) + BEND * fewestBends(heading, goal.entry, ahead, aside) + goal.cost)
    }
    return best
  }

  /**
   * The load of the edge from `node` toward `direction` with one more route, or -1 when the move is closed: no edge,
   * another route's port track, a full channel, or a target guard entered other than along its track.
   */
  private open(node: number, direction: number, index: number): number {
    const to = this.graph.next[node * 4 + direction]!
    if (to < 0 || (this.isGoal(to) && direction !== this.goals[this.goalAt[to]!]!.entry)) return -1
    const edge = this.edge(node, direction)
    const owners = this.graph.owners[edge]
    if (owners && !owners.includes(index)) return -1
    const load = this.load(edge)
    return this.overfill || load <= this.graph.capacity[edge]! ? load : -1
  }

  /** Marks the guards of the target ports the route may take as the goals of a new search run. */
  private markGoals(index: number): void {
    this.run += 1
    this.goals = []
    for (const [choice, target] of this.choices[index]!.target.entries()) {
      if (!this.allowed(target)) continue
      const node = this.graph.ends[index]!.target[choice]!
      this.goalRun[node] = this.run
      this.goalAt[node] = this.goals.length
      this.goals.push({ node, entry: OPPOSITE[exitDirection[target.port.side]]!, cost: wallCost(target), choice })
    }
  }

  /** The cheapest path for the route from any of its source ports to any of its target ports, if one costs under `limit`. */
  private search(index: number, limit: number): Path | undefined {
    this.markGoals(index)
    this.queue.size = 0
    for (const [choice, source] of this.choices[index]!.source.entries()) if (this.allowed(source)) this.start(index, choice, limit)
    while (this.queue.size > 0) {
      const state = this.queue.pop()
      if (this.closed[state] === this.run) continue
      this.closed[state] = this.run
      if (this.isGoal(nodeOf(state))) return this.pathTo(state, index)
      for (let direction = 0; direction < 4; direction += 1) this.relax(state, direction, index, limit)
    }
    return undefined
  }

  /** Queues the first move out of a source guard, straight out along its track. */
  private start(index: number, choice: number, limit: number): void {
    const source = this.choices[index]!.source[choice]!
    const start = this.graph.ends[index]!.source[choice]!
    const exit = exitDirection[source.port.side]
    const load = this.open(start, exit, index)
    if (load < 0) return
    const first = this.graph.next[start * 4 + exit]!
    const cost = wallCost(source) + this.step(start, first) + this.crowding(start, exit, load)
      + (this.isGoal(first) ? this.arrival(first, exit, start, -1, undefined) : 0)
    const state = stateOf(first, exit, 0)
    const estimate = this.estimate(first, exit)
    if (cost + estimate >= limit || (this.seen[state] === this.run && cost >= this.scores[state]!)) return
    this.scores[state] = cost
    this.seen[state] = this.run
    this.parents[state] = -1 - start
    this.joins[state] = start
    this.carried[state] = undefined
    this.queue.push(state, cost + estimate)
  }

  private relax(state: number, direction: number, index: number, limit: number): void {
    const node = nodeOf(state)
    const heading = headingOf(state)
    const joined = joinedOf(state)
    if (direction === OPPOSITE[heading]) return
    const load = this.open(node, direction, index)
    if (load < 0) return
    const to = this.graph.next[node * 4 + direction]!
    const next = stateOf(to, direction, direction === heading ? joined : 1 + heading)
    if (this.closed[next] === this.run) return
    const join = this.joins[state]!
    const before = joined - 1
    const carried = this.carried[state]
    let cost = this.scores[state]! + this.moveCost(node, heading, join, before, carried, direction, to, load)
    const turned = direction !== heading
    const nextJoin = turned ? node : join
    const nextBefore = turned ? heading : before
    // Read before `arrival` counts another stretch: moveCost's count of the stretch ending here left its orders in `carry`.
    const nextCarried = turned ? this.placed.carry : carried
    if (this.isGoal(to)) cost += this.arrival(to, direction, nextJoin, nextBefore, nextCarried)
    const estimate = this.estimate(to, direction)
    if (cost + estimate >= limit || (this.seen[next] === this.run && cost >= this.scores[next]!)) return
    this.scores[next] = cost
    this.seen[next] = this.run
    this.parents[next] = state
    this.joins[next] = nextJoin
    this.carried[next] = nextCarried
    this.queue.push(next, cost + estimate)
  }

  private pathTo(finish: number, index: number): Path {
    const nodes: number[] = []
    let state = finish
    for (; state >= 0; state = this.parents[state]!) nodes.push(nodeOf(state))
    const start = -1 - state
    nodes.push(start)
    nodes.reverse()
    const target = this.goals[this.goalAt[nodes.at(-1)!]!]!.choice
    return { nodes, source: this.graph.ends[index]!.source.indexOf(start), target }
  }
}
