import { CONTAINER_FONT, GROUP_FONT, ISLAND_FONT, labelBand } from '../../../sheet/measure.ts'
import type { Building, CellRect, Route, RoutePoint, SheetScene } from '../../../sheet/types.ts'

/** How long a world change takes to settle on the map. */
export const MORPH_DURATION_MS = 700
/** Updates that arrive faster than a transition are followed at their own pace, down to this. */
export const MORPH_FASTEST_MS = 160
/** Above this many drawn surfaces a change is applied at once; repainting every frame would stutter. */
export const MORPH_LIMIT = 500
/** Entering and leaving geometry never collapses to nothing while it is drawn. */
const SEED = 0.02

const mix = (from: number, to: number, amount: number): number => from + (to - from) * amount

function mixRect(from: CellRect, to: CellRect, amount: number): CellRect {
  return { gx: mix(from.gx, to.gx, amount), gy: mix(from.gy, to.gy, amount), w: mix(from.w, to.w, amount), d: mix(from.d, to.d, amount) }
}

/** The rect drawn towards its own centre; a size of one is the rect itself. */
function sizedRect(rect: CellRect, size: number): CellRect {
  return { gx: rect.gx + (rect.w * (1 - size)) / 2, gy: rect.gy + (rect.d * (1 - size)) / 2, w: rect.w * size, d: rect.d * size }
}

/** A surface's body drawn towards its centre while the label band packed along +gy keeps its depth. */
function sizedSurface<T extends { rect: CellRect }>(font: number): (item: T, size: number) => T {
  const band = labelBand(font)
  return (item, size) => {
    const body = item.rect.d - band
    return { ...item, rect: { gx: item.rect.gx + (item.rect.w * (1 - size)) / 2, gy: item.rect.gy + (body * (1 - size)) / 2, w: item.rect.w * size, d: band + body * size } }
  }
}

/**
 * Matches items by key: shared ones blend, items only in `to` enter growing, items only in `from` leave shrinking.
 * The result keeps the order of `to`, with leaving items after it.
 */
function blend<T>(
  from: readonly T[], to: readonly T[], amount: number, keyOf: (item: T) => string,
  shared: (from: T, to: T) => T, sized: (item: T, size: number) => T,
): T[] {
  const before = new Map(from.map(item => [keyOf(item), item]))
  const after = new Set(to.map(keyOf))
  const result = to.map(item => {
    const old = before.get(keyOf(item))
    return old === undefined ? sized(item, Math.max(amount, SEED)) : shared(old, item)
  })
  for (const item of from) if (!after.has(keyOf(item))) result.push(sized(item, Math.max(1 - amount, SEED)))
  return result
}

/** A building drawn at a fraction of its size: footprint and height together, the name once it is half grown (a blank line keeps its roof measurable). */
function sizedBuilding(building: Building, size: number): Building {
  return {
    ...building,
    rect: sizedRect(building.rect, size),
    heightUnits: building.heightUnits * size,
    floors: building.floors.map(floor => ({
      ...floor, heightUnits: floor.heightUnits * size, footprint: { w: floor.footprint.w * size, d: floor.footprint.d * size },
    })),
    lines: size < 0.5 ? [''] : building.lines,
  }
}

function blendBuilding(from: Building, to: Building, amount: number): Building {
  const sameFloors = from.floors.length === to.floors.length
  return {
    ...to,
    rect: mixRect(from.rect, to.rect, amount),
    heightUnits: mix(from.heightUnits, to.heightUnits, amount),
    floors: sameFloors
      ? to.floors.map((floor, index) => ({
        ...floor,
        heightUnits: mix(from.floors[index]!.heightUnits, floor.heightUnits, amount),
        footprint: { w: mix(from.floors[index]!.footprint.w, floor.footprint.w, amount), d: mix(from.floors[index]!.footprint.d, floor.footprint.d, amount) },
      }))
      : amount < 0.5 ? from.floors : to.floors,
    lines: amount < 0.5 ? from.lines : to.lines,
  }
}

/** Distance along the path at each point, as a fraction of its length; a still path spans zero to one. */
function fractionsOf(points: readonly RoutePoint[]): number[] {
  const distances = [0]
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1]!, point = points[index]!
    distances.push(distances[index - 1]! + Math.hypot(point.gx - previous.gx, point.gy - previous.gy))
  }
  const length = distances.at(-1)!
  return length === 0 ? points.map((_, index) => index / Math.max(1, points.length - 1)) : distances.map(distance => distance / length)
}

/** The point a fraction of the way along the path, on the segment it falls in. */
function pointAt(points: readonly RoutePoint[], fractions: readonly number[], fraction: number): RoutePoint {
  let index = 1
  while (index < fractions.length - 1 && fractions[index]! < fraction) index++
  const start = points[index - 1]!, end = points[index]!
  const span = fractions[index]! - fractions[index - 1]!
  const along = span === 0 ? 0 : (fraction - fractions[index - 1]!) / span
  return { gx: mix(start.gx, end.gx, along), gy: mix(start.gy, end.gy, along) }
}

/** Both paths sampled at the union of their corner fractions, so each keeps every corner of both. */
function matchPoints(from: readonly RoutePoint[], to: readonly RoutePoint[]): [RoutePoint[], RoutePoint[]] {
  const fromFractions = fractionsOf(from), toFractions = fractionsOf(to)
  const fractions = [...new Set([...fromFractions, ...toFractions])].sort((left, right) => left - right)
  return [fractions.map(fraction => pointAt(from, fromFractions, fraction)), fractions.map(fraction => pointAt(to, toFractions, fraction))]
}

/** The first part of a path, cut at a fraction of its length. */
function drawnPath(points: readonly RoutePoint[], fraction: number): RoutePoint[] {
  const fractions = fractionsOf(points)
  const kept = points.filter((_, index) => index === 0 || fractions[index]! < fraction)
  return [...kept, pointAt(points, fractions, fraction)]
}

function blendRoute(from: Route, to: Route, amount: number): Route {
  const [start, end] = matchPoints(from.points, to.points)
  return { ...to, points: start.map((point, index) => ({ gx: mix(point.gx, end[index]!.gx, amount), gy: mix(point.gy, end[index]!.gy, amount) })) }
}

/**
 * The sheet part of the way from one world's placement to the next. Shared islands, slabs, buildings and routes
 * glide, new buildings grow out of the ground while their routes draw on, departed ones shrink while their routes
 * retract. Cells project linearly, so straight lines here are straight lines on screen.
 */
export function tweenSheet(from: SheetScene, to: SheetScene, amount: number): SheetScene {
  if (amount <= 0) return from
  if (amount >= 1) return to
  const glide = <T extends { rect: CellRect }>(a: T, b: T): T => ({ ...b, rect: mixRect(a.rect, b.rect, amount) })
  // The frame around an appearing or vanishing map is the map's own, not a tiny one whose plate rewraps every frame.
  const frame = from.islands.length === 0 ? to.sheet : to.islands.length === 0 ? from.sheet : mixRect(from.sheet, to.sheet, amount)
  return {
    sheet: frame,
    islands: blend(from.islands, to.islands, amount, island => island.key, glide, sizedSurface(ISLAND_FONT)),
    zones: blend(from.zones, to.zones, amount, zone => zone.key, glide, sizedSurface(GROUP_FONT)),
    slabs: blend(from.slabs, to.slabs, amount, slab => slab.representationId, glide, sizedSurface(CONTAINER_FONT)),
    buildings: blend(from.buildings, to.buildings, amount, building => building.representationId, (a, b) => blendBuilding(a, b, amount), sizedBuilding),
    routes: blend(from.routes, to.routes, amount, route => route.id, (a, b) => blendRoute(a, b, amount),
      (route, size) => ({ ...route, points: drawnPath(route.points, size) })),
  }
}

/** True when a new placement draws exactly what is shown, so there is nothing to move. */
export function sameSheet(displayed: SheetScene, next: SheetScene): boolean {
  return displayed === next || JSON.stringify(displayed) === JSON.stringify(next)
}
