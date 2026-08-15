import type { OptimizedBuffer } from '@opentui/core'

import { drawBorder } from '../atoms/border.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import type { ProjectedElement } from '../../../types.ts'

export function drawSelection(
  buffer: OptimizedBuffer,
  selected: ProjectedElement | undefined,
  theme: ViewerTheme,
): void {
  if (!selected) return
  drawBorder(
    buffer,
    {
      x: selected.cellBounds.x - 1,
      y: selected.cellBounds.y - 1,
      width: selected.cellBounds.width + 2,
      height: selected.cellBounds.height + 2,
    },
    'observed',
    theme.selected,
    theme.background,
  )
}
