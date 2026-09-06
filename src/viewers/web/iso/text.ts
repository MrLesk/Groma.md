import { SURFACE_PAD, textLineHeight, textPadding, textWidth } from '../../../sheet/measure.ts'
import type { ProjectionView, SurfaceText } from './project.ts'
import { planeMatrix } from './project.ts'
import { svg } from './svg.ts'

/** Plane pixels the chip reaches past the text on every side. */
const CHIP_PAD = 3
/** Visible edge gap follows the border's zoom weight, independently of the map scale. */
const SURFACE_GAP = 3

/**
 * Text lying on a ground-plane surface: the lines are laid out in plane
 * pixels from the surface's north corner and the ground matrix lays them
 * along the surface's north-east edge, skewed with it. When requested, a
 * translucent paper chip lies under the lines so they stay readable;
 * `spacing` is the letter spacing in em, used for the metric and
 * set on the text. Lines sit with their baseline 0.9 em below the line top
 * and the chip allows 0.2 em more for descenders.
 */
export function surfaceText(
  text: SurfaceText,
  size: number,
  className: string,
  view: ProjectionView,
  chip = false,
  spacing = 0,
): SVGGElement {
  const group = svg('g', { transform: planeMatrix('ground', text.origin, view) }, className)
  const content = chip ? svg('g', {
    style: `--label-offset: calc(${CHIP_PAD - SURFACE_PAD}px + ${SURFACE_GAP}px * var(--weight, 1) / var(--camera-scale, 1)); transform: translate(var(--label-offset), calc(-1 * var(--label-offset)))`,
  }, 'surface-inset') : group
  if (chip) group.append(content)
  const padding = chip ? SURFACE_PAD : textPadding(size)
  const lineHeight = textLineHeight(size)
  if (chip) {
    const width = Math.max(...text.lines.map(line => textWidth(line, size, spacing)))
    content.append(svg('rect', {
      x: padding - CHIP_PAD,
      y: padding - CHIP_PAD,
      width: width + 2 * CHIP_PAD,
      height: size * 1.1 + (text.lines.length - 1) * lineHeight + 2 * CHIP_PAD,
    }, 'chip'))
  }
  text.lines.forEach((line, index) => {
    const node = svg('text', {
      x: padding,
      y: padding + size * 0.9 + index * lineHeight,
      'font-size': size,
      'letter-spacing': `${spacing}em`,
    }, 'text')
    node.textContent = line
    content.append(node)
  })
  return group
}
