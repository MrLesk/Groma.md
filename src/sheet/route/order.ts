/*
 * The order of routes that share a line, one rule for both routing stages: routes sharing a stretch keep one order
 * along all of it, and round a corner they take together, so they cross only where they meet or part, and only when
 * they meet and part on opposite sides of each other. The path search prices crossings by it before any route is drawn
 * (LineRuns); nudging draws the routes in that order (compareOnLine).
 */

import { EPSILON, type Point } from './geometry.ts'

/**
 * A straight stretch of a route along one line of the route graph, from `low` to `high` along it, and where the route
 * goes at each end: to the side of smaller (-1) or larger (1) coordinates across the line, or 0 where it ends at a port.
 */
export interface LineRun {
  line: number
  low: number
  high: number
  lowSide: number
  highSide: number
}

/** How a new run ends: which end it joined its line at, and which side across the line is left of its heading. */
export interface RunEnds {
  joinedAtLow: boolean
  left: number
}

/**
 * Across the line at one end of the stretch two runs share, which side the new run keeps: -1 or 1 when it keeps to the
 * smaller or larger coordinates of the other run, 0 when both meet the end at the same place. A run that goes on beyond
 * the end sits between the runs that turn off to either side there.
 */
function keptSide(run: LineRun, other: LineRun, at: number, low: boolean): number {
  const side = (r: LineRun) => Math.abs((low ? r.low : r.high) - at) <= EPSILON ? (low ? r.lowSide : r.highSide) : 0
  return Math.sign(side(run) - side(other))
}

/**
 * The stretches of the placed routes, by line. Two routes that share a stretch must cross there when they keep to
 * opposite sides of each other at its two ends. Routes that turn a corner together keep their order round it, so a new
 * run carries that order to the next line, where it decides the end the two routes share.
 */
export class LineRuns {
  private runs: (LineRun & { route: number })[][] = []
  /**
   * Set by `crossings`: for each placed route that leaves the line by the same corner as the new run, the order to carry
   * round it, 1 when the new run keeps to its left.
   */
  carry: Map<number, number> | undefined

  add(route: number, runs: readonly LineRun[]): void {
    for (const run of runs) {
      const placed = this.runs[run.line]
      if (placed) placed.push({ ...run, route })
      else this.runs[run.line] = [{ ...run, route }]
    }
  }

  remove(route: number, runs: readonly LineRun[]): void {
    for (const line of new Set(runs.map(run => run.line))) this.runs[line] = this.runs[line]!.filter(run => run.route !== route)
  }

  /** Placed routes a new run must cross along its line, given the orders carried round the corner it joined at. */
  crossings(run: LineRun, ends: RunEnds, carried: ReadonlyMap<number, number> | undefined): number {
    this.carry = undefined
    const placed = this.runs[run.line]
    if (!placed) return 0
    let count = 0
    for (const other of placed) count += this.crossing(run, other, ends, carried)
    return count
  }

  /**
   * 1 when the new run must cross the placed run `other` on the stretch they share: its order at the end where it
   * joined differs from its order at the end where it leaves. At a corner both took onto the line the order comes from
   * `carried`; where both leave by the same corner it goes on round it, into `carry`.
   */
  private crossing(run: LineRun, other: LineRun & { route: number }, ends: RunEnds,
    carried: ReadonlyMap<number, number> | undefined): number {
    const lo = Math.max(run.low, other.low)
    const hi = Math.min(run.high, other.high)
    if (hi - lo <= EPSILON) return 0
    const low = keptSide(run, other, lo, true)
    const high = keptSide(run, other, hi, false)
    const joined = (ends.joinedAtLow ? low : high) || (carried?.get(other.route) ?? 0) * ends.left
    const leaving = ends.joinedAtLow ? high : low
    if (leaving !== 0) return joined !== 0 && joined !== leaving ? 1 : 0
    if (joined !== 0) {
      this.carry ??= new Map()
      this.carry.set(other.route, joined * ends.left)
    }
    return 0
  }
}

/** One straight piece of a route, from `points[index]` to `points[index + 1]`, at `at` across its axis. */
export interface Run {
  route: number
  index: number
  horizontal: boolean
  at: number
  from: number
  to: number
  /** The ends of the route this piece holds: the first leaves the source wall, the last enters the target wall. */
  ends: ('source' | 'target')[]
}

function runAt(points: readonly Point[], route: number, index: number): Run {
  const a = points[index]!
  const b = points[index + 1]!
  const horizontal = Math.abs(a.y - b.y) < EPSILON
  const [from, to] = horizontal ? [a.x, b.x] : [a.y, b.y]
  const ends = [...(index === 0 ? ['source' as const] : []), ...(index === points.length - 2 ? ['target' as const] : [])]
  return { route, index, horizontal, at: horizontal ? a.y : a.x, from: Math.min(from, to), to: Math.max(from, to), ends }
}

/** Every straight piece of the routes, numbered by route. */
export function runsOf(routes: readonly (readonly Point[])[]): Run[] {
  return routes.flatMap((points, route) => points.slice(1).map((_, index) => runAt(points, route, index)))
}

/** A position on a route: walking run `index` along its axis, forward (+1) or backward (-1). */
interface Walker {
  points: readonly Point[]
  index: number
  horizontal: boolean
  sign: number
}

/** Where the walker leaves its run, measured along its heading. */
function exitAlong(walker: Walker): number {
  const a = walker.points[walker.index]!
  const b = walker.points[walker.index + 1]!
  const end = forwardEnd(walker) === walker.index + 1 ? b : a
  return (walker.horizontal ? end.x : end.y) * walker.sign
}

/** Index of the run's point the walker reaches last. */
function forwardEnd(walker: Walker): number {
  const a = walker.points[walker.index]!
  const b = walker.points[walker.index + 1]!
  const delta = walker.horizontal ? b.x - a.x : b.y - a.y
  return Math.sign(delta) === walker.sign ? walker.index + 1 : walker.index
}

/** The walker's turn where it leaves its run: -1 left, 1 right, 0 into a wall; and the walker beyond the turn. */
function turn(walker: Walker): { side: number, next?: Walker } {
  const end = forwardEnd(walker)
  const nextIndex = end === walker.index + 1 ? walker.index + 1 : walker.index - 1
  if (nextIndex < 0 || nextIndex + 1 >= walker.points.length) return { side: 0 }
  const corner = walker.points[end]!
  const beyond = walker.points[end === walker.index + 1 ? end + 1 : end - 1]!
  const heading = walker.horizontal ? { x: walker.sign, y: 0 } : { x: 0, y: walker.sign }
  const along = walker.horizontal ? Math.sign(beyond.y - corner.y) : Math.sign(beyond.x - corner.x)
  const direction = walker.horizontal ? { x: 0, y: along } : { x: along, y: 0 }
  // In screen coordinates the left of heading (x, y) is (y, -x).
  const side = direction.x === heading.y && direction.y === -heading.x ? -1 : 1
  return { side, next: { points: walker.points, index: nextIndex, horizontal: !walker.horizontal, sign: along } }
}

/** -1 when `a` runs left of `b` looking along the walkers' common heading, 1 when right, 0 when undecided. */
function sideOf(a: Walker, b: Walker): number {
  let left: Walker | undefined = a
  let right: Walker | undefined = b
  // Routes part within a few runs; the 64 only bounds the walk.
  for (let steps = 0; left && right && steps < 64; steps += 1) {
    const leaveA = exitAlong(left)
    const leaveB = exitAlong(right)
    if (leaveA < leaveB - EPSILON) return turn(left).side
    if (leaveB < leaveA - EPSILON) return -turn(right).side
    const turnA = turn(left)
    const turnB = turn(right)
    if (turnA.side !== turnB.side) return turnA.side < turnB.side ? -1 : 1
    left = turnA.next
    right = turnB.next
  }
  return 0
}

/**
 * Orders two routes whose runs lie on the same line: -1 when run `p` takes the smaller coordinate. Both routes are
 * followed together until they part, and the one that turns off to one side lies on that side, so routes sharing a
 * stretch keep one order along all of it and cross only where they meet or part.
 */
export function compareOnLine(routes: readonly (readonly Point[])[], p: Run, q: Run): number {
  for (const sign of [1, -1]) {
    const side = sideOf(
      { points: routes[p.route]!, index: p.index, horizontal: p.horizontal, sign },
      { points: routes[q.route]!, index: q.index, horizontal: q.horizontal, sign },
    )
    // Left of east is north (smaller y); left of south is east (larger x). Walking backward mirrors both.
    if (side !== 0) return (p.horizontal ? side : -side) * sign
  }
  return p.route - q.route || p.index - q.index
}
