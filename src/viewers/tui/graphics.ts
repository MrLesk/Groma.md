import { NativeImage } from '@opentui/core'

import type { Bounds, Point } from '../../types.ts'
import type { SheetScene } from '../../sheet/types.ts'
import { projectScene } from '../web/iso/project.ts'

const PX_PER_CELL_X = 8
const PX_PER_CELL_Y = 16
const PAD = 18

type Rgba = readonly [number, number, number, number]

interface HitRegion {
  id: string
  polygon: Point[]
}

export interface GraphicsFrame {
  image: NativeImage
  /** Building polygons in terminal-cell coordinates, used only for optional mouse selection. */
  hits: HitRegion[]
}

const CLEAR: Rgba = [0, 0, 0, 0]
const GROUND: Rgba = [54, 58, 64, 255]
const GROUND_EDGE: Rgba = [110, 117, 128, 255]
const ISLAND: Rgba = [38, 42, 48, 215]
const ZONE: Rgba = [46, 51, 58, 175]
const SLAB_TOP: Rgba = [73, 81, 92, 255]
const SLAB_SIDE: Rgba = [51, 58, 68, 255]
const BUILDING_TOP: Rgba = [116, 150, 171, 255]
const BUILDING_LEFT: Rgba = [72, 104, 124, 255]
const BUILDING_RIGHT: Rgba = [88, 121, 143, 255]
const EXTERNAL_TOP: Rgba = [147, 132, 161, 255]
const EXTERNAL_SIDE: Rgba = [97, 83, 111, 255]
const ROUTE: Rgba = [185, 191, 200, 255]
const SELECTED: Rgba = [239, 203, 111, 255]

function setPixel(pixels: Uint8Array, width: number, height: number, x: number, y: number, color: Rgba): void {
  const ix = Math.round(x)
  const iy = Math.round(y)
  if (ix < 0 || iy < 0 || ix >= width || iy >= height) return
  const offset = (iy * width + ix) * 4
  pixels[offset] = color[0]
  pixels[offset + 1] = color[1]
  pixels[offset + 2] = color[2]
  pixels[offset + 3] = color[3]
}

function line(pixels: Uint8Array, width: number, height: number, a: Point, b: Point, color: Rgba, thickness = 1): void {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))))
  for (let step = 0; step <= steps; step += 1) {
    const x = a.x + dx * step / steps
    const y = a.y + dy * step / steps
    for (let ox = -Math.floor(thickness / 2); ox <= Math.floor(thickness / 2); ox += 1) {
      for (let oy = -Math.floor(thickness / 2); oy <= Math.floor(thickness / 2); oy += 1) {
        setPixel(pixels, width, height, x + ox, y + oy, color)
      }
    }
  }
}

function inside(point: Point, polygon: readonly Point[]): boolean {
  let hit = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]!
    const b = polygon[j]!
    const crosses = (a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y || Number.EPSILON) + a.x
    if (crosses) hit = !hit
  }
  return hit
}

function polygon(pixels: Uint8Array, width: number, height: number, points: readonly Point[], fill: Rgba, stroke: Rgba = GROUND_EDGE): void {
  if (points.length < 3) return
  const minX = Math.max(0, Math.floor(Math.min(...points.map(point => point.x))))
  const maxX = Math.min(width - 1, Math.ceil(Math.max(...points.map(point => point.x))))
  const minY = Math.max(0, Math.floor(Math.min(...points.map(point => point.y))))
  const maxY = Math.min(height - 1, Math.ceil(Math.max(...points.map(point => point.y))))
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (inside({ x: x + 0.5, y: y + 0.5 }, points)) setPixel(pixels, width, height, x, y, fill)
    }
  }
  for (let index = 0; index < points.length; index += 1) {
    line(pixels, width, height, points[index]!, points[(index + 1) % points.length]!, stroke)
  }
}

function clear(pixels: Uint8Array): void {
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = CLEAR[0]
    pixels[offset + 1] = CLEAR[1]
    pixels[offset + 2] = CLEAR[2]
    pixels[offset + 3] = CLEAR[3]
  }
}

function fit(bounds: Bounds, width: number, height: number): { point(value: Point): Point; scale: number } {
  const availableWidth = Math.max(1, width - PAD * 2)
  const availableHeight = Math.max(1, height - PAD * 2)
  const scale = Math.min(availableWidth / Math.max(1, bounds.width), availableHeight / Math.max(1, bounds.height))
  const drawnWidth = bounds.width * scale
  const drawnHeight = bounds.height * scale
  const ox = (width - drawnWidth) / 2 - bounds.x * scale
  const oy = (height - drawnHeight) / 2 - bounds.y * scale
  return {
    scale,
    point(value) {
      return { x: value.x * scale + ox, y: value.y * scale + oy }
    },
  }
}

/**
 * Paint the same composed SheetScene as the web isometric viewer into pixels.
 * This intentionally stays renderer-only: architecture meaning, selection and keyboard navigation remain in the existing TUI.
 */
export function renderGraphicsFrame(
  scene: SheetScene,
  selectedId: string | undefined,
  viewport: Bounds,
): GraphicsFrame {
  const projected = projectScene(scene)
  const width = Math.max(64, viewport.width * PX_PER_CELL_X)
  const height = Math.max(64, viewport.height * PX_PER_CELL_Y)
  const pixels = new Uint8Array(width * height * 4)
  clear(pixels)
  const transform = fit(projected.bounds, width, height)
  const points = (values: readonly Point[]) => values.map(transform.point)

  if (projected.frame.length >= 3) polygon(pixels, width, height, points(projected.frame), GROUND, GROUND_EDGE)
  for (const item of projected.islands) polygon(pixels, width, height, points(item.polygon), ISLAND)
  for (const item of projected.zones) polygon(pixels, width, height, points(item.polygon), ZONE)

  for (const item of projected.slabs) {
    for (const face of item.faces) {
      polygon(pixels, width, height, points(face.points), face.side === 'top' ? SLAB_TOP : SLAB_SIDE)
    }
  }

  for (const route of projected.routes) {
    const routePoints = points(route.points)
    for (let index = 1; index < routePoints.length; index += 1) {
      line(pixels, width, height, routePoints[index - 1]!, routePoints[index]!, ROUTE, 2)
    }
  }

  const hits: HitRegion[] = []
  for (const item of projected.buildings) {
    const external = item.building.external
    for (const floor of item.floors) {
      for (const face of floor) {
        const facePoints = points(face.points)
        const fill = external
          ? (face.side === 'top' ? EXTERNAL_TOP : EXTERNAL_SIDE)
          : face.side === 'top' ? BUILDING_TOP : face.side === 'left' ? BUILDING_LEFT : BUILDING_RIGHT
        polygon(pixels, width, height, facePoints, fill)
      }
    }
    const all = item.floors.flatMap(floor => floor.flatMap(face => points(face.points)))
    if (all.length > 0) {
      const bounds = {
        x: Math.min(...all.map(point => point.x)),
        y: Math.min(...all.map(point => point.y)),
        width: Math.max(...all.map(point => point.x)) - Math.min(...all.map(point => point.x)),
        height: Math.max(...all.map(point => point.y)) - Math.min(...all.map(point => point.y)),
      }
      hits.push({
        id: item.building.representationId,
        polygon: [
          { x: bounds.x / PX_PER_CELL_X, y: bounds.y / PX_PER_CELL_Y },
          { x: (bounds.x + bounds.width) / PX_PER_CELL_X, y: bounds.y / PX_PER_CELL_Y },
          { x: (bounds.x + bounds.width) / PX_PER_CELL_X, y: (bounds.y + bounds.height) / PX_PER_CELL_Y },
          { x: bounds.x / PX_PER_CELL_X, y: (bounds.y + bounds.height) / PX_PER_CELL_Y },
        ],
      })
      if (item.building.representationId === selectedId) {
        const outline = [
          { x: bounds.x - 4, y: bounds.y - 4 },
          { x: bounds.x + bounds.width + 4, y: bounds.y - 4 },
          { x: bounds.x + bounds.width + 4, y: bounds.y + bounds.height + 4 },
          { x: bounds.x - 4, y: bounds.y + bounds.height + 4 },
        ]
        for (let index = 0; index < outline.length; index += 1) {
          line(pixels, width, height, outline[index]!, outline[(index + 1) % outline.length]!, SELECTED, 2)
        }
      }
    }
  }

  return { image: NativeImage.fromRgba(pixels, width, height), hits }
}

export function graphicsItemAt(frame: GraphicsFrame | undefined, x: number, y: number): string | undefined {
  if (frame === undefined) return undefined
  const point = { x, y }
  return [...frame.hits].reverse().find(hit => inside(point, hit.polygon))?.id
}
