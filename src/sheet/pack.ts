import { EMPTY, GAP, PAD } from './grid.ts'

export interface ShelfItem {
  key: string
  w: number
  d: number
}

export interface Shelf {
  w: number
  d: number
  /** Each item's north corner relative to the parent's north corner. */
  at: Map<string, { gx: number; gy: number }>
}

/**
 * Shelf packing: items keep their order and fill rows of `cols` left to right,
 * GAP cells apart, PAD cells inside the parent's edge. Adding one item moves only
 * the items after it, and only the parent's size grows.
 */
export function shelf(
  items: readonly ShelfItem[],
  cols = Math.ceil(Math.sqrt(items.length)),
): Shelf {
  const at = new Map<string, { gx: number; gy: number }>()
  if (items.length === 0) return { w: EMPTY, d: EMPTY, at }
  let gy = PAD
  let widest = 0
  for (let start = 0; start < items.length; start += cols) {
    let gx = PAD
    let depth = 0
    for (const item of items.slice(start, start + cols)) {
      at.set(item.key, { gx, gy })
      gx += item.w + GAP
      depth = Math.max(depth, item.d)
    }
    widest = Math.max(widest, gx - GAP)
    gy += depth + GAP
  }
  return { w: widest + PAD, d: gy - GAP + PAD, at }
}
