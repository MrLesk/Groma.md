import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer, RGBA } from '@opentui/core'

import { drawBorder } from '../atoms/border.ts'
import { kindGlyph, kindLabel } from '../atoms/kind.ts'
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

  const mark = (kind: WorldElement['kind'], external = false): Span => {
    return {
      value: kindGlyph(kind),
      foreground: theme[kind],
      attributes: external ? TextAttributes.DIM : 0,
    }
  }
  const rows: Span[][] = [[
    mark(element.kind, element.external),
    {
      value: ` ${kindLabel(element.kind, element.external)}`,
      foreground: theme[element.kind],
      attributes: element.external ? TextAttributes.DIM : 0,
    },
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
      const peer = byId.get(otherId)
      const name = peer?.name ?? otherId
      const rest = ` · ${relationship.description}`
      const peerMark = peer === undefined ? [] : [mark(peer.kind, peer.external), plain(' ')]
      const markWidth = peer === undefined ? 0 : 2
      if (arrow.length + markWidth + name.length + rest.length <= width) {
        rows.push([dim(arrow), ...peerMark, plain(name), dim(rest)])
      } else {
        rows.push([dim(arrow), ...peerMark, plain(name)])
        for (const row of wrap(relationship.description, width - arrow.length)) {
          rows.push([dim(`${' '.repeat(arrow.length)}${row}`)])
        }
      }
    }
  }

  if (element.children.length > 0) {
    rows.push([], [header('Children')])
    for (const childId of element.children) {
      const child = byId.get(childId)
      if (child === undefined) {
        rows.push([plain(childId)])
        continue
      }
      rows.push([mark(child.kind, child.external), plain(` ${child.name}`)])
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
  view: { focused: boolean; scroll: number },
): void {
  const background = theme.background
  const color = view.focused
    ? theme.selected
    : element.origin === 'observed' ? theme.foreground : theme[element.origin]
  const width = Math.max(0, bounds.width - 4)
  const rows = detailsRows(element, world, theme, width)
  if (bounds.width > 0 && bounds.height > 0) {
    buffer.fillRect(bounds.x, bounds.y, bounds.width, bounds.height, background)
  }
  drawBorder(buffer, bounds, element.origin, color, background)
  text(
    buffer,
    ` ${element.name} `,
    bounds.x + 2,
    bounds.y,
    width,
    theme[element.origin],
    background,
    TextAttributes.BOLD,
  )

  const visibleRows = Math.max(0, bounds.height - 2)
  const scroll = Math.max(0, Math.min(view.scroll, rows.length - visibleRows))
  const maxY = bounds.y + bounds.height - 2
  let y = bounds.y + 1
  for (const row of rows.slice(scroll)) {
    if (y > maxY) return
    let x = bounds.x + 2
    for (const span of row) {
      const available = width - (x - bounds.x - 2)
      if (available <= 0) break
      text(buffer, span.value, x, y, available, span.foreground, background, span.attributes)
      x += [...span.value].length
    }
    y += 1
  }
}
