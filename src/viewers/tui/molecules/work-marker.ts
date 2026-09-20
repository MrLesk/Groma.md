import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer } from '@opentui/core'

import { text } from '../atoms/text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import type { ProjectedMapItem } from '../projection.ts'
import { ROW_INSET } from '../projection-root.ts'
import type { WorkCorner } from '../work/model.ts'

/**
 * The corner of a touched element: its current task and +N for the other shown tasks, future drafts marked with a
 * diamond in quiet text, in-progress work in the accent, done work dim, and the selected task bold. The marker sits
 * in the top border beside the name when it fits, else in the bottom border; on a row at the row end.
 */
export function drawWorkCorner(buffer: OptimizedBuffer, item: ProjectedMapItem, corner: WorkCorner, theme: ViewerTheme): void {
  const label = corner.others > 0 ? `${corner.taskId} +${corner.others}` : corner.taskId
  const display = corner.stage === 'todo' ? `◇ ${label}` : label
  const bounds = item.cellBounds
  const color = corner.stage === 'progress' ? theme.selected : corner.stage === 'todo' ? theme.quiet : theme.foreground
  const attributes = (corner.selected ? TextAttributes.BOLD : 0)
    | (corner.stage === 'done' || corner.stage === 'todo' ? TextAttributes.DIM : 0)
  if (item.shape === 'row') {
    const x = bounds.x + bounds.width - ROW_INSET - display.length - 1
    if (x <= bounds.x + ROW_INSET) return
    text(
      buffer,
      ` ${display}`,
      x,
      bounds.y + bounds.height - 1,
      display.length + 1,
      color,
      theme.background,
      attributes,
    )
    return
  }
  const width = display.length + 2
  const nameEnd = bounds.x + 1 + item.title.length + 4
  const x = bounds.x + bounds.width - 1 - width
  if (x < bounds.x + 1) return
  const y = nameEnd + width <= bounds.x + bounds.width - 1 ? bounds.y : bounds.y + bounds.height - 1
  text(buffer, ` ${display} `, x, y, width, color, theme.background, attributes)
}
