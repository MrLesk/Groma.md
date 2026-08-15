import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer, RGBA } from '@opentui/core'

import { text } from '../atoms/text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import type { ProjectedElement } from '../../../types.ts'

export function drawChip(
  buffer: OptimizedBuffer,
  origin: ProjectedElement['origin'],
  x: number,
  y: number,
  maxWidth: number,
  theme: ViewerTheme,
  background: RGBA,
): number {
  const chip = ` ${origin} `
  text(
    buffer,
    chip,
    x,
    y,
    maxWidth,
    theme[origin],
    background,
    TextAttributes.BOLD,
  )
  return chip.length
}
