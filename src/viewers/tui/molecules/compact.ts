import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer } from '@opentui/core'

import { cell } from '../atoms/cell.ts'
import { text } from '../atoms/text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import type { ProjectedElement } from '../../../types.ts'

export function drawCompact(
  buffer: OptimizedBuffer,
  element: ProjectedElement,
  theme: ViewerTheme,
): void {
  const bounds = element.cellBounds
  cell(
    buffer,
    bounds.x,
    bounds.y,
    '▌',
    theme[element.origin],
    theme.background,
    TextAttributes.DIM,
  )
  text(
    buffer,
    element.name,
    bounds.x + 2,
    bounds.y,
    Math.max(0, bounds.width - 2),
    theme.foreground,
    theme.background,
    TextAttributes.DIM,
  )
}
