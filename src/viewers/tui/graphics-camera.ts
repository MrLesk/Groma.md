import type { Bounds, Point } from '../../types.ts'

export interface PixelSize { width: number; height: number }
export interface GraphicsCamera { center: Point; scale: number }

/** Limit raster work independently of terminal size while preserving the measured cell aspect. */
export function rasterSize(columns: number, rows: number, cellWidth = 8, cellHeight = 16): PixelSize {
  const width = Math.max(1, columns * cellWidth)
  const height = Math.max(1, rows * cellHeight)
  const ratio = Math.min(1, 1600 / width, 1000 / height, Math.sqrt(1_200_000 / (width * height)))
  return { width: Math.max(1, Math.floor(width * ratio)), height: Math.max(1, Math.floor(height * ratio)) }
}

export function fitGraphics(bounds: Bounds, size: PixelSize): GraphicsCamera {
  return {
    center: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
    scale: Math.max(0.000001, Math.min(
      Math.max(1, size.width - 32) / Math.max(1, bounds.width),
      Math.max(1, size.height - 32) / Math.max(1, bounds.height),
    )),
  }
}

export function toGraphicsWorld(point: Point, camera: GraphicsCamera, size: PixelSize): Point {
  return {
    x: camera.center.x + (point.x - size.width / 2) / camera.scale,
    y: camera.center.y + (point.y - size.height / 2) / camera.scale,
  }
}

export function toGraphicsPixel(point: Point, camera: GraphicsCamera, size: PixelSize): Point {
  return {
    x: (point.x - camera.center.x) * camera.scale + size.width / 2,
    y: (point.y - camera.center.y) * camera.scale + size.height / 2,
  }
}

/** A positive delta moves the camera right/down, not the architecture. */
export function panGraphics(camera: GraphicsCamera, dx: number, dy: number): GraphicsCamera {
  return { ...camera, center: { x: camera.center.x + dx / camera.scale, y: camera.center.y + dy / camera.scale } }
}

export function zoomGraphics(camera: GraphicsCamera, factor: number, size: PixelSize, fitScale: number, anchor?: Point): GraphicsCamera {
  const point = anchor ?? { x: size.width / 2, y: size.height / 2 }
  const world = toGraphicsWorld(point, camera, size)
  const scale = Math.max(fitScale / 4, Math.min(fitScale * 128, camera.scale * factor))
  return { scale, center: { x: world.x - (point.x - size.width / 2) / scale, y: world.y - (point.y - size.height / 2) / scale } }
}

/** Follow keyboard selection only when necessary; manual pan survives unrelated repaints. */
export function revealGraphics(camera: GraphicsCamera, bounds: Bounds, size: PixelSize): GraphicsCamera {
  const first = toGraphicsPixel(bounds, camera, size)
  const last = toGraphicsPixel({ x: bounds.x + bounds.width, y: bounds.y + bounds.height }, camera, size)
  const axis = (start: number, end: number, available: number): number => {
    if (end - start > available - 32) return (start + end - available) / 2
    if (start < 16) return start - 16
    if (end > available - 16) return end - available + 16
    return 0
  }
  return panGraphics(camera, axis(first.x, last.x, size.width), axis(first.y, last.y, size.height))
}

/** Polygon edges count as a hit; a rectangle around an isometric face does not. */
export function insideGraphics(point: Point, polygon: readonly Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!
    const b = polygon[j]!
    const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x)
    if (Math.abs(cross) < 1e-7 && point.x >= Math.min(a.x, b.x) && point.x <= Math.max(a.x, b.x)
      && point.y >= Math.min(a.y, b.y) && point.y <= Math.max(a.y, b.y)) return true
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}
