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
/** Every 150 observed lines add half a floor, up to three floors. */
const LINES_PER_HALF_FLOOR = 150
const MAX_HALF_FLOORS = 4

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

/** Code files decide the shape: one box, a stack of one tier per file, or a hatched tower. */
export function shapeOf(files: number): Shape {
  if (files >= 4) return { kind: 'tower', levels: 1 }
  if (files >= 2) return { kind: 'stack', levels: files }
  return { kind: 'block', levels: 1 }
}

/** Observed code lines raise a component; ghosts, people and external systems stay one floor. */
export function floorsOf(origin: Origin, lines: number): number {
  if (origin !== 'observed') return 1
  return 1 + Math.min(MAX_HALF_FLOORS, Math.floor(lines / LINES_PER_HALF_FLOOR)) / 2
}

/** Footprint in cells: the top tier's roof holds every line of the name; a hub deepens for its ports. */
export function footprintOf(
  lines: readonly string[],
  shape: Shape,
  degree: number,
): { w: number; d: number } {
  const longest = Math.max(...lines.map(line => textWidth(line)))
  /** Each tier above the first insets the roof a quarter cell per side. */
  const inset = 0.5 * (shape.levels - 1)
  const w = Math.ceil((longest + 2 * ROOF_PAD) / PLANE + inset)
  const d = Math.ceil((2 * ROOF_PAD + lines.length * ROOF_LINE_HEIGHT) / PLANE + inset)
  return {
    w: Math.max(MIN_SIDE, shape.kind === 'tower' ? 3 : MIN_SIDE, w),
    d: Math.max(MIN_SIDE, d, degree >= HUB_DEGREE ? 3 : MIN_SIDE),
  }
}
