import { CONTAINER_FONT, PLANE, textLineHeight, textPadding } from '../../../sheet/measure.ts'
import type { ProjectionView, SurfaceLabel, SurfaceText } from './project.ts'
import { planeMatrix, project } from './project.ts'
import { node, round, type SvgNode } from './svg.ts'

/** Fixed plane-space sizes keep titles readable without relaying out at every camera scale. */
const TITLE_STEPS = [
  { below: 0.25, size: 108, padding: 12 },
  { below: 0.5, size: 84, padding: 10 },
  { below: 1, size: 64, padding: 8 },
  { below: Infinity, size: 48, padding: 6 },
]
/** Include the map font's full ascent and descent, not only its visible capital height. */
const TITLE_LINE_HEIGHT = 1.3

/** The map only needs title updates when this index changes, or when it paints a new scene. */
export function surfaceLabelStep(zoom: number): number {
  return TITLE_STEPS.findIndex(step => zoom < step.below)
}

/** Fit a fixed preset inside the packed band, including its leader and hit area. */
export function surfaceLabelLayout(
  text: Pick<SurfaceLabel, 'width' | 'band'>,
  size: number,
  zoom: number,
  view: ProjectionView,
) {
  const step = TITLE_STEPS[surfaceLabelStep(zoom)]!
  const length = (x: number, y: number) => {
    const axis = project(x / PLANE, y / PLANE, 0, view)
    // Match the rounded axes actually used by planeMatrix.
    return Math.hypot(round(axis.x), round(axis.y))
  }
  const paddingX = Math.min(step.padding / length(1, 0), text.band.width / 20)
  const paddingY = Math.min(step.padding / length(0, 1), text.band.height / 20)
  const fontSize = Math.min(
    step.size * size / CONTAINER_FONT,
    size * (text.band.width - 2 * paddingX) / text.width,
    (text.band.height - 3 * paddingY) / TITLE_LINE_HEIGHT,
  )
  const width = text.width * fontSize / size
  return {
    fontSize,
    x: (text.width - width) / 2 - paddingX,
    width: width + 2 * paddingX,
    height: 3 * paddingY + fontSize * TITLE_LINE_HEIGHT,
    leader: paddingY,
    baseline: 2 * paddingY + fontSize * 0.9,
  }
}

/** Building names stay inset on their own roofs, laid out in plane pixels. */
export function surfaceText(
  text: SurfaceText,
  size: number,
  className: string,
  view: ProjectionView,
): SvgNode {
  const padding = textPadding(size)
  return node('g', { transform: planeMatrix('ground', text.origin, view) }, className,
    text.lines.map((line, index) => node('text', {
      x: padding,
      y: padding + size * 0.9 + index * textLineHeight(size),
      'font-size': size,
    }, 'text', line)))
}

/** The label and its short leader share the surface's identity and ground plane. */
export function surfaceLabel(
  text: SurfaceLabel,
  size: number,
  view: ProjectionView,
  spacing = 0,
  zoom = 1,
): SvgNode {
  const layout = surfaceLabelLayout(text, size, zoom, view)
  return node('g', { transform: planeMatrix('ground', text.origin, view) }, 'label surface-label', [
    node('rect', { x: layout.x, width: layout.width, height: layout.height }, 'label-hit'),
    node('line', { x1: text.width / 2, x2: text.width / 2, y1: 0, y2: layout.leader }, 'label-leader'),
    node('text', {
      x: text.width / 2,
      y: layout.baseline,
      'text-anchor': 'middle',
      'font-size': layout.fontSize,
      'letter-spacing': `${spacing}em`,
    }, 'text', text.lines[0]!),
  ])
}
