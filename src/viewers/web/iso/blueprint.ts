import type { MarkdownBlock, MarkdownSpan, MarkdownStyle } from '../../../project-markdown.ts'
import type { ProjectProfile } from '../../../project-profile.ts'
import { PLANE, textWidth } from '../../../sheet/measure.ts'
import type { CellRect } from '../../../sheet/types.ts'
import type { Point } from '../../../types.ts'

const MAX_SCALE = 3
const FRAME_MARGIN = 2.5
const COMPASS_RADIUS = 0.55
const COMPASS_LETTER = 0.22
const PROJECT_META = 'GROMA  /  ARCHITECTURE MAP'
const MAX_PLATE_LINE_CHARACTERS = 80

type Projector = (gx: number, gy: number, z: number) => Point

export interface Segment {
  from: Point
  to: Point
}

export interface Compass {
  at: { gx: number; gy: number }
  centre: Point
  ring: Point[]
  star: Point[]
  north: Point[]
  letters: { text: string; at: Point }[]
  fontSize: number
}

export interface PlateText {
  origin: Point
  lines: string[]
  fontSize: number
  lineHeight: number
  maxWidth: number
}

export interface PlateRun {
  text: string
  styles: MarkdownStyle[]
}

export interface RichPlateText extends Omit<PlateText, 'lines'> {
  lines: PlateRun[][]
}

export interface ProjectPlate {
  polygon: Point[]
  divider: Segment
  name: PlateText
  description: RichPlateText
  meta: PlateText
  edit: {
    polygon: Point[]
    pencil: { origin: Point; length: number; thickness: number }
  }
}

export interface Blueprint {
  frame: Point[]
  calibrationTicks: Segment[]
  compass: Compass
  projectPlate?: ProjectPlate
}

const corners = (rect: CellRect, project: Projector): Point[] => [
  project(rect.gx, rect.gy, 0),
  project(rect.gx + rect.w, rect.gy, 0),
  project(rect.gx + rect.w, rect.gy + rect.d, 0),
  project(rect.gx, rect.gy + rect.d, 0),
]

function scaleOf(sheet: CellRect): number {
  return Math.min(MAX_SCALE, Math.max(1, Math.min(sheet.w, sheet.d) / 16))
}

/** Unlabelled calibration marks along the two front edges of the sheet. */
function calibrationTicks(frame: CellRect, scale: number, project: Projector): Segment[] {
  const count = (length: number): number => Math.max(5, Math.min(14, Math.round(length / (2.2 * scale))))
  const ticks: Segment[] = []
  const east = frame.gx + frame.w
  const south = frame.gy + frame.d
  const eastCount = count(frame.d)
  const southCount = count(frame.w)
  for (let index = 1; index <= eastCount; index += 1) {
    const gy = frame.gy + frame.d * index / (eastCount + 1)
    const depth = (index % 4 === 0 ? 0.3 : 0.18) * scale
    ticks.push({ from: project(east, gy, 0), to: project(east - depth, gy, 0) })
  }
  for (let index = 1; index <= southCount; index += 1) {
    const gx = frame.gx + frame.w * index / (southCount + 1)
    const depth = (index % 4 === 0 ? 0.3 : 0.18) * scale
    ticks.push({ from: project(gx, south, 0), to: project(gx, south - depth, 0) })
  }
  return ticks
}

function compassOf(frame: CellRect, scale: number, project: Projector): Compass {
  const inset = FRAME_MARGIN * scale / 2
  const at = { gx: frame.gx + inset, gy: frame.gy + frame.d - inset }
  const on = (dx: number, dy: number): Point => project(at.gx + dx, at.gy + dy, 0)
  const radius = COMPASS_RADIUS * scale
  const notch = 0.18 * radius
  const tip = radius + COMPASS_LETTER * scale
  return {
    at,
    centre: on(0, 0),
    ring: Array.from({ length: 32 }, (_, index) => {
      const angle = index * Math.PI / 16
      return on(radius * Math.cos(angle), radius * Math.sin(angle))
    }),
    star: [on(0, -radius), on(notch, -notch), on(radius, 0), on(notch, notch), on(0, radius), on(-notch, notch), on(-radius, 0), on(-notch, -notch)],
    north: [on(0, -radius), on(notch, -notch), on(0, 0), on(-notch, -notch)],
    letters: [
      { text: 'N', at: on(0, -tip) }, { text: 'E', at: on(tip, 0) },
      { text: 'S', at: on(0, tip) }, { text: 'W', at: on(-tip, 0) },
    ],
    fontSize: 6 * scale,
  }
}

function wrapPlain(text: string, width: number, size: number): string[] {
  const lines: string[] = []
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
    .flatMap(word => chunksOf(word, width, size))
  for (const word of words) {
    const current = lines.at(-1)
    if (current === undefined || textWidth(`${current} ${word}`, size) > width) lines.push(word)
    else lines[lines.length - 1] = `${current} ${word}`
  }
  return lines
}

function chunksOf(text: string, width: number, size: number): string[] {
  const characters = Math.max(1, Math.floor(width / textWidth('M', size)))
  return Array.from({ length: Math.ceil(text.length / characters) }, (_, index) =>
    text.slice(index * characters, (index + 1) * characters))
}

function sameStyle(left: PlateRun | undefined, right: MarkdownSpan): boolean {
  return left !== undefined && left.styles.join(' ') === right.styles.join(' ')
}

function wrapBlock(block: MarkdownBlock, width: number, size: number): PlateRun[][] {
  const spans = block.marker === undefined
    ? block.spans
    : [{ text: `${block.marker} `, styles: [] }, ...block.spans]
  const lines: PlateRun[][] = [[]]
  let lineText = ''
  let pendingSpace = false
  for (const span of spans) {
    for (const token of span.text.match(/\S+|\s+/g) ?? []) {
      if (/^\s+$/.test(token)) {
        pendingSpace = true
        continue
      }
      for (const chunk of chunksOf(token, width, size)) {
        const separator = lineText === '' || !pendingSpace ? '' : ' '
        if (lineText !== '' && textWidth(`${lineText}${separator}${chunk}`, size) > width) {
          lines.push([])
          lineText = ''
        }
        const text = `${lineText === '' ? '' : separator}${chunk}`
        const line = lines.at(-1)!
        if (sameStyle(line.at(-1), span)) line.at(-1)!.text += text
        else line.push({ text, styles: [...span.styles] })
        lineText += text
        pendingSpace = false
      }
    }
  }
  return lines
}

function wrapMarkdown(blocks: readonly MarkdownBlock[], width: number, size: number): PlateRun[][] {
  return blocks.flatMap((block, index) => [
    ...(index === 0 ? [] : [[]]),
    ...wrapBlock(block, width, size),
  ])
}

function projectPlate(
  sheet: CellRect,
  scale: number,
  profile: ProjectProfile,
  project: Projector,
): { plate: ProjectPlate; rect: CellRect } {
  const editWidth = 1.7 * scale
  const nameSize = 11 * scale
  const nameLineHeight = 12.5 * scale
  const descriptionSize = 6 * scale
  const descriptionLineHeight = 7.5 * scale
  const metaSize = 4.5 * scale
  const contentInset = 0.25 * scale
  const pencilGutter = 0.5 * scale
  const horizontalPadding = contentInset + pencilGutter
  const limitedWidth = (text: string, size: number): number =>
    textWidth(text.slice(0, MAX_PLATE_LINE_CHARACTERS), size)
  const descriptionWidth = Math.max(...profile.descriptionBlocks.map(block => limitedWidth(
    `${block.marker === undefined ? '' : `${block.marker} `}${block.spans.map(span => span.text).join('')}`,
    descriptionSize,
  )), 0)
  const desiredContentWidth = Math.max(
    limitedWidth(profile.name, nameSize),
    descriptionWidth,
    limitedWidth(PROJECT_META, metaSize),
  )
  const width = Math.min(sheet.w, editWidth + horizontalPadding + desiredContentWidth / PLANE)
  const contentWidth = (width - editWidth - horizontalPadding) * PLANE
  const nameLines = wrapPlain(profile.name, contentWidth, nameSize)
  const descriptionLines = wrapMarkdown(profile.descriptionBlocks, contentWidth, descriptionSize)
  const nameTop = 0.18 * scale
  const descriptionTop = nameTop + nameLines.length * nameLineHeight / PLANE + 0.18 * scale
  const metaTop = descriptionTop + descriptionLines.length * descriptionLineHeight / PLANE + 0.2 * scale
  const depth = metaTop + 0.45 * scale
  const rect = {
    gx: sheet.gx + sheet.w + (FRAME_MARGIN - 0.4) * scale - width,
    gy: sheet.gy + sheet.d + 0.15 * scale,
    w: width,
    d: depth,
  }
  const editRect = { ...rect, gx: rect.gx + rect.w - editWidth, w: editWidth }
  const pencilLength = Math.min(editRect.d * PLANE * 0.7, 36 * scale)
  const pencilThickness = Math.min(editRect.w * PLANE * 0.35, 12 * scale)
  const pencilOrigin = project(
    editRect.gx + editRect.w / 2 - pencilThickness / PLANE / 2,
    editRect.gy + editRect.d / 2 - pencilLength / PLANE / 2,
    0,
  )
  return {
    rect,
    plate: {
      polygon: corners(rect, project),
      divider: { from: project(editRect.gx, editRect.gy, 0), to: project(editRect.gx, editRect.gy + editRect.d, 0) },
      name: {
        origin: project(rect.gx + contentInset, rect.gy + nameTop, 0),
        lines: nameLines, fontSize: nameSize, lineHeight: nameLineHeight, maxWidth: contentWidth,
      },
      description: {
        origin: project(rect.gx + contentInset, rect.gy + descriptionTop, 0),
        lines: descriptionLines, fontSize: descriptionSize, lineHeight: descriptionLineHeight, maxWidth: contentWidth,
      },
      meta: {
        origin: project(rect.gx + contentInset, rect.gy + metaTop, 0),
        lines: [PROJECT_META], fontSize: metaSize, lineHeight: metaSize, maxWidth: contentWidth,
      },
      edit: {
        polygon: corners(editRect, project),
        pencil: { origin: pencilOrigin, length: pencilLength, thickness: pencilThickness },
      },
    },
  }
}

export function projectBlueprint(sheet: CellRect, profile: ProjectProfile | undefined, project: Projector): Blueprint {
  const scale = scaleOf(sheet)
  const plate = profile === undefined ? undefined : projectPlate(sheet, scale, profile, project)
  const margin = FRAME_MARGIN * scale
  const projectDepth = plate === undefined ? 0 : plate.rect.gy + plate.rect.d - sheet.gy - sheet.d
  const south = plate === undefined ? margin : Math.max(margin, projectDepth + 0.4 * scale)
  const frame = {
    gx: sheet.gx - margin, gy: sheet.gy - margin,
    w: sheet.w + margin * 2, d: sheet.d + margin + south,
  }
  const framePoints = corners(frame, project)
  return {
    frame: framePoints,
    calibrationTicks: calibrationTicks(frame, scale, project),
    compass: compassOf(frame, scale, project),
    ...(plate === undefined ? {} : { projectPlate: plate.plate }),
  }
}
