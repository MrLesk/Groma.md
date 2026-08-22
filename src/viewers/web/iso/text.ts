import { ROOF_LINE_HEIGHT, ROOF_PAD } from '../../../sheet/measure.ts'
import type { SurfaceText } from './project.ts'
import { planeMatrix } from './project.ts'
import { svg } from './svg.ts'

/**
 * Text lying on a ground-plane surface: the lines are laid out in plane
 * pixels from the surface's north corner and the ground matrix lays them
 * along the surface's north-east edge, skewed with it.
 */
export function surfaceText(text: SurfaceText, size: number, className: string): SVGGElement {
  const group = svg('g', { transform: planeMatrix('ground', text.origin) }, className)
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
