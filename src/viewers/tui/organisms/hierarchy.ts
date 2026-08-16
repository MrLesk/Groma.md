import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer } from '@opentui/core'

import { cell } from '../atoms/cell.ts'
import { kindGlyph } from '../atoms/kind.ts'
import { text } from '../atoms/text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import type { TreeRow } from '../tree.ts'
import type { Bounds } from '../../../types.ts'

/** The first visible row, chosen so the cursor row stays inside the window. */
export function scrollOffset(
  cursorIndex: number,
  rowCount: number,
  height: number,
): number {
  return Math.max(
    0,
    Math.min(cursorIndex - Math.floor(height / 2), rowCount - height),
  )
}

export function drawHierarchy(
  buffer: OptimizedBuffer,
  bounds: Bounds,
  rows: TreeRow[],
  selectionId: string | undefined,
  cursorId: string | undefined,
  focused: boolean,
  theme: ViewerTheme,
): void {
  const width = Math.max(0, bounds.width - 2)
  const height = Math.max(0, bounds.height - 2)
  if (width === 0 || height === 0) return
  const cursorIndex = Math.max(0, rows.findIndex(row => row.id === cursorId))
  const scroll = scrollOffset(cursorIndex, rows.length, height)

  for (let line = 0; line < height; line += 1) {
    const row = rows[scroll + line]
    if (!row) break
    const y = bounds.y + 1 + line
    const active = focused && row.id === cursorId
    const background = active ? theme.selected : theme.background
    if (active) buffer.fillRect(bounds.x + 1, y, width, 1, background)
    if (row.id === selectionId) {
      cell(
        buffer,
        bounds.x + 1,
        y,
        '▌',
        active ? theme.background : theme.selected,
        background,
      )
    }
    const expand = row.hasChildren ? row.expanded ? '▾' : '▸' : ' '
    const suffix = row.hasChildren && !row.expanded ? ` (${row.count})` : ''
    const indent = `${'  '.repeat(row.depth)}${expand} `
    const mark = kindGlyph(row.kind)
    const name = `${row.name}${suffix}`
    const attributes = row.external ? TextAttributes.DIM : 0
    let x = bounds.x + 2
    const remaining = (): number => Math.max(0, bounds.x + 1 + width - x)
    text(buffer, indent, x, y, remaining(), active ? theme.background : theme.foreground, background)
    x += [...indent].length
    text(buffer, mark, x, y, remaining(), theme[row.kind], background, attributes)
    x += [...mark].length
    const nameColor = active ? theme.background : theme.foreground
    const nameAttributes = row.origin === 'observed' && !row.external
      ? 0
      : TextAttributes.DIM
    text(buffer, ` ${name}`, x, y, remaining(), nameColor, background, nameAttributes)
  }
}
