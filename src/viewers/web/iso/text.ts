import { ROOF_LINE_HEIGHT, ROOF_PAD, textWidth } from '../../../sheet/measure.ts'
import type { SurfaceText } from './project.ts'
import { planeMatrix } from './project.ts'
import { svg } from './svg.ts'

/** Plane pixels the chip reaches past the text on every side. */
const CHIP_PAD = 3

/**
 * Text lying on a ground-plane surface: the lines are laid out in plane
 * pixels from the surface's north corner and the ground matrix lays them
 * along the surface's north-east edge, skewed with it. When requested, a
 * translucent paper chip lies under the lines so they stay readable;
 * `spacing` is the letter spacing in em, used for the metric and
 * set on the text. Lines sit with their baseline 0.9 em below the line top
 * and the chip allows 0.2 em more for descenders.
 */
export function surfaceText(text: SurfaceText, size: number, className: string, chip = false, spacing = 0): SVGGElement {
  const group = svg('g', { transform: planeMatrix('ground', text.origin) }, className)
  if (chip) {
    const width = Math.max(...text.lines.map(line => textWidth(line, size, spacing)))
    group.append(svg('rect', {
      x: ROOF_PAD - CHIP_PAD,
      y: ROOF_PAD - CHIP_PAD,
      width: width + 2 * CHIP_PAD,
      height: size * 1.1 + (text.lines.length - 1) * ROOF_LINE_HEIGHT + 2 * CHIP_PAD,
    }, 'chip'))
  }
  text.lines.forEach((line, index) => {
    const node = svg('text', {
      x: ROOF_PAD,
      y: ROOF_PAD + size * 0.9 + index * ROOF_LINE_HEIGHT,
      'font-size': size,
      'letter-spacing': `${spacing}em`,
    }, 'text')
    node.textContent = line
    group.append(node)
  })
  return group
}
