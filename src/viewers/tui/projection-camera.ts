import type { Bounds, Point } from '../../types.ts'

export interface TerminalCamera {
  /** Top-left world cell shown in the map viewport. */
  x: number
  y: number
}

/** True when the inner bounds lie entirely inside the outer ones. */
export function encloses(outer: Bounds, inner: Bounds): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height
}

export function projectPoint(
  point: Point,
  camera: TerminalCamera,
  viewport: Bounds,
): Point {
  return {
    x: viewport.x + point.x - camera.x,
    y: viewport.y + point.y - camera.y,
  }
}

export function projectBounds(
  bounds: Bounds,
  camera: TerminalCamera,
  viewport: Bounds,
): Bounds {
  const point = projectPoint(bounds, camera, viewport)
  return { ...bounds, ...point }
}

/** True when any segment of an orthogonal route crosses the viewport. */
export function routeTouches(route: readonly Point[], viewport: Bounds): boolean {
  return route.some((point, index) => {
    if (index === 0) return false
    const previous = route[index - 1]!
    const x = Math.min(previous.x, point.x)
    const y = Math.min(previous.y, point.y)
    return visibleIn({
      x,
      y,
      width: Math.abs(point.x - previous.x) + 1,
      height: Math.abs(point.y - previous.y) + 1,
    }, viewport)
  })
}

export function visibleIn(bounds: Bounds, viewport: Bounds): boolean {
  return bounds.x < viewport.x + viewport.width
    && bounds.x + bounds.width > viewport.x
    && bounds.y < viewport.y + viewport.height
    && bounds.y + bounds.height > viewport.y
}
