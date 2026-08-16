import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer, RGBA } from '@opentui/core'

import { drawBorder } from '../atoms/border.ts'
import { text } from '../atoms/text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import type {
  ArchitectureWorld,
  Bounds,
  WorldElement,
} from '../../../types.ts'

interface Span {
  value: string
  foreground: RGBA
  attributes: number
}

function sidePanelWidth(totalWidth: number): number {
  return Math.max(24, Math.floor(totalWidth / 3))
}

export function detailsBounds(
  width: number,
  height: number,
  panel: 'side' | 'full',
): Bounds {
  if (panel === 'full') {
    return {
      x: 1,
      y: 3,
      width: Math.max(1, width - 2),
      height: Math.max(1, height - 4),
    }
  }
  const panelWidth = sidePanelWidth(width)
  return {
    x: width - panelWidth,
    y: 3,
    width: Math.max(1, panelWidth - 1),
    height: Math.max(1, height - 4),
  }
}

function wrap(value: string, width: number): string[] {
  if (width <= 0 || value.length === 0) return []
  const lines: string[] = []
  let rest = value
  while (rest.length > 0) {
    if (rest.length <= width) {
      lines.push(rest)
      break
    }
    const slice = rest.slice(0, width)
    const breakAt = slice.lastIndexOf(' ')
    if (breakAt <= 0) {
      lines.push(slice)
      rest = rest.slice(width)
    } else {
      lines.push(slice.slice(0, breakAt))
      rest = rest.slice(breakAt + 1)
    }
  }
  return lines
}

function detailsRows(
  element: WorldElement,
  world: ArchitectureWorld,
  theme: ViewerTheme,
  width: number,
): Span[][] {
  const plain = (value: string): Span => {
    return { value, foreground: theme.foreground, attributes: 0 }
  }
  const dim = (value: string): Span => {
    return { value, foreground: theme.foreground, attributes: TextAttributes.DIM }
  }
  const header = (value: string): Span => {
    return dim(`${value} ${'─'.repeat(Math.max(0, width - value.length - 1))}`)
  }

  const kind = element.external
    ? `EXTERNAL ${element.kind.toUpperCase()}`
    : element.kind.toUpperCase()
  const rows: Span[][] = [[
    dim(kind),
    dim(' · '),
    { value: element.origin, foreground: theme[element.origin], attributes: TextAttributes.BOLD },
  ]]

  if (element.description) {
    rows.push([])
    for (const row of wrap(element.description, width)) rows.push([plain(row)])
  }

  const byId = new Map(world.elements.map(item => [item.representationId, item]))
  const relationships = world.relationships.filter(relationship => {
    return relationship.source === element.representationId
      || relationship.target === element.representationId
  })
  if (relationships.length > 0) {
    rows.push([], [header('Relationships')])
    for (const relationship of relationships) {
      const outgoing = relationship.source === element.representationId
      const arrow = outgoing ? '→ ' : '← '
      const otherId = outgoing ? relationship.target : relationship.source
      const name = byId.get(otherId)?.name ?? otherId
      const rest = ` · ${relationship.description}`
      if (arrow.length + name.length + rest.length <= width) {
        rows.push([dim(arrow), plain(name), dim(rest)])
      } else {
        rows.push([dim(arrow), plain(name)])
        for (const row of wrap(relationship.description, width - arrow.length)) {
          rows.push([dim(`${' '.repeat(arrow.length)}${row}`)])
        }
      }
    }
  }

  if (element.children.length > 0) {
    rows.push([], [header('Children')])
    for (const childId of element.children) {
      rows.push([plain(byId.get(childId)?.name ?? childId)])
    }
  }

  if (element.code.length > 0) {
    rows.push([], [header('Code')])
    for (const reference of element.code) {
      rows.push([plain(reference.file)])
      rows.push([dim(
        reference.symbol === undefined
          ? reference.scanner
          : `${reference.symbol} · ${reference.scanner}`,
      )])
    }
  }

  return rows
}

export function drawDetails(
  buffer: OptimizedBuffer,
  bounds: Bounds,
  element: WorldElement,
  world: ArchitectureWorld,
  theme: ViewerTheme,
  panel: 'side' | 'full',
): void {
  const background = theme.background
  const color = element.origin === 'observed' ? theme.foreground : theme[element.origin]
  const width = Math.max(0, bounds.width - 4)
  const rows = detailsRows(element, world, theme, width)
  // The side panel covers only as much of the map as its content needs.
  const height = panel === 'full'
    ? bounds.height
    : Math.min(bounds.height, rows.length + 2)
  const box = { ...bounds, height }
  if (box.width > 0 && box.height > 0) {
    buffer.fillRect(box.x, box.y, box.width, box.height, background)
  }
  drawBorder(buffer, box, element.origin, color, background)
  text(
    buffer,
    ` ${element.name} `,
    box.x + 2,
    box.y,
    width,
    theme[element.origin],
    background,
    TextAttributes.BOLD,
  )

  const maxY = box.y + box.height - 2
  let y = box.y + 1
  for (const row of rows) {
    if (y > maxY) return
    let x = box.x + 2
    for (const span of row) {
      const available = width - (x - box.x - 2)
      if (available <= 0) break
      text(buffer, span.value, x, y, available, span.foreground, background, span.attributes)
      x += [...span.value].length
    }
    y += 1
  }
}
