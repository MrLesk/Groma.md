import type { Bounds, Point } from '../../types.ts'

function same(left: Point, right: Point): boolean {
  return left.x === right.x && left.y === right.y
}

export function inside(point: Point, bounds: Bounds): boolean {
  return point.x >= bounds.x
    && point.x < bounds.x + bounds.width
    && point.y >= bounds.y
    && point.y < bounds.y + bounds.height
}

/** Removes duplicate and collinear cells without changing the path. */
export function compactRoute(route: readonly Point[]): Point[] {
  const points: Point[] = []
  for (const point of route) {
    const previous = points.at(-1)
    if (previous && same(previous, point)) continue
    const before = points.at(-2)
    if (
      before
      && previous
      && ((before.x === previous.x && previous.x === point.x)
        || (before.y === previous.y && previous.y === point.y))
    ) {
      points[points.length - 1] = { ...point }
    } else {
      points.push({ ...point })
    }
  }
  return points
}

function orthogonalRoute(route: readonly Point[]): Point[] {
  const points: Point[] = []
  for (const point of route) {
    const previous = points.at(-1)
    if (previous && previous.x !== point.x && previous.y !== point.y) {
      points.push({ x: point.x, y: previous.y })
    }
    points.push(point)
  }
  return compactRoute(points)
}

function port(to: Point, bounds: Bounds): Point {
  if (to.x < bounds.x) {
    return {
      x: bounds.x - 1,
      y: Math.max(bounds.y + 1, Math.min(bounds.y + bounds.height - 2, to.y)),
    }
  }
  if (to.x >= bounds.x + bounds.width) {
    return {
      x: bounds.x + bounds.width,
      y: Math.max(bounds.y + 1, Math.min(bounds.y + bounds.height - 2, to.y)),
    }
  }
  if (to.y < bounds.y) {
    return {
      x: Math.max(bounds.x + 1, Math.min(bounds.x + bounds.width - 2, to.x)),
      y: bounds.y - 1,
    }
  }
  return {
    x: Math.max(bounds.x + 1, Math.min(bounds.x + bounds.width - 2, to.x)),
    y: bounds.y + bounds.height,
  }
}

/**
 * Clips the shared sheet route out of its displayed endpoint shapes. The first
 * and last cells sit immediately outside those shapes, ready for a port and
 * arrowhead.
 */
export function attachRoute(
  route: readonly Point[],
  source: Bounds,
  target: Bounds,
): Point[] {
  const points = compactRoute(route)
  if (points.length < 2) return []

  let firstOutside = points.findIndex(point => !inside(point, source))
  if (firstOutside < 0) return []
  if (firstOutside === 0 && !inside(points[0]!, source)) {
    firstOutside = 0
  }
  let lastOutside = -1
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (!inside(points[index]!, target)) {
      lastOutside = index
      break
    }
  }
  if (lastOutside < firstOutside) {
    return orthogonalRoute([
      port(points[Math.min(firstOutside, points.length - 1)]!, source),
      port(points[Math.max(lastOutside, 0)]!, target),
    ])
  }

  const clipped = points.slice(firstOutside, lastOutside + 1)
  const firstDirection = clipped[0] ?? points[Math.min(firstOutside, points.length - 1)]!
  const lastDirection = clipped.at(-1) ?? points[Math.max(0, lastOutside)]!
  const start = port(firstDirection, source)
  const end = port(lastDirection, target)
  return orthogonalRoute([start, ...clipped, end])
}

/** A short deterministic fallback when compression collapses a shared route. */
export function routeBetween(source: Bounds, target: Bounds): Point[] {
  const sourceCenter = {
    x: Math.round(source.x + source.width / 2),
    y: Math.round(source.y + source.height / 2),
  }
  const targetCenter = {
    x: Math.round(target.x + target.width / 2),
    y: Math.round(target.y + target.height / 2),
  }
  const horizontal = Math.abs(targetCenter.x - sourceCenter.x)
    >= Math.abs(targetCenter.y - sourceCenter.y)
  const bend = horizontal
    ? { x: targetCenter.x, y: sourceCenter.y }
    : { x: sourceCenter.x, y: targetCenter.y }
  return attachRoute([sourceCenter, bend, targetCenter], source, target)
}
