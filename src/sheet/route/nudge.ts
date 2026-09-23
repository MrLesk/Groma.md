import { EPSILON, type Point } from './geometry.ts'
import type { Box } from './graph.ts'
import { compareOnLine, runsOf, type Run } from './order.ts'
import { BUNDLE_SPACING, ROUTE_CLEARANCE, ROUTE_SPACING } from './space.ts'

/** Building sides and port limits do not move; a huge weight pins them inside the solver's blocks. */
const PINNED = 1e6
/** A port prefers its assigned place on the wall over the middle of its bundle. */
const PORT = 4

/** The building a route leaves or enters, and the stretch of its wall where the port may slide. */
export interface RouteEnd {
  key: string
  span: [number, number]
}

/**
 * What a run keeps clear of on one axis, one of three kinds: a run (`run` set), a building side (`side`, `owner` and
 * `middle` set), or the pinned limit of a port's wall (neither set).
 */
interface Item {
  at: number
  from: number
  to: number
  run?: Run
  /** The building a side belongs to. */
  owner?: string
  /** For a building side: -1 when runs must stay before `at`, 1 when after. */
  side?: number
  /** For a building side: the middle of its box, which decides the side of a run inside the clearance. */
  middle?: number
}

interface Constraint {
  left: number
  right: number
  /** Runs of different routes keep their bundle's spacing; everything else may touch. */
  spaced: boolean
}

const movable = (item: Item): boolean => item.run !== undefined

/**
 * Two runs constrain each other when they share a stretch, or come within the minimum spacing of sharing one:
 * otherwise the other axis could slide them into each other.
 */
function near(a: Item, b: Item): boolean {
  return Math.min(a.to, b.to) - Math.max(a.from, b.from) > -ROUTE_SPACING
}

function sidesOf(boxes: readonly Box[], horizontal: boolean): Item[] {
  return boxes.flatMap(box => {
    const [low, high, from, to] = horizontal ? [box.y0, box.y1, box.x0, box.x1] : [box.x0, box.x1, box.y0, box.y1]
    const middle = (low + high) / 2
    return [{ at: low, from, to, side: -1, owner: box.key, middle }, { at: high, from, to, side: 1, owner: box.key, middle }]
  })
}

/**
 * Which of two runs on one axis comes first, or undefined when they never meet. The sweep passes `a` before `b` across
 * the axis, so only runs on one line need comparing.
 */
function runOrder(routes: readonly (readonly Point[])[], a: Item, b: Item): [Item, Item] | undefined {
  if (!near(a, b)) return undefined
  if (b.at - a.at > EPSILON) return [a, b]
  return compareOnLine(routes, a.run!, b.run!) < 0 ? [a, b] : [b, a]
}

/**
 * A run stays on its side of a building box it passes along, including a run already squeezed into the clearance, which
 * belongs to the nearer side; a port's own wall is where it starts.
 */
function sideOrder(run: Item, side: Item, ends: readonly { source: RouteEnd, target: RouteEnd }[]): [Item, Item] | undefined {
  const { route } = run.run!
  if (run.run!.ends.some(end => ends[route]![end].key === side.owner)) return undefined
  if (Math.min(run.to, side.to) - Math.max(run.from, side.from) <= EPSILON) return undefined
  if (side.side! < 0 && run.at <= side.middle!) return [run, side]
  if (side.side! > 0 && run.at >= side.middle!) return [side, run]
  return undefined
}

function pairOrder(routes: readonly (readonly Point[])[], a: Item, b: Item,
  ends: readonly { source: RouteEnd, target: RouteEnd }[]): [Item, Item] | undefined {
  if (a.run && b.run) return runOrder(routes, a, b)
  if (a.run) return sideOrder(a, b, ends)
  if (b.run) return sideOrder(b, a, ends)
  return undefined
}

/** Order of items across the axis where they overlap: by position, runs on one line by where their routes part. */
function across(routes: readonly (readonly Point[])[], a: Item, b: Item): number {
  if (Math.abs(a.at - b.at) > EPSILON) return a.at - b.at
  if (a.run && b.run) return compareOnLine(routes, a.run, b.run)
  if (a.side !== undefined) return b.side !== undefined ? 0 : -a.side
  return b.side ?? 0
}

/** A run reaches half the minimum spacing past its ends, so runs about to share a stretch meet in the sweep. */
const reach = (item: Item): number => item.run ? ROUTE_SPACING / 2 : 0

/**
 * Separation constraints between neighbours only: a sweep along the axis keeps the items that overlap the sweep
 * position in order across it, and links each item to the nearest items beside it that it must keep clear of.
 * Constraints between farther items would be implied by the chain and would wrongly demand a whole gap of their own.
 */
function constraintsOf(routes: readonly (readonly Point[])[], items: readonly Item[],
  ends: readonly { source: RouteEnd, target: RouteEnd }[]): Constraint[] {
  const events = items.flatMap((item, index) => [
    { at: item.from - reach(item), index, open: true }, { at: item.to + reach(item), index, open: false },
  ]).sort((a, b) => a.at - b.at || Number(b.open) - Number(a.open))
  const active: number[] = []
  const constraints = new Map<string, Constraint>()
  const link = (a: number, b: number): boolean => {
    const pair = pairOrder(routes, items[a]!, items[b]!, ends)
    if (!pair) return false
    const [left, right] = pair[0] === items[a] ? [a, b] : [b, a]
    constraints.set(`${left}:${right}`, {
      left, right, spaced: items[left]!.run !== undefined && items[right]!.run !== undefined && items[left]!.run!.route !== items[right]!.run!.route,
    })
    return true
  }
  /** Links `index` to the nearest items it must keep clear of among `active[..below]` and `active[above..]`. */
  const linkAround = (index: number, below: number, above: number): void => {
    for (let before = below - 1; before >= 0 && !link(active[before]!, index); before -= 1) { /* nearest linkable item before */ }
    for (let after = above; after < active.length && !link(index, active[after]!); after += 1) { /* nearest linkable item after */ }
  }
  for (const event of events) {
    if (event.open) {
      let at = 0
      while (at < active.length && across(routes, items[active[at]!]!, items[event.index]!) <= 0) at += 1
      linkAround(event.index, at, at)
      active.splice(at, 0, event.index)
      continue
    }
    const at = active.indexOf(event.index)
    active.splice(at, 1)
    // The items on both sides of the one that ended become neighbours.
    if (at > 0) linkAround(active[at - 1]!, 0, at)
    if (at < active.length) linkAround(active[at]!, at, active.length)
  }
  return [...constraints.values()]
}

/** Pinned limits keep every port run on the stretch of its wall, or walls, where ports may sit. */
function portLimits(items: Item[], constraints: Constraint[], ends: readonly { source: RouteEnd, target: RouteEnd }[]): void {
  for (const [index, item] of [...items.entries()]) {
    for (const end of item.run?.ends ?? []) {
      const [low, high] = ends[item.run!.route]![end].span
      items.push({ at: Math.min(low, item.at), from: item.from, to: item.to }, { at: Math.max(high, item.at), from: item.from, to: item.to })
      constraints.push({ left: items.length - 2, right: index, spaced: false }, { left: index, right: items.length - 1, spaced: false })
    }
  }
}

/** The constraints ending at each item (`incoming`) and starting from it (`outgoing`), by constraint index. */
interface Links {
  incoming: number[][]
  outgoing: number[][]
}

function linksOf(count: number, constraints: readonly Constraint[]): Links {
  const incoming: number[][] = Array.from({ length: count }, () => [])
  const outgoing: number[][] = Array.from({ length: count }, () => [])
  for (const [index, constraint] of constraints.entries()) {
    incoming[constraint.right]!.push(index)
    outgoing[constraint.left]!.push(index)
  }
  return { incoming, outgoing }
}

function topologicalOrder(constraints: readonly Constraint[], links: Links): number[] {
  const waiting = links.incoming.map(list => list.length)
  const ready = waiting.flatMap((degree, index) => degree === 0 ? [index] : [])
  const order: number[] = []
  while (ready.length > 0) {
    const next = ready.pop()!
    order.push(next)
    for (const index of links.outgoing[next]!) {
      const right = constraints[index]!.right
      waiting[right]! -= 1
      if (waiting[right] === 0) ready.push(right)
    }
  }
  if (order.length !== waiting.length) throw new Error('Route order contains a cycle')
  return order
}

/**
 * The gap of every constraint: the bundle spacing between routes, shrunk only along chains of runs that do not fit
 * between the pinned items at their ends, so one tight gap between buildings does not squeeze routes elsewhere. A chain
 * that does not fit even at the minimum spacing may use the clearance beside the buildings it runs between.
 */
function spacings(items: readonly Item[], constraints: readonly Constraint[], links: Links, order: readonly number[]): number[] {
  const gaps = constraints.map(constraint => constraint.spaced ? BUNDLE_SPACING : 0)
  // Each round shrinks the chains that are still too tight; a few rounds settle every map, 16 only bounds the loop.
  for (let round = 0; round < 16; round += 1) {
    const { earliest, via } = earliestPositions(items, constraints, order, links.incoming, gaps)
    const tight = constraints.flatMap((constraint, index) => !movable(items[constraint.right]!)
      && earliest[constraint.left]! + gaps[index]! > items[constraint.right]!.at + EPSILON ? [index] : [])
    const changed = tight.map(index => shrink(items, constraints, gaps, via, index))
    if (!changed.some(Boolean)) break
  }
  return gaps
}

/** Where each item could sit at the earliest, and the constraint that holds it there. */
function earliestPositions(items: readonly Item[], constraints: readonly Constraint[], order: readonly number[],
  incoming: readonly number[][], gaps: readonly number[]) {
  const earliest = items.map(item => movable(item) ? -Infinity : item.at)
  const via = items.map(() => -1)
  for (const variable of order) {
    if (!movable(items[variable]!)) continue
    for (const index of incoming[variable]!) {
      const reach = earliest[constraints[index]!.left]! + gaps[index]!
      if (reach > earliest[variable]!) {
        earliest[variable] = reach
        via[variable] = index
      }
    }
  }
  return { earliest, via }
}

/** Shrinks the gaps on the chain that ends in constraint `last` until it fits; false when nothing can shrink. */
function shrink(items: readonly Item[], constraints: readonly Constraint[], gaps: number[], via: readonly number[],
  last: number): boolean {
  const chain = [last]
  for (let at = via[constraints[last]!.left]!; at >= 0; at = via[constraints[at]!.left]!) chain.push(at)
  const start = constraints[chain.at(-1)!]!.left
  if (movable(items[start]!)) return false
  const room = items[constraints[last]!.right]!.at - items[start]!.at
  const spaced = chain.filter(index => constraints[index]!.spaced)
  const fixed = chain.filter(index => !constraints[index]!.spaced).reduce((sum, index) => sum + gaps[index]!, 0)
  const total = spaced.reduce((sum, index) => sum + gaps[index]!, 0)
  const scale = total > 0 ? Math.max(0, room - fixed) / total : 1
  let changed = false
  for (const index of spaced) {
    const next = Math.max(ROUTE_SPACING, gaps[index]! * scale)
    if (next < gaps[index]! - EPSILON) changed = true
    gaps[index] = next
  }
  if (changed || fixed + spaced.length * ROUTE_SPACING <= room + EPSILON) return changed
  // Even the least spacing does not fit: runs may move into the clearance beside the buildings at the chain's ends,
  // keeping the least spacing from their walls.
  for (const index of chain) {
    const { left, right } = constraints[index]!
    if (items[left]!.side === undefined && items[right]!.side === undefined) continue
    if (gaps[index]! > ROUTE_SPACING - ROUTE_CLEARANCE + EPSILON) {
      gaps[index] = ROUTE_SPACING - ROUTE_CLEARANCE
      changed = true
    }
  }
  return changed
}

/** Items glued together by tight constraints; a block sits at the weighted mean of its members' lines. */
class Blocks {
  private offset: number[]
  private block: number[]
  private members: number[][]
  private weighted: number[]
  private total: number[]

  constructor(items: readonly Item[]) {
    const weight = items.map(item => !item.run ? PINNED : item.run.ends.length > 0 ? PORT : 1)
    this.offset = items.map(() => 0)
    this.block = items.map((_, index) => index)
    this.members = items.map((_, index) => [index])
    this.weighted = items.map((item, index) => weight[index]! * item.at)
    this.total = weight
  }

  position(index: number): number {
    const block = this.block[index]!
    return this.weighted[block]! / this.total[block]! + this.offset[index]!
  }

  of(index: number): number {
    return this.block[index]!
  }

  membersOf(index: number): readonly number[] {
    return this.members[this.block[index]!]!
  }

  /** Joins the block of `right` to the block of `left` so that `right` sits exactly `gap` after `left`. */
  merge(left: number, right: number, gap: number): void {
    const into = this.block[left]!
    const from = this.block[right]!
    const shift = this.offset[left]! + gap - this.offset[right]!
    for (const member of this.members[from]!) {
      this.offset[member]! += shift
      this.block[member] = into
    }
    this.members[into]!.push(...this.members[from]!)
    this.members[from] = []
    this.weighted[into]! += this.weighted[from]! - shift * this.total[from]!
    this.total[into]! += this.total[from]!
  }
}

/** The incoming constraint of the variable's block that is violated most, or -1. */
function worstIncoming(blocks: Blocks, variable: number, constraints: readonly Constraint[], incoming: readonly number[][],
  gaps: readonly number[]): number {
  let worst = -1
  let violation = EPSILON
  for (const member of blocks.membersOf(variable)) {
    for (const index of incoming[member]!) {
      const constraint = constraints[index]!
      if (blocks.of(constraint.left) === blocks.of(member)) continue
      const amount = blocks.position(constraint.left) + gaps[index]! - blocks.position(member)
      if (amount > violation) {
        violation = amount
        worst = index
      }
    }
  }
  return worst
}

/**
 * Places every item as close to its line as the constraints allow: each item starts as its own block, and a block that
 * violates an incoming constraint merges with the block before it. Bundles therefore centre on their channel line and
 * buildings push them aside.
 */
function solve(items: readonly Item[], constraints: readonly Constraint[], links: Links, order: readonly number[],
  gaps: readonly number[]): number[] {
  const blocks = new Blocks(items)
  for (const variable of order) {
    for (let worst = worstIncoming(blocks, variable, constraints, links.incoming, gaps); worst >= 0;
      worst = worstIncoming(blocks, variable, constraints, links.incoming, gaps)) {
      blocks.merge(constraints[worst]!.left, constraints[worst]!.right, gaps[worst]!)
    }
  }
  return items.map((_, index) => blocks.position(index))
}

/**
 * Makes the solved positions exactly feasible: each run, in constraint order, stays at its solved position unless its
 * predecessors push it on, and never passes the latest position its successors and the pinned items allow.
 */
function settle(solved: readonly number[], items: readonly Item[], constraints: readonly Constraint[], links: Links,
  order: readonly number[], gaps: readonly number[]): number[] {
  const { incoming, outgoing } = links
  const latest = items.map(item => movable(item) ? Infinity : item.at)
  for (const variable of [...order].reverse()) {
    if (!movable(items[variable]!)) continue
    for (const index of outgoing[variable]!) {
      latest[variable] = Math.min(latest[variable]!, latest[constraints[index]!.right]! - gaps[index]!)
    }
  }
  const positions = items.map(item => item.at)
  for (const variable of order) {
    if (!movable(items[variable]!)) continue
    const pushed = Math.max(solved[variable]!, ...incoming[variable]!.map(index => positions[constraints[index]!.left]! + gaps[index]!))
    positions[variable] = Math.min(pushed, latest[variable]!)
  }
  return positions
}

function place(routes: Point[][], items: readonly Item[], positions: readonly number[]): void {
  for (const [index, item] of items.entries()) {
    const run = item.run
    if (!run) continue
    const points = routes[run.route]!
    for (const point of [points[run.index]!, points[run.index + 1]!]) {
      if (run.horizontal) point.y = positions[index]!
      else point.x = positions[index]!
    }
  }
}

/** Runs of different routes that share a stretch yet ended up closer than the least spacing without a constraint. */
function unseparated(routes: readonly (readonly Point[])[], items: readonly Item[], constraints: readonly Constraint[],
  positions: readonly number[]): Constraint[] {
  const linked = new Set(constraints.map(({ left, right }) => `${left}:${right}`))
  const runs = items.flatMap((item, index) => item.run ? [index] : [])
  const missing: Constraint[] = []
  for (const [position, a] of runs.entries()) {
    for (const b of runs.slice(position + 1)) {
      const [first, second] = [items[a]!, items[b]!]
      if (first.run!.route === second.run!.route || Math.abs(positions[a]! - positions[b]!) >= ROUTE_SPACING - EPSILON
        || !near(first, second) || linked.has(`${a}:${b}`) || linked.has(`${b}:${a}`)) continue
      const [left, right] = across(routes, first, second) <= 0 ? [a, b] : [b, a]
      missing.push({ left, right, spaced: true })
    }
  }
  return missing
}

/**
 * Spreads the runs of one axis: routes on one line become an evenly spaced bundle centred on it. The neighbour sweep
 * can miss two runs that only just share a stretch; any pair left too close gets its constraint and the pass repeats.
 */
function nudgeAxis(routes: Point[][], boxes: readonly Box[], ends: readonly { source: RouteEnd, target: RouteEnd }[],
  horizontal: boolean): void {
  const runs = runsOf(routes).filter(run => run.horizontal === horizontal)
  const items: Item[] = [...runs.map(run => ({ at: run.at, from: run.from, to: run.to, run })), ...sidesOf(boxes, horizontal)]
  const constraints = constraintsOf(routes, items, ends)
  portLimits(items, constraints, ends)
  for (;;) {
    const links = linksOf(items.length, constraints)
    const order = topologicalOrder(constraints, links)
    const gaps = spacings(items, constraints, links, order)
    const positions = settle(solve(items, constraints, links, order, gaps), items, constraints, links, order, gaps)
    const missing = unseparated(routes, items, constraints, positions)
    if (missing.length === 0) {
      place(routes, items, positions)
      return
    }
    constraints.push(...missing)
  }
}

/**
 * Separates routes that share channel lines, keeping each shared stretch in one order: vertical runs first, then
 * horizontal runs with the new lengths, then vertical runs again for the lengths the horizontal pass changed. Ports
 * slide along their walls where a bundle needs the room.
 */
export function nudgeRoutes(routes: Point[][], boxes: readonly Box[], ends: readonly { source: RouteEnd, target: RouteEnd }[]): void {
  for (const horizontal of [false, true, false]) nudgeAxis(routes, boxes, ends, horizontal)
}
