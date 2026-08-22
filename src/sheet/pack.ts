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

export interface RankedItem extends ShelfItem {
  /** Flow rank, absent when no relationship touches the item or anything inside it. */
  rank?: number
  /** Sibling keys the item has relationships with, each with the number of relationships. */
  partners: ReadonlyMap<string, number>
}

/**
 * Flow columns: ranked items form columns from west to east by rank, GAP
 * apart and PAD inside; unranked items are shelf-packed as one block after
 * them, so a world without relationships keeps the shelf. Within a column,
 * items follow the average position of their partners in earlier columns and
 * line up with it when that space is free, else stack below the item before
 * them; then, from east to west, an item without earlier partners centres on
 * its several partners in the next column when that space is free.
 */
export function columns(items: readonly RankedItem[]): Shelf {
  const ranked = items.filter(item => item.rank !== undefined)
  if (ranked.length === 0) return shelf(items)
  const levels = [...new Set(ranked.map(item => item.rank!))]
    .sort((a, b) => a - b)
    .map(level => ranked.filter(item => item.rank === level))
  const rest = items.filter(item => item.rank === undefined)
  const at = new Map<string, { gx: number; gy: number }>()
  const depth = new Map(items.map(item => [item.key, item.d]))
  const centre = (key: string): number => at.get(key)!.gy + depth.get(key)! / 2
  /** Where each item's partners in earlier columns sit on gy, weighted by their relationships; undefined without any. */
  const wanted = new Map<string, number | undefined>()
  const upstream = (item: RankedItem, earlier: ReadonlySet<string>): number | undefined => {
    let weight = 0
    let sum = 0
    for (const [key, count] of item.partners) {
      if (!earlier.has(key)) continue
      weight += count
      sum += count * centre(key)
    }
    return weight === 0 ? undefined : sum / weight
  }
  const clear = (item: RankedItem, gy: number, column: readonly RankedItem[]): boolean => gy >= PAD
    && column.every(other => other === item
      || gy + item.d + GAP <= at.get(other.key)!.gy
      || at.get(other.key)!.gy + other.d + GAP <= gy)

  const earlier = new Set<string>()
  let gx = PAD
  for (const column of levels) {
    for (const item of column) wanted.set(item.key, upstream(item, earlier))
    const orderOf = (item: RankedItem): number => wanted.get(item.key) ?? Number.MAX_SAFE_INTEGER
    let bottom = PAD - GAP
    for (const item of [...column].sort((a, b) => orderOf(a) - orderOf(b))) {
      const middle = wanted.get(item.key)
      const gy = Math.max(middle === undefined ? 0 : Math.round(middle - item.d / 2), bottom + GAP)
      at.set(item.key, { gx, gy })
      bottom = gy + item.d
    }
    for (const item of column) earlier.add(item.key)
    gx += Math.max(...column.map(item => item.w)) + GAP
  }
  if (rest.length > 0) {
    const block = shelf(rest)
    for (const item of rest) {
      const { gx: bx, gy: by } = block.at.get(item.key)!
      at.set(item.key, { gx: gx + bx - PAD, gy: by })
    }
    gx += block.w - 2 * PAD + GAP
  }
  for (let index = levels.length - 2; index >= 0; index -= 1) {
    const column = levels[index]!
    const next = levels[index + 1]!
    for (const item of column) {
      if (wanted.get(item.key) !== undefined) continue
      const targets = next.filter(other => item.partners.has(other.key))
      if (targets.length < 2) continue
      const middle = targets.reduce((sum, other) => sum + centre(other.key), 0) / targets.length
      const gy = Math.round(middle - item.d / 2)
      if (clear(item, gy, column)) at.set(item.key, { gx: at.get(item.key)!.gx, gy })
    }
  }
  const bottom = Math.max(...items.map(item => at.get(item.key)!.gy + item.d))
  return { w: gx - GAP + PAD, d: bottom + PAD, at }
}
