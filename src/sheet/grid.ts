import { CORRIDOR, GAP } from './forces.ts'
import type { CellRect } from './types.ts'

/** Lanes per cell: routes travel at 0, ¼, ½ and ¾ of a cell. */
export const LANES = 4
/** Cells between a child and its parent's edge; the front band holds the parent's name. */
export const PAD = 1
/**
 * Cells of ground one floor hides behind a building. A floor lifts the roof
 * 12 px and a cell drops 24 px on screen, so the roof covers half a cell
 * north and half a cell west per floor, together.
 */
export const ROOF_SHADOW = 0.5
/**
 * Extra cells a building claims on its north and west, where its roof hides
 * the ground. Its neighbours there stand that much further away, so the
 * corridor between them still shows CORRIDOR cells; its south and east
 * neighbours are unaffected, because nothing hides that ground.
 */
export function shadeOf(floors: number): number {
  /** Never negative: a wider GAP already clears the roof, and a building must not claim less than its footprint. */
  return Math.max(0, Math.ceil(floors * ROOF_SHADOW + CORRIDOR - GAP))
}
/** Cells of sheet around the islands; the compass rose lives in a corner of this band. */
export const MARGIN = 4
/** Side of an empty slab or empty island. */
export const EMPTY = 4

export function translate(rect: CellRect, dx: number, dy: number): CellRect {
  return { gx: rect.gx + dx, gy: rect.gy + dy, w: rect.w, d: rect.d }
}

export function contains(outer: CellRect, inner: CellRect): boolean {
  return inner.gx >= outer.gx
    && inner.gy >= outer.gy
    && inner.gx + inner.w <= outer.gx + outer.w
    && inner.gy + inner.d <= outer.gy + outer.d
}

export function overlaps(a: CellRect, b: CellRect): boolean {
  return a.gx < b.gx + b.w && b.gx < a.gx + a.w && a.gy < b.gy + b.d && b.gy < a.gy + a.d
}

export function unionRects(rects: readonly CellRect[]): CellRect | null {
  if (rects.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const rect of rects) {
    minX = Math.min(minX, rect.gx)
    minY = Math.min(minY, rect.gy)
    maxX = Math.max(maxX, rect.gx + rect.w)
    maxY = Math.max(maxY, rect.gy + rect.d)
  }
  return { gx: minX, gy: minY, w: maxX - minX, d: maxY - minY }
}
