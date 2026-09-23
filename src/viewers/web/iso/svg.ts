import type { Point } from '../../../types.ts'
import { escaped } from '../atoms/escape.ts'

const NAMESPACE = 'http://www.w3.org/2000/svg'

/**
 * One SVG element as data. The shared map drawing is written once as nodes: covers and exports serialise them
 * with `markup`, and the browser draws them into its live map with `patch`.
 */
export interface SvgNode {
  readonly tag: string
  readonly attributes: Readonly<Record<string, string>>
  /** Child elements, or the text of a text element. */
  readonly children: readonly SvgNode[] | string
}

const STROKED = new Set(['polygon', 'polyline', 'path', 'line', 'ellipse'])

function attributesOf(tag: string, attributes: Record<string, string | number>, className: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const name in attributes) result[name] = String(attributes[name])
  if (className !== '') result.class = className
  if (STROKED.has(tag)) result['vector-effect'] = 'non-scaling-stroke'
  return result
}

/** One element of the shared drawing; strokes get `vector-effect` so they stay one pixel at every zoom. */
export function node(
  tag: string,
  attributes: Record<string, string | number> = {},
  className = '',
  children: readonly SvgNode[] | string = [],
): SvgNode {
  return { tag, attributes: attributesOf(tag, attributes, className), children }
}

/** SVG text for covers and static pages. */
export function markup(nodes: readonly SvgNode[]): string {
  return nodes.map(item => {
    const fields = Object.entries(item.attributes).map(([name, value]) => ` ${name}="${escaped(value)}"`).join('')
    const body = typeof item.children === 'string' ? escaped(item.children) : markup(item.children)
    return `<${item.tag}${fields}>${body}</${item.tag}>`
  }).join('')
}

/** One browser SVG node with its attributes, for scaffolding that is not part of the shared drawing. */
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number> = {},
  className = '',
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(NAMESPACE, tag)
  for (const [name, value] of Object.entries(attributesOf(tag, attributes, className))) element.setAttribute(name, value)
  return element
}

/** What `patch` last drew into each element; anything else on it, such as highlight classes, belongs to its caller. */
const drawn = new WeakMap<Element, SvgNode>()

function create(item: SvgNode): Element {
  const element = document.createElementNS(NAMESPACE, item.tag)
  for (const [name, value] of Object.entries(item.attributes)) element.setAttribute(name, value)
  if (typeof item.children === 'string') element.textContent = item.children
  else for (const child of item.children) element.append(create(child))
  drawn.set(element, item)
  return element
}

/** A class attribute's tokens, separated by whitespace as in HTML. */
function tokens(value: string | undefined): string[] {
  return value?.split(/\s+/).filter(Boolean) ?? []
}

/**
 * Writes the attributes that changed since the last drawing and removes the ones it no longer has. A class change
 * swaps only the drawing's own tokens, so the highlight classes other code toggles survive it.
 */
function writeAttributes(element: Element, before: Readonly<Record<string, string>>, after: Readonly<Record<string, string>>): void {
  if (after.class !== before.class) {
    element.classList.remove(...tokens(before.class))
    element.classList.add(...tokens(after.class))
  }
  for (const name in after) {
    if (name !== 'class' && after[name] !== before[name]) element.setAttribute(name, after[name]!)
  }
  for (const name in before) {
    if (name !== 'class' && !(name in after)) element.removeAttribute(name)
  }
}

function update(element: Element, item: SvgNode): boolean {
  const before = drawn.get(element)!
  writeAttributes(element, before.attributes, item.attributes)
  drawn.set(element, item)
  if (typeof item.children === 'string') {
    if (item.children !== before.children) element.textContent = item.children
    return false
  }
  if (typeof before.children === 'string') element.textContent = ''
  return patch(element, item.children)
}

/** What an item can reuse: the child drawn with the same `data-id` or `id`, else the next one drawn with the same tag and class. */
function matchOf(item: SvgNode): string {
  const key = item.attributes['data-id'] ?? item.attributes.id
  return key === undefined ? `${item.tag} ${item.attributes.class ?? ''}` : `#${item.tag} ${key}`
}

/** The drawn children of `parent` grouped by what they match, in document order. */
function reusableChildren(parent: Element): Map<string, Element[]> {
  const reusable = new Map<string, Element[]>()
  for (const child of parent.children) {
    const item = drawn.get(child)
    if (item === undefined) continue
    const match = matchOf(item)
    const group = reusable.get(match)
    if (group === undefined) reusable.set(match, [child])
    else group.push(child)
  }
  return reusable
}

/**
 * Draws `items` as the children of `parent`, reusing the elements already there: by `data-id` or `id` when an item
 * has one, otherwise the next one with the same tag and class. Only values that differ from the last drawing are
 * written, so attributes and classes other code set on a reused element stay. Keep such outside state on elements
 * with a `data-id` or `id`: an unkeyed element may be replaced when the drawing around it changes. Returns true when
 * elements were created or removed anywhere below `parent`.
 */
export function patch(parent: Element, items: readonly SvgNode[]): boolean {
  const reusable = reusableChildren(parent)
  let changed = false
  const elements = items.map(item => {
    const element = reusable.get(matchOf(item))?.shift()
    if (element === undefined) {
      changed = true
      return create(item)
    }
    if (update(element, item)) changed = true
    return element
  })
  for (const unused of [...reusable.values()].flat()) {
    unused.remove()
    changed = true
  }
  let cursor = parent.firstElementChild
  for (const element of elements) {
    if (element === cursor) cursor = cursor.nextElementSibling
    else parent.insertBefore(element, cursor)
  }
  return changed
}

export function round(value: number): number {
  return Math.round(value * 100) / 100
}

export function pointsAttribute(points: readonly Point[]): string {
  return points.map(point => `${round(point.x)},${round(point.y)}`).join(' ')
}
