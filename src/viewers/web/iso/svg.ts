import type { Point } from '../../../types.ts'

const NAMESPACE = 'http://www.w3.org/2000/svg'

/** One SVG node with its attributes; strokes get `vector-effect` so they stay one pixel at every zoom. */
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number> = {},
  className = '',
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(NAMESPACE, tag)
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value))
  if (className !== '') element.setAttribute('class', className)
  if (tag === 'polygon' || tag === 'polyline' || tag === 'path' || tag === 'line') {
    element.setAttribute('vector-effect', 'non-scaling-stroke')
  }
  return element
}

export function round(value: number): number {
  return Math.round(value * 100) / 100
}

export function pointsAttribute(points: readonly Point[]): string {
  return points.map(point => `${round(point.x)},${round(point.y)}`).join(' ')
}
