import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer } from '@opentui/core'

import { borderCharacters, drawBorder } from '../atoms/border.ts'
import { kindGlyph } from '../../atoms/kind.ts'
import { text } from '../atoms/text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import type { ProjectedMapItem } from '../projection.ts'

/** A row wider than the building's interior ends in an ellipsis; the full name stays in the details pane. */
function fitted(row: string, width: number): string {
  return row.length <= width ? row : `${row.slice(0, Math.max(0, width - 1))}…`
}

/**
 * A component as a building: the name and kind glyph in the top border, one row per floor inside, dim.
 * The selected or touched building draws heavy in the accent with a bold name; a lit walk dims the others.
 */
export function drawBuilding(
  buffer: OptimizedBuffer,
  item: ProjectedMapItem,
  theme: ViewerTheme,
  options: { selected: boolean; dimmed: boolean; accented: boolean },
): void {
  const bounds = item.cellBounds
  const lit = options.selected || options.accented
  const color = lit ? theme.selected : theme.foreground
  const frame = lit ? TextAttributes.BOLD : options.dimmed ? TextAttributes.DIM : 0
  if (bounds.width > 2 && bounds.height > 2) {
    buffer.fillRect(bounds.x + 1, bounds.y + 1, bounds.width - 2, bounds.height - 2, theme.background)
  }
  drawBorder(buffer, bounds, borderCharacters(item.origin, 'building', lit), color, theme.background, frame)
  const name = item.kind === 'group' ? item.title : `${kindGlyph(item.kind)} ${item.title}`
  text(buffer, ` ${name} `, bounds.x + 1, bounds.y, Math.max(0, bounds.width - 2), color, theme.background, options.dimmed && !lit ? TextAttributes.DIM : TextAttributes.BOLD)
  for (const [index, row] of item.lines.entries()) {
    text(buffer, fitted(row, bounds.width - 4), bounds.x + 2, bounds.y + 1 + index, Math.max(0, bounds.width - 4), theme.foreground, theme.background, TextAttributes.DIM)
  }
}
