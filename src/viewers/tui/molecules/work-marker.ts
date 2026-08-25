import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer } from '@opentui/core'

import { text } from '../atoms/text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import type { ProjectedMapItem } from '../projection.ts'

export function drawWorkMarker(
  buffer: OptimizedBuffer,
  element: ProjectedMapItem,
  assignees: string[],
  theme: ViewerTheme,
): void {
  const label = assignees.join(', ')
  const width = Math.min(label.length + 2, Math.max(0, element.cellBounds.width - 2))
  if (width <= 2) return
  text(
    buffer,
    ` ${label} `,
    element.cellBounds.x + element.cellBounds.width - width - 1,
    element.cellBounds.y,
    width,
    theme.selected,
    theme.background,
    TextAttributes.BOLD,
  )
}
