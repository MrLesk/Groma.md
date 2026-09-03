import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer } from '@opentui/core'

import { text } from '../atoms/text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import type { ProjectedMapItem, TerminalProjection } from '../projection.ts'
import type { WorkAnchor } from '../work/model.ts'

export function drawWorkMarker(
  buffer: OptimizedBuffer,
  item: ProjectedMapItem,
  projection: TerminalProjection,
  anchor: WorkAnchor,
  theme: ViewerTheme,
): void {
  const label = anchor.count === 1 ? '◆' : `◆${anchor.count}`
  const width = label.length + 2
  if (item.cellBounds.width < width + 4) return
  const x = item.cellBounds.x + item.cellBounds.width - width - 1
  const y = Math.max(item.cellBounds.y, projection.viewport.y)
  text(
    buffer,
    ` ${label} `,
    x,
    y,
    width,
    anchor.active ? theme.selected : theme.foreground,
    theme.background,
    anchor.active ? TextAttributes.BOLD : TextAttributes.DIM,
  )
}
