import {
  LANE_GAP, ROUTE_CLEARANCE, ROUTE_SPACING, crossingRouteIdsFor, visibleObstacle,
  type Endpoint, type FlatRoute, type Point,
} from './route-geometry.ts'

const EPSILON = 0.001

interface Segment {
  routeId: string
  index: number
  axis: 'horizontal' | 'vertical'
  coordinate: number
  start: number
  end: number
}

function segmentOf(route: FlatRoute, index: number): Segment | null {
  const from = route.points[index - 1]!
  const to = route.points[index]!
  const dx = Math.abs(to.x - from.x)
  const dy = Math.abs(to.y - from.y)
  if (dx < EPSILON && dy < EPSILON) return null
  const horizontal = dy < EPSILON
  if (!horizontal && dx >= EPSILON) throw new Error(`Route ${route.id} is not orthogonal`)
  const along = horizontal ? [from.x, to.x] : [from.y, to.y]
  return {
    routeId: route.id,
    index,
    axis: horizontal ? 'horizontal' : 'vertical',
    coordinate: horizontal ? from.y : from.x,
    start: Math.min(...along),
    end: Math.max(...along),
  }
}

function segments(routes: readonly FlatRoute[]): Segment[] {
  const result: Segment[] = []
  for (const route of routes) {
    for (let index = 1; index < route.points.length; index += 1) {
      const segment = segmentOf(route, index)
      if (segment) result.push(segment)
    }
  }
  return result
}

function sharedLength(a: Segment, b: Segment): number {
  if (a.routeId === b.routeId || a.axis !== b.axis
    || Math.abs(a.coordinate - b.coordinate) >= ROUTE_SPACING - EPSILON) return 0
  const length = Math.min(a.end, b.end) - Math.max(a.start, b.start)
  return length < EPSILON ? 0 : length
}

/** Measures shared or visually overlapping parallel runs, reusing unchanged segments. */
export function sharedPathMeasure(
  routes: readonly FlatRoute[],
  touchingRouteIds: ReadonlySet<string>,
): (changedRoutes: readonly FlatRoute[]) => number {
  const unchanged = segments(routes.filter(route => !touchingRouteIds.has(route.id)))
  return changedRoutes => {
    const changed = segments(changedRoutes)
    let length = 0
    for (const a of changed) for (const b of unchanged) length += sharedLength(a, b)
    for (let left = 0; left < changed.length; left += 1) {
      for (let right = left + 1; right < changed.length; right += 1) {
        length += sharedLength(changed[left]!, changed[right]!)
      }
    }
    return length
  }
}

function onUsableWall(endpoint: Endpoint, point: Point): boolean {
  const polygon = visibleObstacle(endpoint)
  return [[0, 1], [2, 3], [3, 4], [5, 0]].some(([start, end]) => {
    const from = polygon[start!]!
    const to = polygon[end!]!
    const axis = from.x === to.x ? 'y' : 'x'
    const normal = axis === 'x' ? 'y' : 'x'
    const lower = Math.min(from[axis], to[axis])
    const upper = Math.max(from[axis], to[axis])
    const inset = (upper - lower) / 4
    return Math.abs(point[normal] - from[normal]) < EPSILON
      && point[axis] >= lower + inset - EPSILON && point[axis] <= upper - inset + EPSILON
  })
}

/** Nearest free tracks can sit on either side of the overlapping parallel runs. */
function alternativeTracks(run: Segment, others: readonly Segment[]): number[] {
  const coordinates = others.filter(other => other.axis === run.axis
    && Math.min(other.end, run.end) > Math.max(other.start, run.start) + EPSILON)
    .flatMap(other => [other.coordinate - ROUTE_SPACING, other.coordinate + ROUTE_SPACING])
  return [...new Set(coordinates)].sort((a, b) => Math.abs(a - run.coordinate) - Math.abs(b - run.coordinate))
}

function shiftedRun(route: FlatRoute, run: Segment, coordinate: number): FlatRoute {
  const axis = run.axis === 'horizontal' ? 'y' : 'x'
  const points = route.points.map(point => ({ ...point }))
  points[run.index - 1]![axis] = coordinate
  points[run.index]![axis] = coordinate
  return { ...route, points }
}

function clearPorts(endpoints: ReadonlyMap<string, Endpoint>, route: FlatRoute): boolean {
  return onUsableWall(endpoints.get(route.source)!, route.points[0]!)
    && onUsableWall(endpoints.get(route.target)!, route.points.at(-1)!)
}

function separateRoute(
  endpoints: ReadonlyMap<string, Endpoint>,
  routes: readonly FlatRoute[],
  route: FlatRoute,
  crosses: (routes: readonly FlatRoute[]) => string[],
): boolean {
  const overlap = sharedPathMeasure(routes, new Set([route.id]))
  let remaining = overlap([route])
  if (remaining < EPSILON) return false
  const others = segments(routes.filter(other => other !== route))
  const crowded = segments([route]).filter(run => others.some(other => sharedLength(run, other) > EPSILON))
  let replacement: Point[] | undefined
  for (const run of crowded) {
    for (const coordinate of alternativeTracks(run, others)) {
      const candidate = shiftedRun(route, run, coordinate)
      if (!clearPorts(endpoints, candidate)) continue
      const next = overlap([candidate])
      if (next >= remaining - EPSILON || crosses([candidate]).length > 0) continue
      replacement = candidate.points
      remaining = next
    }
  }
  if (replacement === undefined) return false
  route.points = replacement
  return true
}

/** Spread close parallel runs after routing, preserving wall attachment and building clearance. */
export function separateRoutes(endpoints: ReadonlyMap<string, Endpoint>, routes: FlatRoute[]): void {
  const crosses = crossingRouteIdsFor(endpoints, ROUTE_CLEARANCE)
  let improved = true
  // Every accepted move strictly reduces the total length of overlapping strokes.
  while (improved) {
    improved = false
    for (const route of routes) if (separateRoute(endpoints, routes, route, crosses)) improved = true
  }
}

export function orthogonal(points: readonly Point[]): boolean {
  return points.slice(1).every((point, index) =>
    Math.abs(point.x - points[index]!.x) < EPSILON
    || Math.abs(point.y - points[index]!.y) < EPSILON)
}

/** Route ids containing a reversal, a tiny three-step staircase, or an overloaded endpoint fan. */
export function artifactRouteIds(routes: readonly FlatRoute[]): string[] {
  const artifacts = new Set<string>()
  for (const route of routes) {
    const runs = route.points.slice(1).flatMap((to, index) => {
      const from = route.points[index]!
      const dx = to.x - from.x
      const dy = to.y - from.y
      const length = Math.abs(dx) + Math.abs(dy)
      if (length < EPSILON) return []
      return [{ axis: Math.abs(dx) < EPSILON ? 'vertical' as const : 'horizontal' as const, dx, dy, length }]
    })
    const reverses = runs.some((run, index) => {
      const next = runs[index + 1]
      return next !== undefined && run.axis === next.axis
        && (run.axis === 'horizontal' ? run.dx * next.dx : run.dy * next.dy) < -EPSILON
    })
    const staircase = runs.some((run, index) => {
      const second = runs[index + 1]
      const third = runs[index + 2]
      return second !== undefined && third !== undefined
        && run.axis !== second.axis && second.axis !== third.axis
        && run.length < LANE_GAP - EPSILON
        && second.length < LANE_GAP - EPSILON
        && third.length < LANE_GAP - EPSILON
    })
    if (reverses || staircase) artifacts.add(route.id)
  }
  const fans = new Map<string, string[]>()
  for (const route of routes) {
    for (const [role, from, to] of [
      ['source', route.points[0]!, route.points[1]!],
      ['target', route.points.at(-1)!, route.points.at(-2)!],
    ] as const) {
      const key = `${role}:${route[role]}:${Math.sign(to.x - from.x)},${Math.sign(to.y - from.y)}`
      const group = fans.get(key) ?? []
      group.push(route.id)
      fans.set(key, group)
    }
  }
  for (const group of fans.values()) {
    if (group.length <= 3) continue
    for (const id of group) artifacts.add(id)
  }
  return [...artifacts]
}
