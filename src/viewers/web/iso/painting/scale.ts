/**
 * The map's levels from the outside in, like heading levels: each step down
 * is thinner and darker, so at any zoom the eye sorts the big outlined
 * boundaries from the small solid things and the hairline connections.
 * Kind (patterns, shapes) is the other axis and never changes a weight.
 */
export const LEVELS = ['island', 'slab', 'building', 'route'] as const
export type Level = (typeof LEVELS)[number]

/** Each level down is this much thinner. */
const STROKE_RATIO = 1.4
/** Each level down mixes this much more ink into the paper. */
const TINT_RATIO = 1.8
/** Buildings stroke one screen pixel at fit; islands and slabs are wider, routes thinner. */
const BUILDING_STROKE = 1
/** Ink share of an island's surface. */
const ISLAND_TINT = 0.04
/** A thing's sides lie one level deeper than its top, the left face half a level more, for the 3D read. */
export const SIDE = { right: 1, left: 1.5 } as const
/** The smallest facade mark must reach one screen pixel before its pattern is useful. */
export const FACADE_MARK = 1.1

export function depthOf(level: Level): number {
  return LEVELS.indexOf(level)
}

/** Stroke width in screen pixels at fit. */
export function strokeAt(depth: number): number {
  return BUILDING_STROKE * STROKE_RATIO ** (depthOf('building') - depth)
}

/** Share of ink mixed into the paper, 0 to 1. */
export function tintAt(depth: number): number {
  return ISLAND_TINT * TINT_RATIO ** depth
}

/** Hover, selection and lit routes climb the stroke ladder by this many levels. */
export function emphasis(steps: number): number {
  return STROKE_RATIO ** steps
}

/** Every stroke scales with the square root of the zoom relative to fit, so boundaries get bolder zooming in without routes turning to rope. */
export function weightAt(zoomRatio: number): number {
  return Math.min(2, Math.max(0.75, Math.sqrt(zoomRatio)))
}

export function facadeDetailsVisible(k: number): boolean {
  return k * FACADE_MARK >= 1
}

/** Island dots and crosses and the group hatching repeat this many world pixels apart; slab grain is coarser. */
export const SURFACE_TILE = 8

/** A repeat shorter than two screen pixels cannot be drawn: it reads as flat grey or moiré and only costs Safari paint time. */
export function surfacePatternsVisible(k: number): boolean {
  return k * SURFACE_TILE >= 2
}
