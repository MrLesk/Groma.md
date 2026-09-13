import type { CellRect } from './types.ts'

/** Base cells inside a packed parent; surface labels use the same compact edge inset. */
export const PAD = 1
/**
 * Cells of ground one height unit hides behind a building. One unit lifts the roof
 * 12 px and a cell drops 24 px on screen, so the roof covers half a cell
 * north and half a cell west per floor, together.
 */
export const ROOF_SHADOW = 0.5
/**
 * The full roof shadow is part of a building's packing envelope. Connection
 * space is reserved outside that envelope, never borrowed from its shadow.
 */
export function shadeOf(heightUnits: number): number {
  return Math.ceil(heightUnits * ROOF_SHADOW)
}
/** Cells of sheet around the islands; the compass rose lives in a corner of this band. */
export const MARGIN = 4
/** Side of an empty slab or empty island. */
export const EMPTY = 4

export function translate(rect: CellRect, dx: number, dy: number): CellRect {
  return { gx: rect.gx + dx, gy: rect.gy + dy, w: rect.w, d: rect.d }
}

/** Centres a footprint on the same vertical axis as its complete building envelope. */
export function centredRect(
  envelope: CellRect,
  footprint: Pick<CellRect, 'w' | 'd'>,
): CellRect {
  return {
    gx: envelope.gx + (envelope.w - footprint.w) / 2,
    gy: envelope.gy + (envelope.d - footprint.d) / 2,
    ...footprint,
  }
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
