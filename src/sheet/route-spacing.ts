import { LANE_GAP, ROUTE_UNIT, type FlatRoute, type Point } from './route-geometry.ts'

const EPSILON = 0.001
const FAN_TRANSITION = ROUTE_UNIT * 1.5

interface Segment {
  routeId: string
  source: string
  target: string
  axis: 'horizontal' | 'vertical'
  coordinate: number
  start: number
  end: number
}

export interface RouteSpacing {
  sharedPathLength: number
  crowdedBodyLength: number
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
    source: route.source,
    target: route.target,
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

function overlap(a: Segment, b: Segment): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start))
}

/** Reuses unchanged segments while the lane refiner compares local candidates. */
export function routeSpacingIndex(
  routes: readonly FlatRoute[],
  touchingRouteIds: ReadonlySet<string>,
): { measure: (changedRoutes: readonly FlatRoute[], desiredGaps: readonly number[]) => RouteSpacing[] } {
  const unchanged = segments(routes.filter(route => !touchingRouteIds.has(route.id)))
  return {
    measure(changedRoutes, desiredGaps) {
      const changed = segments(changedRoutes)
      const scores = desiredGaps.map(() => ({ sharedPathLength: 0, crowdedBodyLength: 0 }))
      const measure = (a: Segment, b: Segment) => {
        if (a.routeId === b.routeId || a.axis !== b.axis) return
        const sharedSpan = overlap(a, b)
        if (sharedSpan < EPSILON) return
        const gap = Math.abs(a.coordinate - b.coordinate)
        const sharesEndpoint = a.source === b.source || a.source === b.target
          || a.target === b.source || a.target === b.target
        const bodySpan = sharesEndpoint ? sharedSpan - FAN_TRANSITION : sharedSpan
        desiredGaps.forEach((desiredGap, index) => {
          if (gap < EPSILON) scores[index]!.sharedPathLength += sharedSpan
          if (bodySpan >= desiredGap - EPSILON && gap < desiredGap - EPSILON) {
            scores[index]!.crowdedBodyLength += bodySpan * (desiredGap - gap) / desiredGap
          }
        })
      }
      for (const a of changed) for (const b of unchanged) measure(a, b)
      for (let left = 0; left < changed.length; left += 1) {
        for (let right = left + 1; right < changed.length; right += 1) {
          measure(changed[left]!, changed[right]!)
        }
      }
      return scores
    },
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
