import type { Bounds, Point } from '../../types.ts'
import {
  clamp,
  projectPoint,
  type Transform,
} from './projection-camera.ts'

function insideSpan(value: number, start: number, size: number): number {
  if (size <= 2) return Math.round(start + (size - 1) / 2)
  return clamp(value, start + 1, start + size - 2)
}

export function orthogonalRoute(route: Point[]): Point[] {
  const points: Point[] = []
  function add(point: Point): void {
    const previous = points.at(-1)
    if (!previous || previous.x !== point.x || previous.y !== point.y) {
      points.push(point)
    }
  }

  for (const [index, point] of route.entries()) {
    if (index > 0) {
      const previous = route[index - 1]
      if (previous.x !== point.x && previous.y !== point.y) {
        add({ x: point.x, y: previous.y })
      }
    }
    add({ ...point })
  }
  return points
}

export function pointInside(point: Point, bounds: Bounds): boolean {
  return point.x >= bounds.x
    && point.x < bounds.x + bounds.width
    && point.y >= bounds.y
    && point.y < bounds.y + bounds.height
}

export function trimRouteToDisplayedEndpoints(
  route: Point[],
  source: Bounds,
  target: Bounds,
): Point[] {
  if (route.length <= 2) return route
  const sourceCenter = {
    x: source.x + source.width / 2,
    y: source.y + source.height / 2,
  }
  const targetCenter = {
    x: target.x + target.width / 2,
    y: target.y + target.height / 2,
  }
  const horizontal = Math.abs(targetCenter.x - sourceCenter.x)
    >= Math.abs(targetCenter.y - sourceCenter.y)
  const minimum = horizontal
    ? sourceCenter.x <= targetCenter.x
      ? source.x + source.width
      : target.x + target.width
    : sourceCenter.y <= targetCenter.y
      ? source.y + source.height
      : target.y + target.height
  const maximum = horizontal
    ? sourceCenter.x <= targetCenter.x
      ? target.x - 1
      : source.x - 1
    : sourceCenter.y <= targetCenter.y
      ? target.y - 1
      : source.y - 1
  const intermediates = route.slice(1, -1).filter(point => {
    const coordinate = horizontal ? point.x : point.y
    return coordinate >= minimum
      && coordinate <= maximum
      && !pointInside(point, source)
      && !pointInside(point, target)
  })
  return [route[0]!, ...intermediates, route.at(-1)!]
}

export function attachRouteToBounds(route: Point[], source: Bounds, target: Bounds): Point[] {
  if (route.length < 2) return route
  const attached = route.map(point => ({ ...point }))
  const first = attached[0]!
  const second = attached[1]!
  if (second.x > first.x) {
    first.x = source.x + source.width
    first.y = insideSpan(first.y, source.y, source.height)
  } else if (second.x < first.x) {
    first.x = source.x - 1
    first.y = insideSpan(first.y, source.y, source.height)
  } else if (second.y > first.y) {
    first.y = source.y + source.height
    first.x = insideSpan(first.x, source.x, source.width)
  } else {
    first.y = source.y - 1
    first.x = insideSpan(first.x, source.x, source.width)
  }

  const last = attached.at(-1)!
  const previous = attached.at(-2)!
  if (last.x > previous.x) {
    last.x = target.x - 1
    last.y = insideSpan(last.y, target.y, target.height)
  } else if (last.x < previous.x) {
    last.x = target.x + target.width
    last.y = insideSpan(last.y, target.y, target.height)
  } else if (last.y > previous.y) {
    last.y = target.y - 1
    last.x = insideSpan(last.x, target.x, target.width)
  } else {
    last.y = target.y + target.height
    last.x = insideSpan(last.x, target.x, target.width)
  }
  return attached
}

export function projectLabel(
  label: Bounds,
  transform: Transform,
): Pick<Bounds, 'x' | 'y' | 'width'> {
  const topLeft = projectPoint(label, transform)
  const bottomRight = projectPoint({
    x: label.x + label.width,
    y: label.y + label.height,
  }, transform)
  const width = Math.max(10, bottomRight.x - topLeft.x)
  const center = (topLeft.x + bottomRight.x) / 2
  return {
    x: Math.round(center - width / 2),
    y: topLeft.y,
    width,
  }
}

export function boundsOverlap(left: Bounds, right: Bounds): boolean {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y
}

function labelHits(
  label: Pick<Bounds, 'x' | 'y' | 'width'>,
  obstacles: Bounds[],
): boolean {
  const box = {
    x: label.x - 1,
    y: label.y,
    width: label.width + 2,
    height: 1,
  }
  return obstacles.some(obstacle => boundsOverlap(box, obstacle))
}

export function compactRouteLabel(
  route: Point[],
  description: string,
  preferred: Pick<Bounds, 'x' | 'y' | 'width'>,
  obstacles: Bounds[],
): Pick<Bounds, 'x' | 'y' | 'width'> {
  const width = description.split(' ', 1)[0].length
  const blocked = [
    ...obstacles,
    ...[route[0], route.at(-1)].flatMap(point => {
      return point === undefined ? [] : [{ x: point.x, y: point.y, width: 1, height: 1 }]
    }),
  ]
  const candidates: Array<Pick<Bounds, 'x' | 'y' | 'width'> & { distance: number }> = []
  function consider(label: Pick<Bounds, 'x' | 'y' | 'width'>, distance: number): void {
    const placed = { ...label, width }
    if (!labelHits(placed, blocked)) {
      candidates.push({ ...placed, distance })
    }
  }

  for (let index = 1; index < route.length; index += 1) {
    const from = route[index - 1]
    const to = route[index]
    if (from.x === to.x) continue
    const left = Math.min(from.x, to.x) + 1
    const right = Math.max(from.x, to.x) - 1
    if (right - left + 1 < width) continue
    consider(
      {
        x: Math.round((left + right - width + 1) / 2),
        y: from.y,
        width,
      },
      Math.abs((left + right) / 2 - (preferred.x + preferred.width / 2)),
    )
  }
  consider(preferred, 0)
  for (const point of route) {
    for (const dy of [-1, 1, 0, -2, 2]) {
      consider({ x: point.x, y: point.y + dy, width }, 20 + Math.abs(dy))
    }
  }
  candidates.sort((left, right) => left.distance - right.distance)
  if (candidates[0]) {
    return {
      x: candidates[0].x,
      y: candidates[0].y,
      width: candidates[0].width,
    }
  }
  return { x: preferred.x, y: preferred.y, width }
}
