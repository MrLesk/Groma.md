import type { CellRect } from './types.ts'

/** Lanes per cell: routes travel at 0, ¼, ½ and ¾ of a cell. */
export const LANES = 4
/** Cells between siblings in one shelf; leaves five free lanes in every corridor. */
export const GAP = 2
/** Cells between a child and its parent's edge; the front band holds the parent's name. */
export const PAD = 1
/** Cells of screen width between islands. */
export const ISLAND_GAP = 3
/** Cells of sheet around the islands. */
export const MARGIN = 3
/** Side of an empty slab or empty island. */
export const EMPTY = 4
/** Floors a container slab rises above its island. */
export const SLAB_RISE = 0.5

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
