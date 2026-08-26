import type { CodeReference, Origin } from '../types.ts'
import type { BuildingSection, Shape } from './types.ts'

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
/** Floors of the observed file with the most code lines. */
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
  if (files >= 4) return { kind: 'tower' }
  if (files >= 2) return { kind: 'stack', levels: files }
  return { kind: 'block' }
}

/** Lower-case extension used as the file's visual type; extensionless files share one neutral type. */
export function fileTypeOf(file: string): string {
  const name = file.split('/').at(-1) ?? file
  const dot = name.lastIndexOf('.')
  if (dot < 0 || dot === name.length - 1) return 'no extension'
  return name.slice(dot).toLowerCase()
}

/** One measured section per unique file, preserving the authored code-reference order. */
export function sectionsOf(
  origin: Origin,
  code: readonly CodeReference[],
  range: { min: number; max: number },
): BuildingSection[] {
  const files = new Map<string, CodeReference>()
  for (const reference of code) {
    if (!files.has(reference.file)) files.set(reference.file, reference)
  }
  return [...files.values()].map(reference => ({
    file: reference.file,
    fileType: fileTypeOf(reference.file),
    floors: floorsOf(origin, reference.lines ?? 0, range),
  }))
}

/**
 * Observed code lines raise a file section by its share of the range between
 * the fewest and the most lines among the observed files, in half floors.
 * Planned files stay one floor, as do all files when the range has one value.
 */
export function floorsOf(origin: Origin, lines: number, range: { min: number; max: number }): number {
  if (origin !== 'observed' || range.max <= range.min) return 1
  const share = (lines - range.min) / (range.max - range.min)
  return 1 + Math.round(2 * (MAX_FLOORS - 1) * share) / 2
}

/** An actor's round building or an external system's pill: one curved tier. */
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
  /** Only a short stack steps inward; a tower keeps one footprint. */
  const inset = shape.kind === 'stack' ? 0.5 * (shape.levels - 1) : 0
  const w = Math.ceil(block.w / PLANE + inset)
  const d = Math.ceil(block.d / PLANE + inset)
  return {
    w: Math.max(MIN_SIDE, shape.kind === 'tower' ? 3 : MIN_SIDE, w),
    d: Math.max(MIN_SIDE, d, degree >= HUB_DEGREE ? 3 : MIN_SIDE),
  }
}
