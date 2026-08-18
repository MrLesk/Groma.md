import type { Bounds, SemanticItem, SemanticView } from '../../types.ts'

const PAD = 12
const roleOrder = { campus: 0, named: 1, underlay: 2, mark: 3 } as const

function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function union(items: readonly SemanticItem[]): Bounds {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const item of items) {
    minX = Math.min(minX, item.bounds.x)
    minY = Math.min(minY, item.bounds.y)
    maxX = Math.max(maxX, item.bounds.x + item.bounds.width)
    maxY = Math.max(maxY, item.bounds.y + item.bounds.height)
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 1, height: 1 }
  return {
    x: minX - PAD,
    y: minY - PAD,
    width: maxX - minX + PAD * 2,
    height: maxY - minY + PAD * 2,
  }
}

function titled(item: SemanticItem): boolean {
  return item.role === 'named' || item.role === 'mark'
}

function fill(item: SemanticItem): string {
  if (item.role === 'underlay') return '#ECEAE2'
  if (item.role === 'mark') return '#FFFFFF'
  return '#FAF8F2'
}

function shape(item: SemanticItem): string {
  const { x, y, width, height } = item.bounds
  return (
    `<rect data-id="${escapeXml(item.id)}" data-role="${item.role}" ` +
    `x="${x}" y="${y}" width="${width}" height="${height}" ` +
    `fill="${fill(item)}" stroke="#26251D"/>`
  )
}

function title(item: SemanticItem): string {
  const { x, y, width, height } = item.bounds
  const named = item.role === 'named'
  const tx = named ? x + 4 : x + width / 2
  const ty = named ? y + 6 : y + height / 2
  const anchor = named ? 'start' : 'middle'
  const baseline = named ? 'hanging' : 'middle'
  return (
    `<text data-id="${escapeXml(item.id)}" x="${tx}" y="${ty}" ` +
    `text-anchor="${anchor}" dominant-baseline="${baseline}" ` +
    `font-size="8" font-family="ui-monospace,Menlo,monospace" fill="#26251D">` +
    `${escapeXml(item.name)}</text>`
  )
}

/** SVG campus for one semantic view. Titles are SVG text, not world-plane textures. */
export function campusSvg(view: SemanticView): string {
  const box = union(view.items)
  const shapes = [...view.items]
    .sort((left, right) => roleOrder[left.role] - roleOrder[right.role])
    .map(shape)
    .join('')
  const titles = view.items.filter(titled).map(title).join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="${box.x} ${box.y} ${box.width} ${box.height}">` +
    `<g data-shapes>${shapes}</g>` +
    `<g data-titles>${titles}</g>` +
    `</svg>`
  )
}
