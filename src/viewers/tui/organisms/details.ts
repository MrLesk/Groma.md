import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer } from '@opentui/core'

import { drawBorder } from '../atoms/border.ts'
import { text } from '../atoms/text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import { drawChip } from '../molecules/chip.ts'
import { kindLabel } from '../molecules/kind-label.ts'
import { sidePanelWidth } from '../projection.ts'
import type {
  ArchitectureWorld,
  Bounds,
  WorldElement,
} from '../../../types.ts'

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

export function drawDetails(
  buffer: OptimizedBuffer,
  bounds: Bounds,
  element: WorldElement,
  world: ArchitectureWorld,
  theme: ViewerTheme,
): void {
  const background = theme.background
  const color = element.origin === 'observed' ? theme.foreground : theme[element.origin]
  if (bounds.width > 0 && bounds.height > 0) {
    buffer.fillRect(bounds.x, bounds.y, bounds.width, bounds.height, background)
  }
  drawBorder(buffer, bounds, element.origin, color, background)

  const x = bounds.x + 2
  const maxY = bounds.y + bounds.height - 2
  const width = Math.max(0, bounds.width - 4)
  let y = bounds.y + 1
  const byId = new Map(world.elements.map(item => [item.representationId, item]))

  function line(
    value: string,
    attributes = 0,
    foreground = theme.foreground,
  ): boolean {
    if (y > maxY) return false
    text(buffer, value, x, y, width, foreground, background, attributes)
    y += 1
    return true
  }

  function block(value: string, attributes = 0): boolean {
    for (const row of wrap(value, width)) {
      if (!line(row, attributes)) return false
    }
    return true
  }

  if (!line(element.name, TextAttributes.BOLD)) return
  if (!line(kindLabel(element), TextAttributes.DIM)) return
  if (y <= maxY && width > 0) {
    drawChip(buffer, element.origin, x, y, width, theme, background)
    y += 2
  }
  if (element.description && !block(element.description)) return
  y += 1

  const relationships = world.relationships.filter(relationship => {
    return relationship.source === element.representationId
      || relationship.target === element.representationId
  })
  if (relationships.length > 0) {
    if (!line('Relationships', TextAttributes.DIM)) return
    for (const relationship of relationships) {
      const otherId = relationship.source === element.representationId
        ? relationship.target
        : relationship.source
      const other = byId.get(otherId)
      if (!block(`${other?.name ?? otherId} · ${relationship.description}`)) return
    }
    y += 1
  }

  if (element.children.length > 0) {
    if (!line('Children', TextAttributes.DIM)) return
    for (const childId of element.children) {
      const child = byId.get(childId)
      if (!line(child?.name ?? childId)) return
    }
    y += 1
  }

  if (element.code.length === 0) return
  if (!line('Code', TextAttributes.DIM)) return
  for (const reference of element.code) {
    if (!line(reference.scanner)) return
    if (!line(reference.file)) return
    if (reference.symbol !== undefined && !line(reference.symbol)) return
  }
}
