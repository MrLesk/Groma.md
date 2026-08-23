import { FOLD_ASPECT, GAP, SPOT_BEND, SPOT_DETOUR } from './forces.ts'
import { EMPTY, PAD, overlaps, unionRects } from './grid.ts'
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
const overlapX = (a: CellRect, b: CellRect): boolean => a.gx < b.gx + b.w && b.gx < a.gx + a.w
const overlapY = (a: CellRect, b: CellRect): boolean => a.gy < b.gy + b.d && b.gy < a.gy + a.d

/** True when the two keep GAP between them on at least one axis. */
function apart(a: CellRect, b: CellRect): boolean {
  return a.gx + a.w + GAP <= b.gx || b.gx + b.w + GAP <= a.gx || a.gy + a.d + GAP <= b.gy || b.gy + b.d + GAP <= a.gy
}

/** A one-cell-wide strip along a horizontal or vertical run. */
const across = (x0: number, x1: number, y: number): CellRect => ({ gx: Math.min(x0, x1), gy: y - 0.5, w: Math.abs(x1 - x0), d: 1 })
const along = (x: number, y0: number, y1: number): CellRect => ({ gx: x - 0.5, gy: Math.min(y0, y1), w: 1, d: Math.abs(y1 - y0) })

/**
 * True when every run an arrow could take between two siblings crosses
 * another sibling: side by side it is a Z with one jog, tried near either
 * end and in the middle; diagonal it is an L either way round.
 */
function blocked(a: CellRect, b: CellRect, others: readonly CellRect[]): boolean {
  const hit = (...strips: CellRect[]): boolean => strips.some(strip => strip.w > 0 && strip.d > 0 && others.some(other => overlaps(other, strip)))
  const ca = centre(a)
  const cb = centre(b)
  if (overlapY(a, b)) {
    const [west, east] = a.gx <= b.gx ? [a, b] : [b, a]
    const x0 = west.gx + west.w
    const x1 = east.gx
    const cw = centre(west)
    const ce = centre(east)
    return [x0 + 0.5, (x0 + x1) / 2, x1 - 0.5].every(x => hit(across(x0, x, cw.y), along(x, cw.y, ce.y), across(x, x1, ce.y)))
  }
  if (overlapX(a, b)) {
    const [north, south] = a.gy <= b.gy ? [a, b] : [b, a]
    const y0 = north.gy + north.d
    const y1 = south.gy
    const cn = centre(north)
    const cs = centre(south)
    return [y0 + 0.5, (y0 + y1) / 2, y1 - 0.5].every(y => hit(along(cn.x, y0, y), across(cn.x, cs.x, y), along(cs.x, y, y1)))
  }
  const ax = ca.x < cb.x ? a.gx + a.w : a.gx
  const bx = ca.x < cb.x ? b.gx : b.gx + b.w
  const ay = ca.y < cb.y ? a.gy + a.d : a.gy
  const by = ca.y < cb.y ? b.gy : b.gy + b.d
  return hit(across(ax, cb.x, ca.y), along(cb.x, ca.y, by)) && hit(along(ca.x, ay, cb.y), across(ca.x, bx, cb.y))
}

/**
 * What the arrow between two siblings costs: its Manhattan length, BEND per
 * bend (none when their centres line up, one when they sit diagonally, two
 * when they overlap on one axis without lining up) and DETOUR when every
 * run between them crosses another sibling.
 */
function arrowCost(a: CellRect, b: CellRect, others: readonly CellRect[]): number {
  const dx = Math.abs(centre(a).x - centre(b).x)
  const dy = Math.abs(centre(a).y - centre(b).y)
  const bends = dx <= 0.5 || dy <= 0.5 ? 0 : overlapX(a, b) || overlapY(a, b) ? 2 : 1
  return dx + dy + SPOT_BEND * bends + (blocked(a, b, others) ? SPOT_DETOUR : 0)
}

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
  const connected = items
    .filter(item => !item.entry && item.partners.size > 0)
    .sort((a, b) => weightOf(b) - weightOf(a))
  const loose = items.filter(item => !item.entry && item.partners.size === 0)
  if (entries.length + connected.length === 0) return shelf(items)
  const column = shelf(entries, 1)
  const west = column.d > FOLD_ASPECT * column.w ? shelf(entries) : column
  const rects = new Map<string, CellRect>(
    entries.map(item => [item.key, { ...west.at.get(item.key)!, w: item.w, d: item.d }]),
  )
  /**
   * The outside feeds the entries from the west. A spot that would cross
   * that edge is not dropped: it slides east to the edge, level with its
   * partner, and competes on cost there; dropping it instead leaves wide
   * children nowhere beside a small partner and they fall into a strip.
   */
  const westEdge = entries.length > 0 ? PAD : -Infinity
  const eastOfAll = (): { gx: number; gy: number } => {
    const all = unionRects([...rects.values()])
    return all === null ? { gx: PAD, gy: PAD } : { gx: all.gx + all.w + GAP, gy: all.gy }
  }
  while (connected.length > 0) {
    const index = connected.findIndex(item => [...item.partners.keys()].some(key => rects.has(key)))
    const [item] = connected.splice(Math.max(0, index), 1) as [Partnered]
    const placed = [...rects.values()]
    const partners: Partner[] = [...item.partners]
      .filter(([key]) => rects.has(key))
      .map(([key, count]) => ({ rect: rects.get(key)!, count }))
    /** The arrows among the placed siblings, each pair once. */
    const arrows = items
      .filter(other => rects.has(other.key))
      .flatMap(other => [...other.partners]
        .filter(([key]) => rects.has(key) && other.key < key)
        .map(([key, count]) => ({ a: rects.get(other.key)!, b: rects.get(key)!, count })))
    let best = eastOfAll()
    let bestCost = Infinity
    if (partners.length > 0) {
      const all = unionRects(placed)!
      for (const spot of spots(item, partners, all)) {
        const rect = { gx: Math.max(spot.gx, westEdge), gy: spot.gy, w: item.w, d: item.d }
        if (!placed.every(other => apart(rect, other))) continue
        /** A spot costs the arrows it makes, the placed arrows it newly stands in the way of, and the cells it adds to the surface's longer side, so chains wrap instead of stretching. */
        const cost = partners.reduce(
          (sum, partner) => sum + partner.count * arrowCost(rect, partner.rect, placed.filter(other => other !== partner.rect)),
          longer(unionRects([...placed, rect])!) - longer(all),
        ) + arrows.reduce((sum, arrow) => {
          const others = placed.filter(other => other !== arrow.a && other !== arrow.b)
          return sum + (!blocked(arrow.a, arrow.b, others) && blocked(arrow.a, arrow.b, [...others, rect]) ? SPOT_DETOUR * arrow.count : 0)
        }, 0)
        if (cost < bestCost) {
          best = { gx: rect.gx, gy: rect.gy }
          bestCost = cost
        }
      }
    }
    rects.set(item.key, { ...best, w: item.w, d: item.d })
  }
  if (loose.length > 0) {
    const block = shelf(loose)
    const start = eastOfAll()
    for (const item of loose) {
      const { gx, gy } = block.at.get(item.key)!
      rects.set(item.key, { gx: start.gx + gx - PAD, gy: start.gy + gy - PAD, w: item.w, d: item.d })
    }
  }
  const all = unionRects([...rects.values()])!
  const at = new Map([...rects].map(([key, rect]) => [key, { gx: rect.gx - all.gx + PAD, gy: rect.gy - all.gy + PAD }]))
  return { w: all.w + 2 * PAD, d: all.d + 2 * PAD, at }
}
