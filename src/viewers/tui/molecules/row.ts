import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer } from '@opentui/core'

import { text } from '../atoms/text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import type { ProjectedMapItem } from '../projection.ts'
import { ROW_INSET } from '../projection-root.ts'

/** One compact container row inside a root island. */
export function drawRow(
  buffer: OptimizedBuffer,
  item: ProjectedMapItem,
  theme: ViewerTheme,
  selected: boolean,
): void {
  const bounds = item.cellBounds
  const color = selected ? theme.selected : theme.foreground
  const attributes = selected ? TextAttributes.BOLD : 0
  for (const [index, line] of item.lines.entries()) {
    const y = bounds.y + index
    if (bounds.width > 2) {
      buffer.fillRect(bounds.x + 1, y, bounds.width - 2, 1, theme.background)
    }
    let x = bounds.x + ROW_INSET
    for (const run of line.split(/(▫+)/)) {
      if (run.length === 0) continue
      const draft = run.startsWith('▫')
      const width = Math.max(0, bounds.x + bounds.width - ROW_INSET - x)
      text(
        buffer,
        run,
        x,
        y,
        width,
        color,
        theme.background,
        draft ? TextAttributes.DIM : attributes,
      )
      x += run.length
    }
  }
}
