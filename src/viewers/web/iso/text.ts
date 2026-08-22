import { ROOF_LINE_HEIGHT, ROOF_PAD } from '../../../sheet/measure.ts'
import type { SurfaceText } from './project.ts'
import { round, svg } from './svg.ts'

/**
 * Text lying on an isometric surface. The group's matrix maps plane pixels
 * (u along +gx, v along +gy, 24 per cell) onto the screen, so the lines run
 * along the surface's north-east edge and skew with it.
 */
export function surfaceText(text: SurfaceText, size: number, className: string): SVGGElement {
  const group = svg(
    'g',
    { transform: `matrix(1 0.5 -1 0.5 ${round(text.origin.x)} ${round(text.origin.y)})` },
    className,
  )
  text.lines.forEach((line, index) => {
    const node = svg('text', {
      x: ROOF_PAD,
      y: ROOF_PAD + size * 0.9 + index * ROOF_LINE_HEIGHT,
      'font-size': size,
    }, 'text')
    node.textContent = line
    group.append(node)
  })
  return group
}
