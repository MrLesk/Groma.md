import type { Point } from '../../../types.ts'
import { escaped } from '../atoms/escape.ts'

const NAMESPACE = 'http://www.w3.org/2000/svg'

function attributesOf(tag: string, attributes: Record<string, string | number>, className: string) {
  return {
    ...attributes,
    ...(className === '' ? {} : { class: className }),
    ...(['polygon', 'polyline', 'path', 'line', 'ellipse'].includes(tag)
      ? { 'vector-effect': 'non-scaling-stroke' } : {}),
  }
}

/** Shared map drawing emits SVG directly; only the browser mounts it into the DOM. Body is SVG markup. */
export function svgMarkup(tag: string, attributes: Record<string, string | number> = {}, className = '', body = ''): string {
  const fields = Object.entries(attributesOf(tag, attributes, className))
    .map(([name, value]) => ` ${name}="${escaped(String(value))}"`).join('')
  return `<${tag}${fields}>${body}</${tag}>`
}

/** One SVG node with its attributes; strokes get `vector-effect` so they stay one pixel at every zoom. */
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number> = {},
  className = '',
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(NAMESPACE, tag)
  for (const [name, value] of Object.entries(attributesOf(tag, attributes, className))) element.setAttribute(name, String(value))
  return element
}

export function round(value: number): number {
  return Math.round(value * 100) / 100
}

export function pointsAttribute(points: readonly Point[]): string {
  return points.map(point => `${round(point.x)},${round(point.y)}`).join(' ')
}
