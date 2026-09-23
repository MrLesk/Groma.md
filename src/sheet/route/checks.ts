import { EPSILON, inside, visibleObstacle, type Endpoint, type FlatRoute, type Point } from './geometry.ts'
import { runsOf, type Run } from './order.ts'
import { LANE_GAP, ROUTE_SPACING, ROUTE_UNIT } from './space.ts'

/** Length along which two parallel runs lie closer than `spacing`. */
function closeLength(a: Run, b: Run, spacing: number): number {
  if (a.horizontal !== b.horizontal || Math.abs(a.at - b.at) >= spacing - EPSILON) return 0
  const length = Math.min(a.to, b.to) - Math.max(a.from, b.from)
  return length < EPSILON ? 0 : length
}

/**
 * Measures the length of parallel runs closer than `spacing` to another route: by default the least spacing, where
 * strokes would share or visually overlap. It reuses the runs of the routes that do not change; the changed routes are
 * the touching ones, so a changed run and an unchanged run always belong to different routes.
 */
export function sharedPathMeasure(
  routes: readonly FlatRoute[],
  touchingRouteIds: ReadonlySet<string>,
  spacing = ROUTE_SPACING,
): (changedRoutes: readonly FlatRoute[]) => number {
  const unchanged = runsOf(routes.filter(route => !touchingRouteIds.has(route.id)).map(route => route.points))
  return changedRoutes => {
    const changed = runsOf(changedRoutes.map(route => route.points))
    let length = 0
    for (const a of changed) for (const b of unchanged) length += closeLength(a, b, spacing)
    for (let left = 0; left < changed.length; left += 1) {
      for (let right = left + 1; right < changed.length; right += 1) {
        if (changed[left]!.route !== changed[right]!.route) length += closeLength(changed[left]!, changed[right]!, spacing)
      }
    }
    return length
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

interface RouteObstacle {
  endpoint: Endpoint
  polygon: Point[]
  x: [number, number]
  y: [number, number]
}

function segmentEnters(from: Point, to: Point, polygon: readonly Point[]): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / (ROUTE_UNIT / 8)))
  for (let step = 1; step < steps; step += 1) {
    const point = {
      x: from.x + (to.x - from.x) * step / steps,
      y: from.y + (to.y - from.y) * step / steps,
    }
    if (inside(point, polygon)) return true
  }
  return false
}

function segmentMissesBounds(from: Point, to: Point, obstacle: RouteObstacle): boolean {
  return Math.max(from.x, to.x) < obstacle.x[0] || Math.min(from.x, to.x) > obstacle.x[1]
    || Math.max(from.y, to.y) < obstacle.y[0] || Math.min(from.y, to.y) > obstacle.y[1]
}

function segmentCrossesObstacle(
  route: FlatRoute,
  index: number,
  from: Point,
  to: Point,
  obstacle: RouteObstacle,
): boolean {
  if (obstacle.endpoint.key === route.source && index <= 2) return false
  if (obstacle.endpoint.key === route.target && index >= route.points.length - 2) return false
  return !segmentMissesBounds(from, to, obstacle) && segmentEnters(from, to, obstacle.polygon)
}

function routeCrosses(route: FlatRoute, obstacles: readonly RouteObstacle[]): boolean {
  for (let index = 1; index < route.points.length; index += 1) {
    const from = route.points[index - 1]!
    const to = route.points[index]!
    if (obstacles.some(obstacle => segmentCrossesObstacle(route, index, from, to, obstacle))) return true
  }
  return false
}

function segmentsCross(a0: Point, a1: Point, b0: Point, b1: Point): boolean {
  const aHorizontal = Math.abs(a0.y - a1.y) < EPSILON
  const bHorizontal = Math.abs(b0.y - b1.y) < EPSILON
  if (aHorizontal === bHorizontal) return false
  const [horizontal0, horizontal1] = aHorizontal ? [a0, a1] : [b0, b1]
  const [vertical0, vertical1] = aHorizontal ? [b0, b1] : [a0, a1]
  const between = (value: number, from: number, to: number) =>
    value > Math.min(from, to) + EPSILON && value < Math.max(from, to) - EPSILON
  return between(vertical0.x, horizontal0.x, horizontal1.x)
    && between(horizontal0.y, vertical0.y, vertical1.y)
}

export function routesCross(a: FlatRoute, b: FlatRoute): boolean {
  for (let left = 1; left < a.points.length; left += 1) {
    for (let right = 1; right < b.points.length; right += 1) {
      if (segmentsCross(a.points[left - 1]!, a.points[left]!, b.points[right - 1]!, b.points[right]!)) return true
    }
  }
  return false
}

/** Returns a checker for routes whose open body enters a foreign building silhouette. */
export function crossingRouteIdsFor(
  endpoints: ReadonlyMap<string, Endpoint>,
  clearance = 0,
): (routes: readonly FlatRoute[]) => string[] {
  const obstacles = [...endpoints.values()]
    .filter(endpoint => endpoint.kind === 'building')
    .map(endpoint => {
      const polygon = visibleObstacle(endpoint, clearance)
      const xs = polygon.map(point => point.x)
      const ys = polygon.map(point => point.y)
      return {
        endpoint,
        polygon,
        x: [Math.min(...xs), Math.max(...xs)] as [number, number],
        y: [Math.min(...ys), Math.max(...ys)] as [number, number],
      }
    })
  return routes => routes.filter(route => routeCrosses(route, obstacles)).map(route => route.id)
}
