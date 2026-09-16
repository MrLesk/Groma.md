import { PLANE, SURFACE_PAD, labelHeight, textLineHeight, textPadding } from '../../../sheet/measure.ts'
import type { ProjectionView, SurfaceLabel, SurfaceText } from './project.ts'
import { planeMatrix, project } from './project.ts'
import { round, svg } from './svg.ts'

/** Additional space around hierarchy text, measured along each projected axis in screen pixels. */
export const SURFACE_SCREEN_PAD = 8

export function surfaceLabelInsets(zoom: number, view: ProjectionView): { x: number; y: number } {
  const length = (x: number, y: number) => {
    const axis = project(x / PLANE, y / PLANE, 0, view)
    // Match the rounded axes actually used by planeMatrix.
    return Math.hypot(round(axis.x), round(axis.y))
  }
  return { x: SURFACE_SCREEN_PAD / (zoom * length(1, 0)), y: SURFACE_SCREEN_PAD / (zoom * length(0, 1)) }
}

/** Update only label clearances; camera motion never changes packed architecture geometry. */
export function padSurfaceLabels(labels: readonly SVGGElement[], zoom: number, view: ProjectionView): void {
  const padding = surfaceLabelInsets(zoom, view)
  for (const label of labels) {
    const text = label.querySelector('text')!
    const hit = label.querySelector('rect')!
    const width = Number(text.getAttribute('x')) * 2
    const size = Number(text.getAttribute('font-size'))
    text.setAttribute('dy', String(padding.y))
    hit.setAttribute('x', String(-padding.x))
    hit.setAttribute('width', String(width + 2 * padding.x))
    hit.setAttribute('height', String(labelHeight(size) + 2 * padding.y))
  }
}

/** Building names stay inset on their own roofs, laid out in plane pixels. */
export function surfaceText(
  text: SurfaceText,
  size: number,
  className: string,
  view: ProjectionView,
): SVGGElement {
  const group = svg('g', { transform: planeMatrix('ground', text.origin, view) }, className)
  const padding = textPadding(size)
  text.lines.forEach((line, index) => {
    const node = svg('text', {
      x: padding,
      y: padding + size * 0.9 + index * textLineHeight(size),
      'font-size': size,
    }, 'text')
    node.textContent = line
    group.append(node)
  })
  return group
}

/** The label and its short leader share the surface's identity and ground plane. */
export function surfaceLabel(
  text: SurfaceLabel,
  size: number,
  view: ProjectionView,
  spacing = 0,
): SVGGElement {
  const group = svg('g', { transform: planeMatrix('ground', text.origin, view) }, 'label surface-label')
  group.append(
    svg('rect', { width: text.width, height: labelHeight(size) }, 'label-hit'),
    svg('line', { x1: text.width / 2, x2: text.width / 2, y1: 0, y2: 2 * SURFACE_PAD }, 'label-leader'),
  )
  const node = svg('text', {
    x: text.width / 2,
    y: 3 * SURFACE_PAD + size * 0.9,
    'text-anchor': 'middle',
    'font-size': size,
    'letter-spacing': `${spacing}em`,
  }, 'text')
  node.textContent = text.lines[0]!
  group.append(node)
  return group
}
