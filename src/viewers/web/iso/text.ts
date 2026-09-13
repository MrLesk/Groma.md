import { SURFACE_PAD, labelHeight, textLineHeight, textPadding } from '../../../sheet/measure.ts'
import type { ProjectionView, SurfaceLabel, SurfaceText } from './project.ts'
import { planeMatrix } from './project.ts'
import { svg } from './svg.ts'

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
