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
function attachRoute(
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

/** Join facing sides or the containing boundary, using clear channels around foreign cards. */
export function routeBetween(source: Bounds, target: Bounds, obstacles: readonly Bounds[] = []): Point[] {
  const sourceCenter = {
    x: Math.floor(source.x + source.width / 2),
    y: Math.floor(source.y + source.height / 2),
  }
  const targetCenter = {
    x: Math.floor(target.x + target.width / 2),
    y: Math.floor(target.y + target.height / 2),
  }
  const horizontal = Math.abs(targetCenter.x - sourceCenter.x)
    >= Math.abs(targetCenter.y - sourceCenter.y)
  const bend = horizontal
    ? { x: targetCenter.x, y: sourceCenter.y }
    : { x: sourceCenter.x, y: targetCenter.y }
  const direct = sideRoute(source, target) ?? attachRoute([sourceCenter, bend, targetCenter], source, target)
  const blocked = [...obstacles, ...[source, target].filter(box => !inside(sourceCenter, box) || !inside(targetCenter, box))]
  if (direct.length < 2 || clearPath(direct, blocked)) return direct
  return avoidCards(direct[0]!, direct.at(-1)!, blocked)
}

/** Disjoint cards and root rows join from facing sides, never through their text. */
function sideRoute(source: Bounds, target: Bounds): Point[] | undefined {
  if (source.x >= target.x + target.width) return sideRoute(target, source)?.reverse()
  const centerY = (box: Bounds): number => box.y + Math.floor((box.height - 1) / 2)
  if (target.x >= source.x + source.width) {
    const start = { x: source.x + source.width, y: centerY(source) }
    const end = { x: target.x - 1, y: centerY(target) }
    const x = Math.floor((start.x + end.x) / 2)
    return compactRoute([start, { x, y: start.y }, { x, y: end.y }, end])
  }
  if (target.y < source.y) return sideRoute(target, source)?.reverse()
  if (target.y < source.y + source.height) return undefined
  const start = { x: source.x + Math.floor(source.width / 2), y: source.y + source.height }
  const end = { x: target.x + Math.floor(target.width / 2), y: target.y - 1 }
  const y = Math.floor((start.y + end.y) / 2)
  return compactRoute([start, { x: start.x, y }, { x: end.x, y }, end])
}

function clearSegment(from: Point, to: Point, obstacles: readonly Bounds[]): boolean {
  const left = Math.min(from.x, to.x)
  const right = Math.max(from.x, to.x)
  const top = Math.min(from.y, to.y)
  const bottom = Math.max(from.y, to.y)
  return !obstacles.some(box => right >= box.x && left < box.x + box.width
    && bottom >= box.y && top < box.y + box.height)
}

function clearPath(points: readonly Point[], obstacles: readonly Bounds[]): boolean {
  return points.slice(1).every((point, index) => clearSegment(points[index]!, point, obstacles))
}

/** Search the empty channels immediately outside card edges for the shortest orthogonal path. */
function avoidCards(start: Point, end: Point, obstacles: readonly Bounds[]): Point[] {
  const xs = [...new Set([start.x, end.x, ...obstacles.flatMap(box => [box.x - 1, box.x + box.width])])].sort((a, b) => a - b)
  const ys = [...new Set([start.y, end.y, ...obstacles.flatMap(box => [box.y - 1, box.y + box.height])])].sort((a, b) => a - b)
  const key = (x: number, y: number): number => y * xs.length + x
  const first = key(xs.indexOf(start.x), ys.indexOf(start.y))
  const last = key(xs.indexOf(end.x), ys.indexOf(end.y))
  const point = (id: number): Point => ({ x: xs[id % xs.length]!, y: ys[Math.floor(id / xs.length)]! })
  const distance = new Map([[first, 0]])
  const previous = new Map<number, number>()
  const queue = [first]
  while (queue.length > 0) {
    queue.sort((a, b) => distance.get(b)! - distance.get(a)!)
    const current = queue.pop()!
    if (current === last) return reconstruct(last, previous, point)
    const x = current % xs.length
    const y = Math.floor(current / xs.length)
    const neighbours = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
      .filter(([nx, ny]) => nx! >= 0 && nx! < xs.length && ny! >= 0 && ny! < ys.length)
      .map(([nx, ny]) => key(nx!, ny!))
    for (const next of neighbours) {
      if (!clearSegment(point(current), point(next), obstacles)) continue
      const from = point(current)
      const to = point(next)
      const cost = distance.get(current)! + Math.abs(to.x - from.x) + Math.abs(to.y - from.y)
      if (cost >= (distance.get(next) ?? Infinity)) continue
      if (!distance.has(next)) queue.push(next)
      distance.set(next, cost)
      previous.set(next, current)
    }
  }
  return []
}

function reconstruct(last: number, previous: ReadonlyMap<number, number>, point: (id: number) => Point): Point[] {
  const path: Point[] = []
  let current: number | undefined = last
  while (current !== undefined) {
    path.push(point(current))
    current = previous.get(current)
  }
  return compactRoute(path.reverse())
}
