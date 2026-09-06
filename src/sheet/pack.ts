import { FOLD_ASPECT, GAP } from './forces.ts'
import { EMPTY, PAD, unionRects } from './grid.ts'
import { PackingPaths } from './pack-paths.ts'
import type { CellRect } from './types.ts'

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

export interface Partnered extends ShelfItem {
  /** True when something outside the surface feeds the item; entries stand in the west column. */
  entry: boolean
  /** Sibling keys the item has relationships with, each with the number of relationships. */
  partners: ReadonlyMap<string, number>
}

interface Partner {
  rect: CellRect
  count: number
}

const centre = (rect: CellRect): { x: number; y: number } => ({ x: rect.gx + rect.w / 2, y: rect.gy + rect.d / 2 })
const longer = (rect: CellRect): number => Math.max(rect.w, rect.d)
/** The spots a child may take: beside each placed partner, centred on it, then beside everything placed so far, centred on the partners' weighted centre. */
function spots(item: ShelfItem, partners: readonly Partner[], all: CellRect): { gx: number; gy: number }[] {
  const beside = (rect: CellRect, on: { x: number; y: number }) => [
    { gx: rect.gx + rect.w + GAP, gy: Math.round(on.y - item.d / 2) },
    { gx: Math.round(on.x - item.w / 2), gy: rect.gy - GAP - item.d },
    { gx: Math.round(on.x - item.w / 2), gy: rect.gy + rect.d + GAP },
    { gx: rect.gx - GAP - item.w, gy: Math.round(on.y - item.d / 2) },
  ]
  const weight = partners.reduce((sum, partner) => sum + partner.count, 0)
  const middle = {
    x: partners.reduce((sum, partner) => sum + partner.count * centre(partner.rect).x, 0) / weight,
    y: partners.reduce((sum, partner) => sum + partner.count * centre(partner.rect).y, 0) / weight,
  }
  return [...partners.flatMap(partner => beside(partner.rect, centre(partner.rect))), ...beside(all, middle)]
}

const weightOf = (item: Partnered): number => [...item.partners.values()].reduce((sum, count) => sum + count, 0)

interface PackingState {
  rects: Map<string, CellRect>
  paths: PackingPaths
  westEdge: number
}

function eastOfAll(rects: ReadonlyMap<string, CellRect>): { gx: number; gy: number } {
  const all = unionRects([...rects.values()])
  return all === null ? { gx: PAD, gy: PAD } : { gx: all.gx + all.w + GAP, gy: all.gy }
}

function chooseSpot(item: Partnered, state: PackingState): { gx: number; gy: number } {
  const partners: Partner[] = [...item.partners]
    .filter(([key]) => state.rects.has(key))
    .map(([key, count]) => ({ rect: state.rects.get(key)!, count }))
  let best = eastOfAll(state.rects)
  if (partners.length === 0) return best
  const all = unionRects([...state.rects.values()])!
  let bestCost = Infinity
  for (const spot of spots(item, partners, all)) {
    const rect = { gx: Math.max(spot.gx, state.westEdge), gy: spot.gy, w: item.w, d: item.d }
    if (!state.paths.apart(rect)) continue
    const growth = longer(unionRects([all, rect])!) - longer(all)
    const cost = partners.reduce((sum, partner) => sum + partner.count * state.paths.arrowCost(rect, partner.rect), growth)
      + state.paths.placementCost(rect)
    if (cost < bestCost) {
      best = { gx: rect.gx, gy: rect.gy }
      bestCost = cost
    }
  }
  return best
}

function placeConnected(connected: Partnered[], state: PackingState): void {
  while (connected.length > 0) {
    const index = connected.findIndex(item => [...item.partners.keys()].some(key => state.rects.has(key)))
    const [item] = connected.splice(Math.max(0, index), 1) as [Partnered]
    const rect = { ...chooseSpot(item, state), w: item.w, d: item.d }
    state.rects.set(item.key, rect)
    state.paths.add(item.key, rect, state.rects)
  }
}

function placeLoose(loose: readonly Partnered[], rects: Map<string, CellRect>): void {
  if (loose.length === 0) return
  const block = shelf(loose)
  const start = eastOfAll(rects)
  for (const item of loose) {
    const { gx, gy } = block.at.get(item.key)!
    rects.set(item.key, { gx: start.gx + gx - PAD, gy: start.gy + gy - PAD, w: item.w, d: item.d })
  }
}

/**
 * Growth placement. The entries (what the outside feeds) stand in a west
 * column, folded into a square-ish block when that column is over
 * FOLD_ASPECT times deeper than wide. Then every other connected child, the
 * heaviest first, takes the cheapest legal spot beside its placed partners
 * or beside everything placed so far; a child none of whose partners stands
 * yet starts east of everything. The children no relationship touches are
 * shelf-packed as one block last, so a world without relationships keeps
 * the shelf. Ties keep the first candidate, so the same items always give
 * the same placement.
 */
export function grow(items: readonly Partnered[]): Shelf {
  const entries = items.filter(item => item.entry)
  const weights = new Map(items.map(item => [item.key, weightOf(item)]))
  const connected = items.filter(item => !item.entry && item.partners.size > 0)
    .sort((a, b) => weights.get(b.key)! - weights.get(a.key)!)
  const loose = items.filter(item => !item.entry && item.partners.size === 0)
  if (entries.length + connected.length === 0) return shelf(items)
  const column = shelf(entries, 1)
  const west = column.d > FOLD_ASPECT * column.w ? shelf(entries) : column
  const rects = new Map<string, CellRect>(
    entries.map(item => [item.key, { ...west.at.get(item.key)!, w: item.w, d: item.d }]),
  )
  // Keep entries on the west boundary; other candidates slide east to it before scoring.
  const state = { rects, paths: new PackingPaths(items, rects), westEdge: entries.length > 0 ? PAD : -Infinity }
  placeConnected(connected, state)
  placeLoose(loose, rects)
  const all = unionRects([...rects.values()])!
  const at = new Map([...rects].map(([key, rect]) => [key, { gx: rect.gx - all.gx + PAD, gy: rect.gy - all.gy + PAD }]))
  return { w: all.w + 2 * PAD, d: all.d + 2 * PAD, at }
}
