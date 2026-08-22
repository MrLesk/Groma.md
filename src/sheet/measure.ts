import type { Origin } from '../types.ts'
import type { Shape } from './types.ts'

/** Plane pixels per cell: the roof text is laid out in these units and projected with the roof. */
export const PLANE = 24
export const ROOF_FONT = 11
/** Advance of one monospace glyph as a fraction of the font size. */
const ROOF_ADVANCE = 0.62
export const ROOF_PAD = 6
export const ROOF_LINE_HEIGHT = 13
/** Surface names: islands in spaced capitals, slabs and zones at roof size. */
export const ISLAND_FONT = 12
export const ISLAND_SPACING = 0.14
export const SURFACE_FONT = 11

/** A roof line wider than this wraps, when the name has a space to wrap at. */
const MAX_LINE_CELLS = 4
const MIN_SIDE = 2
/** A building touched by this many routes deepens so its front sides keep free ports. */
const HUB_DEGREE = 8
/** Floors of the observed component with the most code lines. */
const MAX_FLOORS = 4

export function textWidth(text: string, size = ROOF_FONT, spacing = 0): number {
  return text.length * size * (ROOF_ADVANCE + spacing)
}

/** Cells a surface needs along +gx so its own name fits in its front band. */
export function nameCells(name: string, size: number, spacing = 0): number {
  return Math.ceil((textWidth(name, size, spacing) + 2 * ROOF_PAD) / PLANE)
}

/** The name as roof lines: one line, or two split at the space nearest the middle when one line would exceed four cells. */
export function roofLines(name: string): string[] {
  if (textWidth(name) + 2 * ROOF_PAD <= MAX_LINE_CELLS * PLANE) return [name]
  const middle = name.length / 2
  let split = -1
  for (let index = 0; index < name.length; index += 1) {
    if (name[index] !== ' ') continue
    if (split === -1 || Math.abs(index - middle) < Math.abs(split - middle)) split = index
  }
  if (split === -1) return [name]
  return [name.slice(0, split), name.slice(split + 1)]
}

/** Code files decide the shape: one box, a stack of one tier per file, or a tower. */
export function shapeOf(files: number): Shape {
  if (files >= 4) return { kind: 'tower', levels: 1 }
  if (files >= 2) return { kind: 'stack', levels: files }
  return { kind: 'block', levels: 1 }
}

/**
 * Observed code lines raise a component by its share of the range between
 * the fewest and the most lines among the observed components, in half
 * floors. Ghosts, people and external systems stay one floor, as does every
 * component when there are no observed components or all have the same count.
 */
export function floorsOf(origin: Origin, lines: number, range: { min: number; max: number }): number {
  if (origin !== 'observed' || range.max <= range.min) return 1
  const share = (lines - range.min) / (range.max - range.min)
  return 1 + Math.round(2 * (MAX_FLOORS - 1) * share) / 2
}

/** A person's round building or an external system's pill: one curved tier. */
export const curved = (shape: Shape): boolean => shape.kind === 'round' || shape.kind === 'pill'

/** The name's block on a roof in plane pixels: the longest line with ROOF_PAD around it, one ROOF_LINE_HEIGHT per line. */
export function roofBlock(lines: readonly string[]): { w: number; d: number } {
  return {
    w: Math.max(...lines.map(line => textWidth(line))) + 2 * ROOF_PAD,
    d: 2 * ROOF_PAD + lines.length * ROOF_LINE_HEIGHT,
  }
}

/** Footprint in cells: the roof holds the name's block (a box on its top tier, a round building inside its circle, a pill along its straight middle); a hub deepens for its ports. */
export function footprintOf(
  lines: readonly string[],
  shape: Shape,
  degree: number,
): { w: number; d: number } {
  const block = roofBlock(lines)
  if (shape.kind === 'round') {
    const side = Math.max(MIN_SIDE, Math.ceil(Math.hypot(block.w, block.d) / PLANE))
    return { w: side, d: side }
  }
  if (shape.kind === 'pill') {
    /** A semicircle of radius d / 2 at each end adds d to the straight middle. */
    const d = MIN_SIDE
    return { w: Math.ceil(block.w / PLANE) + d, d }
  }
  /** Each tier above the first insets the roof a quarter cell per side. */
  const inset = 0.5 * (shape.levels - 1)
  const w = Math.ceil(block.w / PLANE + inset)
  const d = Math.ceil(block.d / PLANE + inset)
  return {
    w: Math.max(MIN_SIDE, shape.kind === 'tower' ? 3 : MIN_SIDE, w),
    d: Math.max(MIN_SIDE, d, degree >= HUB_DEGREE ? 3 : MIN_SIDE),
  }
}
