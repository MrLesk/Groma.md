import type { Bounds, Point } from '../../types.ts'

function same(left: Point, right: Point): boolean {
  return left.x === right.x && left.y === right.y
}

function inside(point: Point, bounds: Bounds): boolean {
  return point.x >= bounds.x
    && point.x < bounds.x + bounds.width
    && point.y >= bounds.y
    && point.y < bounds.y + bounds.height
}

/** Removes duplicate and collinear cells without changing the path. */
function compactRoute(route: readonly Point[]): Point[] {
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

/** The cell just outside a shape on the side facing `to`; framed shapes keep their corners free, a one-line row keeps its line. */
function port(to: Point, bounds: Bounds): Point {
  const inset = bounds.height > 2 ? 1 : 0
  const y = Math.max(bounds.y + inset, Math.min(bounds.y + bounds.height - 1 - inset, to.y))
  const x = Math.max(bounds.x + inset, Math.min(bounds.x + bounds.width - 1 - inset, to.x))
  if (to.x < bounds.x) return { x: bounds.x - 1, y }
  if (to.x >= bounds.x + bounds.width) return { x: bounds.x + bounds.width, y }
  if (to.y < bounds.y) return { x, y: bounds.y - 1 }
  return { x, y: bounds.y + bounds.height }
}

/**
 * Clips a path out of the shapes it joins: the first and last cells sit immediately
 * outside them, ready for a port and an arrowhead.
 */
export function attachRoute(
  route: readonly Point[],
  source: Bounds,
  target: Bounds,
): Point[] {
  const points = compactRoute(route)
  if (points.length < 2) return []

  const firstOutside = points.findIndex(point => !inside(point, source))
  if (firstOutside < 0) return []
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
