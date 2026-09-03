import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer } from '@opentui/core'

import { borderCharacters, drawBorder } from '../atoms/border.ts'
import { kindGlyph } from '../../atoms/kind.ts'
import { text } from '../atoms/text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import { drawSpine } from './spine.ts'
import type { ProjectedMapItem, TerminalProjection } from '../projection.ts'

export function drawCard(
  buffer: OptimizedBuffer,
  item: ProjectedMapItem,
  projection: TerminalProjection,
  theme: ViewerTheme,
  dimmed = false,
  accented = false,
): void {
  const bounds = item.cellBounds
  const selected = item.representationId === projection.currentId
  const color = accented || selected ? theme.selected : theme.foreground
  const background = selected
    ? theme.background
    : theme.background
  if (item.origin === 'observed' && bounds.width > 2 && bounds.height > 2) {
    buffer.fillRect(bounds.x + 1, bounds.y + 1, bounds.width - 2, bounds.height - 2, background)
  }
  drawBorder(
    buffer,
    bounds,
    borderCharacters(item.origin, item.kind === 'actor' || item.external ? 'surface' : 'building'),
    color,
    background,
    accented || selected ? TextAttributes.BOLD : dimmed || item.external ? TextAttributes.DIM : 0,
  )
  if (bounds.width < 7 || bounds.height < 3) return

  drawSpine(
    buffer,
    bounds,
    selected ? theme.selected : theme[item.origin],
    background,
  )
  const lines = item.lines.length === 0 ? [item.title] : item.lines
  const available = Math.max(0, bounds.width - 5)
  const firstY = bounds.y + Math.max(1, Math.floor((bounds.height - lines.length) / 2))
  for (const [index, line] of lines.slice(0, Math.max(1, bounds.height - 2)).entries()) {
    text(
      buffer,
      index === 0 ? `${kindGlyph(item.kind as 'actor' | 'system' | 'container' | 'component')} ${line}` : `  ${line}`,
      bounds.x + 3,
      firstY + index,
      available,
      color,
      background,
      dimmed || item.external ? TextAttributes.DIM : TextAttributes.BOLD,
    )
  }
}
