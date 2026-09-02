import type { AnnotatedElement, CodeReference, Origin } from '../types.ts'
import type { BuildingFloor, Shape } from './types.ts'

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
/** Height units of the observed file with the most code lines. */
const MAX_HEIGHT_UNITS = 4
/** Most visible source-file groups in one component building. */
const MAX_VISIBLE_FLOORS = 5
/** Extra cells on either footprint axis for the largest observed dependency count. */
const MAX_AREA_UNITS = 3

export interface MeasureRange {
  min: number
  max: number
}

export interface FileMeasureRanges {
  filesPerComponent: MeasureRange
  lines: MeasureRange
  dependencies: MeasureRange
  dependents: MeasureRange
}

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

/** Lower-case extension used as the file's visual type; extensionless files share one neutral type. */
export function fileTypeOf(file: string): string {
  const name = file.split('/').at(-1) ?? file
  const dot = name.lastIndexOf('.')
  if (dot < 0 || dot === name.length - 1) return 'no extension'
  return name.slice(dot).toLowerCase()
}

function rangeShare(
  origin: Origin,
  value: number | undefined,
  range: MeasureRange,
): number | undefined {
  if (origin !== 'observed' || value === undefined || range.max <= range.min) return undefined
  return Math.max(0, Math.min(1, (value - range.min) / (range.max - range.min)))
}

function rangeOf(values: number[]): MeasureRange {
  return values.length === 0
    ? { min: 0, max: 0 }
    : { min: Math.min(...values), max: Math.max(...values) }
}

/** Project ranges for the three file dimensions, taken only from observed component evidence. */
export function fileMeasureRanges(elements: readonly AnnotatedElement[]): FileMeasureRanges {
  const components = elements.filter(element => element.kind === 'component' && element.origin === 'observed')
  const code = components.flatMap(element => element.code)
  return {
    filesPerComponent: rangeOf(components.flatMap(element => {
      const count = new Set(element.code.map(reference => reference.file)).size
      return count === 0 ? [] : [count]
    })),
    lines: rangeOf(code.flatMap(reference => reference.lines === undefined ? [] : [reference.lines])),
    dependencies: rangeOf(code.flatMap(reference => reference.dependencies === undefined ? [] : [reference.dependencies])),
    dependents: rangeOf(code.flatMap(reference => reference.dependents === undefined ? [] : [reference.dependents])),
  }
}

interface MeasuredFile {
  file: string
  fileType: string
  heightUnits: number
  footprint: { w: number; d: number }
}

function visibleFloorCount(origin: Origin, files: number, range: MeasureRange): number {
  if (files === 0) return 0
  const share = rangeShare(origin, files, range)
  const count = share === undefined ? 1 : 1 + Math.round((MAX_VISIBLE_FLOORS - 1) * share)
  return Math.min(files, count)
}

function grouped<T>(items: readonly T[], count: number): T[][] {
  const base = Math.floor(items.length / count)
  const extra = items.length % count
  let start = 0
  return Array.from({ length: count }, (_, index) => {
    const end = start + base + (index < extra ? 1 : 0)
    const group = items.slice(start, end)
    start = end
    return group
  })
}

function compareFileArea(left: MeasuredFile, right: MeasuredFile): number {
  return right.footprint.w * right.footprint.d - left.footprint.w * left.footprint.d
    || right.footprint.w - left.footprint.w
    || right.footprint.d - left.footprint.d
    || left.file.localeCompare(right.file)
}

/** Compress every unique source file into one to five nested visible floors. */
export function floorsOf(
  origin: Origin,
  code: readonly CodeReference[],
  ranges: FileMeasureRanges,
  base: { w: number; d: number },
): BuildingFloor[] {
  const files = new Map<string, CodeReference>()
  for (const reference of code) {
    if (!files.has(reference.file)) files.set(reference.file, reference)
  }
  const measured: MeasuredFile[] = [...files.values()].map(reference => ({
    file: reference.file,
    fileType: fileTypeOf(reference.file),
    heightUnits: heightUnitsOf(origin, reference.lines, ranges.lines),
    footprint: {
      w: base.w + areaUnitsOf(origin, reference.dependents, ranges.dependents),
      d: base.d + areaUnitsOf(origin, reference.dependencies, ranges.dependencies),
    },
  })).sort(compareFileArea)
  if (measured.length === 0) return []
  const floors = grouped(measured, visibleFloorCount(origin, measured.length, ranges.filesPerComponent)).map(group => ({
    files: group.map(file => file.file),
    facadeFileType: group[0]!.fileType,
    heightUnits: Math.max(...group.map(file => file.heightUnits)),
    footprint: {
      w: Math.max(...group.map(file => file.footprint.w)),
      d: Math.max(...group.map(file => file.footprint.d)),
    },
  }))
  for (let index = floors.length - 2; index >= 0; index -= 1) {
    floors[index]!.footprint.w = Math.max(floors[index]!.footprint.w, floors[index + 1]!.footprint.w)
    floors[index]!.footprint.d = Math.max(floors[index]!.footprint.d, floors[index + 1]!.footprint.d)
  }
  return floors
}

/**
 * Observed code lines raise a file floor by its share of the project range,
 * in half height units. Draft files and equal ranges stay one unit high.
 */
export function heightUnitsOf(
  origin: Origin,
  lines: number | undefined,
  range: MeasureRange,
): number {
  const share = rangeShare(origin, lines, range)
  return share === undefined ? 1 : 1 + Math.round(2 * (MAX_HEIGHT_UNITS - 1) * share) / 2
}

/** Extra footprint cells from a project-relative dependency count. */
export function areaUnitsOf(
  origin: Origin,
  count: number | undefined,
  range: MeasureRange,
): number {
  const share = rangeShare(origin, count, range)
  return share === undefined ? 0 : Math.round(MAX_AREA_UNITS * share)
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
  const w = Math.ceil(block.w / PLANE)
  const d = Math.ceil(block.d / PLANE)
  return {
    w: Math.max(MIN_SIDE, w),
    d: Math.max(MIN_SIDE, d, degree >= HUB_DEGREE ? 3 : MIN_SIDE),
  }
}
