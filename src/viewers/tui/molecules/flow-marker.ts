import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer } from '@opentui/core'

import { text } from '../atoms/text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import type { ProjectedMapItem, TerminalProjection } from '../projection.ts'

export function drawFlowMarker(
  buffer: OptimizedBuffer,
  item: ProjectedMapItem,
  projection: TerminalProjection,
  theme: ViewerTheme,
  label: string,
): void {
  const bounds = item.cellBounds
  const left = Math.max(bounds.x + 1, projection.viewport.x + 1)
  const right = Math.min(
    bounds.x + bounds.width - 1,
    projection.viewport.x + projection.viewport.width - 1,
  )
  const width = Math.min([...label].length + 2, Math.max(0, right - left))
  if (width < 3) return
  const background = item.origin === 'observed'
    ? theme.background
    : theme.background
  text(
    buffer,
    ` ${label} `,
    right - width,
    Math.max(bounds.y, projection.viewport.y),
    width,
    theme.selected,
    background,
    TextAttributes.BOLD,
  )
}
