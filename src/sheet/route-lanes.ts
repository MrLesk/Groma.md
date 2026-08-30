import { Constraint, Solver, Variable } from 'webcola'

import {
  LANE_GAP,
  ROUTE_CLEARANCE,
  ROUTE_UNIT,
  crossingRouteIdsFor,
  visibleObstacle,
  type Endpoint,
  type FlatRoute,
  type Point,
} from './route-geometry.ts'
import { routeSpacingIndex, type RouteSpacing } from './route-spacing.ts'

const EPSILON = 0.001
const TRANSITION = ROUTE_UNIT
const MIN_LANE_RUN = ROUTE_UNIT * 1.5
const PREFERRED_LANE_GAP = ROUTE_UNIT * 2

interface RouteSegment {
  routeId: string
  index: number
  axis: 'horizontal' | 'vertical'
  coordinate: number
  start: number
  end: number
}

type CrossingChecker = ReturnType<typeof crossingRouteIdsFor>

function same(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON
}

function collinear(a: Point, b: Point, c: Point): boolean {
  return Math.abs(a.x - b.x) < EPSILON && Math.abs(b.x - c.x) < EPSILON
    || Math.abs(a.y - b.y) < EPSILON && Math.abs(b.y - c.y) < EPSILON
}

function compactPoints(points: readonly Point[]): Point[] {
  const result: Point[] = []
  for (const point of points) {
    if (same(result.at(-1) ?? { x: Number.NaN, y: Number.NaN }, point)) continue
    while (result.length >= 2 && collinear(result.at(-2)!, result.at(-1)!, point)) result.pop()
    if (!same(result.at(-1) ?? { x: Number.NaN, y: Number.NaN }, point)) result.push({ ...point })
  }
  return result
}

/** Simplifies only the path between the fixed wall and guard points at both ports. */
export function compactRoute(points: readonly Point[]): Point[] {
  if (points.length < 4) return compactPoints(points)
  return [{ ...points[0]! }, ...compactPoints(points.slice(1, -1)), { ...points.at(-1)! }]
}

function routeSegments(routes: readonly FlatRoute[]): RouteSegment[] {
  const result: RouteSegment[] = []
  for (const route of routes) {
    for (let index = 1; index < route.points.length; index += 1) {
      const segment = routeSegment(route, index)
      if (segment) result.push(segment)
    }
  }
  return result
}

function routeSegment(route: FlatRoute, index: number): RouteSegment | null {
  const from = route.points[index - 1]!
  const to = route.points[index]!
  const segmentIndex = index - 1
  const horizontal = Math.abs(from.y - to.y) < EPSILON
  const vertical = Math.abs(from.x - to.x) < EPSILON
  if (!horizontal && !vertical) throw new Error(`Route ${route.id} is not orthogonal`)
  const along = horizontal ? [from.x, to.x] : [from.y, to.y]
  const length = Math.abs(along[1]! - along[0]!)
  const touchesBothPorts = segmentIndex === 1 && segmentIndex === route.points.length - 3
  const needsTransition = segmentIndex === 1 || segmentIndex === route.points.length - 3
  if (length < EPSILON || touchesBothPorts || needsTransition && length < TRANSITION * 2) return null
  return {
    routeId: route.id,
    index: segmentIndex,
    axis: horizontal ? 'horizontal' : 'vertical',
    coordinate: horizontal ? from.y : from.x,
    start: Math.min(...along),
    end: Math.max(...along),
  }
}

function overlap(a: RouteSegment, b: RouteSegment): number {
  return Math.min(a.end, b.end) - Math.max(a.start, b.start)
}

function componentKey(group: readonly RouteSegment[]): string {
  return group
    .map(segment => `${segment.axis}:${segment.routeId}:${segment.index}:${segment.coordinate.toFixed(3)}`)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .join('|')
}

function conflictComponents(segments: readonly RouteSegment[], desiredGap = LANE_GAP): RouteSegment[][] {
  const parents = segments.map((_, index) => index)
  const find = (index: number): number => {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]!]!
      index = parents[index]!
    }
    return index
  }
  for (let left = 0; left < segments.length; left += 1) {
    for (let right = left + 1; right < segments.length; right += 1) {
      const a = segments[left]!
      const b = segments[right]!
      if (a.routeId === b.routeId || a.axis !== b.axis) continue
      if (overlap(a, b) > MIN_LANE_RUN && Math.abs(a.coordinate - b.coordinate) < desiredGap - EPSILON) {
        const leftRoot = find(left)
        const rightRoot = find(right)
        if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot
      }
    }
  }
  const groups = new Map<number, RouteSegment[]>()
  segments.forEach((segment, index) => {
    const root = find(index)
    const group = groups.get(root) ?? []
    group.push(segment)
    groups.set(root, group)
  })
  const span = (group: readonly RouteSegment[]) => group
    .reduce((total, segment) => total + segment.end - segment.start, 0)
  return [...groups.values()]
    .filter(group => group.length > 1)
    .sort((a, b) => span(b) - span(a)
      || b.length - a.length
      || componentKey(a).localeCompare(componentKey(b), undefined, { numeric: true }))
}

function orderedSegments(group: readonly RouteSegment[]): RouteSegment[] {
  return [...group].sort((a, b) => a.coordinate - b.coordinate
    || a.routeId.localeCompare(b.routeId, undefined, { numeric: true })
    || a.index - b.index)
}

interface ObstacleBounds {
  endpoint: Endpoint
  x: [number, number]
  y: [number, number]
}

function obstacleBounds(endpoints: ReadonlyMap<string, Endpoint>): ObstacleBounds[] {
  return [...endpoints.values()]
    .filter(endpoint => endpoint.kind === 'building')
    .map(endpoint => {
      const polygon = visibleObstacle(endpoint, ROUTE_CLEARANCE)
      return {
        endpoint,
        x: [Math.min(...polygon.map(point => point.x)), Math.max(...polygon.map(point => point.x))],
        y: [Math.min(...polygon.map(point => point.y)), Math.max(...polygon.map(point => point.y))],
      }
    })
}

function overlappingPairs(ordered: readonly RouteSegment[]): Array<[number, number]> {
  const pairs: Array<[number, number]> = []
  for (let left = 0; left < ordered.length; left += 1) {
    for (let right = left + 1; right < ordered.length; right += 1) {
      if (ordered[left]!.routeId !== ordered[right]!.routeId
        && overlap(ordered[left]!, ordered[right]!) > EPSILON) pairs.push([left, right])
    }
  }
  return pairs
}

function segmentBounds(
  segment: RouteSegment,
  route: FlatRoute,
  obstacles: readonly ObstacleBounds[],
  reach: number,
  fixed: boolean,
): [number, number] | null {
  if (fixed) return [segment.coordinate, segment.coordinate]
  const along = segment.axis === 'horizontal' ? 'x' : 'y'
  const across = segment.axis === 'horizontal' ? 'y' : 'x'
  let lower = segment.coordinate - reach
  let upper = segment.coordinate + reach
  for (const obstacle of obstacles) {
    const alongOverlap = Math.min(segment.end, obstacle[along][1]) - Math.max(segment.start, obstacle[along][0])
    if (alongOverlap <= EPSILON) continue
    const [from, to] = obstacle[across]
    if (segment.coordinate <= from + EPSILON) upper = Math.min(upper, from)
    else if (segment.coordinate >= to - EPSILON) lower = Math.max(lower, to)
    else if (obstacle.endpoint.key !== route.source && obstacle.endpoint.key !== route.target) return null
  }
  return [lower, upper]
}

function allBounds(
  ordered: readonly RouteSegment[],
  routesById: ReadonlyMap<string, FlatRoute>,
  obstacles: readonly ObstacleBounds[],
  reach: number,
  fixedRouteIds: ReadonlySet<string>,
): Array<[number, number]> | null {
  const result: Array<[number, number]> = []
  for (const segment of ordered) {
    const bounds = segmentBounds(
      segment,
      routesById.get(segment.routeId)!,
      obstacles,
      reach,
      fixedRouteIds.has(segment.routeId),
    )
    if (!bounds) return null
    result.push(bounds)
  }
  return result
}

function solveLanes(
  ordered: readonly RouteSegment[],
  pairs: readonly [number, number][],
  bounds: readonly [number, number][],
  gap: number,
): Variable[] | null {
  const variables = ordered.map(segment => new Variable(segment.coordinate))
  const constraints = pairs.map(([left, right]) => new Constraint(variables[left]!, variables[right]!, gap))
  const fixed: Array<{ variable: Variable; position: number }> = []
  for (const [[lower, upper], index] of bounds.map((bound, index) => [bound, index] as const)) {
    const lowerVariable = new Variable(lower, 1e9)
    const upperVariable = new Variable(upper, 1e9)
    fixed.push({ variable: lowerVariable, position: lower }, { variable: upperVariable, position: upper })
    variables.push(lowerVariable, upperVariable)
    constraints.push(
      new Constraint(lowerVariable, variables[index]!, 0),
      new Constraint(variables[index]!, upperVariable, 0),
    )
  }
  new Solver(variables, constraints).solve()
  return fixed.some(item => Math.abs(item.variable.position() - item.position) > EPSILON) ? null : variables
}

function widestSolution(
  ordered: readonly RouteSegment[],
  pairs: readonly [number, number][],
  bounds: readonly [number, number][],
  desiredGap: number,
): { variables: Variable[]; gap: number } | null {
  let variables = solveLanes(ordered, pairs, bounds, desiredGap)
  if (variables) return { variables, gap: desiredGap }
  let lower = 0
  let upper = desiredGap
  for (let step = 0; step < 12; step += 1) {
    const gap = (lower + upper) / 2
    const candidate = solveLanes(ordered, pairs, bounds, gap)
    if (candidate) {
      lower = gap
      variables = candidate
    } else upper = gap
  }
  return variables ? { variables, gap: lower } : null
}

function stableCoordinate(value: number): number {
  const rounded = Math.round(value)
  return Math.abs(value - rounded) < EPSILON ? rounded : Math.round(value * 1_000_000) / 1_000_000
}

function constrainedTargets(
  endpoints: ReadonlyMap<string, Endpoint>,
  routes: readonly FlatRoute[],
  group: readonly RouteSegment[],
  desiredGap: number,
  fixedRouteIds: ReadonlySet<string> = new Set(),
): Map<string, number> | null {
  const routesById = new Map(routes.map(route => [route.id, route]))
  const ordered = orderedSegments(group)
  const reach = Math.max(4 * ROUTE_UNIT, ordered.length * desiredGap)
  const bounds = allBounds(ordered, routesById, obstacleBounds(endpoints), reach, fixedRouteIds)
  if (!bounds) return null
  const solution = widestSolution(ordered, overlappingPairs(ordered), bounds, desiredGap)
  if (!solution || solution.gap < ROUTE_UNIT / 12) return null
  return new Map(ordered.map((segment, index) => [
    `${segment.routeId}\0${segment.index}`,
    fixedRouteIds.has(segment.routeId)
      ? segment.coordinate
      : stableCoordinate(solution.variables[index]!.position()),
  ]))
}

function shiftedPoint(point: Point, axis: RouteSegment['axis'], coordinate: number): Point {
  return axis === 'horizontal' ? { x: point.x, y: coordinate } : { x: coordinate, y: point.y }
}

function transitionPoint(from: Point, to: Point, axis: RouteSegment['axis'], fromStart: boolean): Point {
  const along = axis === 'horizontal' ? 'x' : 'y'
  const direction = Math.sign(to[along] - from[along])
  const anchor = fromStart ? from : to
  return { ...anchor, [along]: anchor[along] + direction * TRANSITION * (fromStart ? 1 : -1) }
}

function shiftSegment(points: Point[], segment: RouteSegment, coordinate: number): void {
  const index = segment.index
  const from = points[index]!
  const to = points[index + 1]!
  if (index === 1) {
    const stub = transitionPoint(from, to, segment.axis, true)
    points.splice(index + 1, 1, stub, shiftedPoint(stub, segment.axis, coordinate), shiftedPoint(to, segment.axis, coordinate))
  } else if (index === points.length - 3) {
    const stub = transitionPoint(from, to, segment.axis, false)
    points.splice(index, 1, shiftedPoint(from, segment.axis, coordinate), shiftedPoint(stub, segment.axis, coordinate), stub)
  } else {
    points[index] = shiftedPoint(from, segment.axis, coordinate)
    points[index + 1] = shiftedPoint(to, segment.axis, coordinate)
  }
}

function applyLanes(
  routes: readonly FlatRoute[],
  group: readonly RouteSegment[],
  targets: ReadonlyMap<string, number>,
): FlatRoute[] {
  const byRoute = Map.groupBy(group, segment => segment.routeId)
  return routes.map(route => {
    const entries = byRoute.get(route.id)
    if (!entries) return route
    const points = route.points.map(point => ({ ...point }))
    for (const segment of [...entries].sort((a, b) => b.index - a.index)) {
      shiftSegment(points, segment, targets.get(`${segment.routeId}\0${segment.index}`)!)
    }
    return { ...route, points: compactRoute(points) }
  })
}

function endpointsUnchanged(before: readonly FlatRoute[], after: readonly FlatRoute[]): boolean {
  const originals = new Map(before.map(route => [route.id, route]))
  return after.every(route => {
    const original = originals.get(route.id)!
    return same(route.points[0]!, original.points[0]!) && same(route.points.at(-1)!, original.points.at(-1)!)
  })
}

function segmentLength(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function runDirection(from: Point, to: Point): string {
  return Math.abs(from.x - to.x) < EPSILON
    ? `vertical:${Math.sign(to.y - from.y)}`
    : `horizontal:${Math.sign(to.x - from.x)}`
}

function preservesEndpointDirections(before: readonly Point[], after: readonly Point[]): boolean {
  return runDirection(before[0]!, before[1]!) === runDirection(after[0]!, after[1]!)
    && runDirection(before.at(-2)!, before.at(-1)!) === runDirection(after.at(-2)!, after.at(-1)!)
}

function collapsibleDogleg(lengths: readonly number[], index: number, pointCount: number): boolean {
  if (lengths.every(length => length < LANE_GAP - EPSILON)) return true
  const touchesEndpoint = index === 0 || index + 3 === pointCount - 1
  return touchesEndpoint && lengths[1]! <= ROUTE_UNIT + EPSILON
}

function collapseDoglegs(route: FlatRoute, crosses: CrossingChecker, crossesClearance: CrossingChecker): FlatRoute {
  let points = route.points.map(point => ({ ...point }))
  for (let index = 0; index + 3 < points.length;) {
    const [a, b, c, d] = points.slice(index, index + 4) as [Point, Point, Point, Point]
    const lengths = [segmentLength(a, b), segmentLength(b, c), segmentLength(c, d)]
    if (!collapsibleDogleg(lengths, index, points.length)) {
      index += 1
      continue
    }
    const candidates = [
      [a, { x: d.x, y: a.y }, d],
      [a, { x: a.x, y: d.y }, d],
    ].map(shortcut => compactRoute([
      ...points.slice(0, index),
      ...shortcut,
      ...points.slice(index + 4),
    ])).sort((left, right) => {
      const length = (candidate: readonly Point[]) => candidate.slice(1)
        .reduce((total, point, pointIndex) => total + segmentLength(candidate[pointIndex]!, point), 0)
      return length(left) - length(right)
    })
    const before = crossesClearance([{ ...route, points }])
    const safe = candidates.find(candidate => {
      const changed = [{ ...route, points: candidate }]
      return preservesEndpointDirections(points, candidate)
        && crosses(changed).length === 0
        && crossesClearance(changed).every(routeId => before.includes(routeId))
    })
    if (!safe) {
      index += 1
      continue
    }
    points = safe
    index = Math.max(0, index - 1)
  }
  return { ...route, points }
}

function improves(before: RouteSpacing, after: RouteSpacing): boolean {
  if (after.sharedPathLength < before.sharedPathLength - EPSILON) return true
  if (after.sharedPathLength > before.sharedPathLength + EPSILON) return false
  return after.crowdedBodyLength < before.crowdedBodyLength - EPSILON
}

function preservesMinimum(before: RouteSpacing | undefined, after: RouteSpacing | undefined): boolean {
  if (!before || !after) return true
  return after.sharedPathLength <= before.sharedPathLength + EPSILON
    && after.crowdedBodyLength <= before.crowdedBodyLength + EPSILON
}

function bestCandidate(
  endpoints: ReadonlyMap<string, Endpoint>,
  routes: readonly FlatRoute[],
  group: readonly RouteSegment[],
  crosses: CrossingChecker,
  crossesClearance: CrossingChecker,
  desiredGap: number,
  protectMinimum: boolean,
): FlatRoute[] | null {
  const changedRouteIds = new Set(group.map(segment => segment.routeId))
  const spacing = routeSpacingIndex(routes, changedRouteIds)
  const gaps = protectMinimum ? [desiredGap, LANE_GAP] : [desiredGap]
  const currentChanged = routes.filter(route => changedRouteIds.has(route.id))
  const [before, minimumBefore] = spacing.measure(currentChanged, gaps)
  const blockedRouteIds = new Set<string>()
  const evaluate = (target: ReadonlyMap<string, number>) => {
    const candidate = applyLanes(routes, group, target)
    const changed = candidate.filter(route => changedRouteIds.has(route.id))
    const previousClearance = new Set(crossesClearance(currentChanged))
    const buildingCrossings = crosses(changed)
    const clearanceCrossings = crossesClearance(changed)
    const newClearance = clearanceCrossings.filter(id => !previousClearance.has(id))
    for (const id of buildingCrossings) blockedRouteIds.add(id)
    for (const id of newClearance) blockedRouteIds.add(id)
    if (!endpointsUnchanged(routes, candidate)
      || buildingCrossings.length > 0
      || newClearance.length > 0) return null
    const [diagnostics, minimumAfter] = spacing.measure(changed, gaps)
    if (!preservesMinimum(minimumBefore, minimumAfter)) return null
    return improves(before, diagnostics) ? { routes: candidate, diagnostics } : null
  }
  const target = constrainedTargets(endpoints, routes, group, desiredGap)
  const candidate = target ? evaluate(target) : null
  if (candidate) return candidate.routes
  const fixedSets = blockedRouteIds.size > 0
    ? [blockedRouteIds]
    : changedRouteIds.size === 2
      ? [...changedRouteIds].map(routeId => new Set([routeId]))
      : []
  let best: { routes: FlatRoute[]; diagnostics: RouteSpacing } | null = null
  for (const fixedRouteIds of fixedSets) {
    const pinnedTarget = constrainedTargets(endpoints, routes, group, desiredGap, fixedRouteIds)
    const pinned = pinnedTarget ? evaluate(pinnedTarget) : null
    if (pinned && (!best || improves(best.diagnostics, pinned.diagnostics))) best = pinned
  }
  return best?.routes ?? null
}

/** Separates Libavoid highways while preserving topology, fixed ports and obstacle safety. */
export function refineRoutes(
  endpoints: ReadonlyMap<string, Endpoint>,
  rawRoutes: readonly FlatRoute[],
): FlatRoute[] {
  const crosses = crossingRouteIdsFor(endpoints)
  const crossesClearance = crossingRouteIdsFor(endpoints, ROUTE_CLEARANCE)
  let routes = rawRoutes.map(route => collapseDoglegs(
    { ...route, points: compactRoute(route.points) },
    crosses,
    crossesClearance,
  ))
  const improve = (desiredGap: number, attempts: number, protectMinimum: boolean): void => {
    const rejected = new Set<string>()
    let groups = conflictComponents(routeSegments(routes), desiredGap)
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const group = groups.find(candidate => !rejected.has(componentKey(candidate)))
      if (!group) break
      const candidate = bestCandidate(
        endpoints,
        routes,
        group,
        crosses,
        crossesClearance,
        desiredGap,
        protectMinimum,
      )
      if (candidate) {
        routes = candidate
        groups = conflictComponents(routeSegments(routes), desiredGap)
      } else rejected.add(componentKey(group))
    }
  }
  improve(LANE_GAP, 300, false)
  routes = routes.map(route => collapseDoglegs(route, crosses, crossesClearance))
  improve(PREFERRED_LANE_GAP, 4, true)
  return routes.map(route => collapseDoglegs(route, crosses, crossesClearance))
}
