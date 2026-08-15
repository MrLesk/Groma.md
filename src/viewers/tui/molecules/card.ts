import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer } from '@opentui/core'

import { drawBorder } from '../atoms/border.ts'
import { text } from '../atoms/text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import { drawChip } from './chip.ts'
import { drawHatch } from './hatch.ts'
import { kindLabel } from './kind-label.ts'
import { drawSpine } from './spine.ts'
import type { ProjectedElement, WorldProjection } from '../../../types.ts'

export function drawCard(
  buffer: OptimizedBuffer,
  element: ProjectedElement,
  projection: WorldProjection,
  theme: ViewerTheme,
): void {
  const bounds = element.cellBounds
  const color = element.origin === 'observed'
    ? theme.foreground
    : theme[element.origin]
  const background = element.origin === 'observed'
    ? theme.observedTint
    : theme.background
  if (element.origin === 'observed' && bounds.width > 2 && bounds.height > 2) {
    const fill = element.representationId === projection.currentId
      ? theme.selectedTint
      : theme.observedTint
    buffer.fillRect(bounds.x + 1, bounds.y + 1, bounds.width - 2, bounds.height - 2, fill)
  }

  drawBorder(buffer, bounds, element.origin, color, background)

  if (bounds.width >= 12) {
    drawChip(buffer, element.origin, bounds.x + 1, bounds.y, bounds.width - 2, theme, background)
  }
  if (element.origin === 'missing' && bounds.width > 4 && bounds.height > 2) {
    drawHatch(buffer, bounds, theme.missing, background)
  }
  if (bounds.height < 3 || bounds.width < 8) return

  const spineColor = element.representationId === projection.currentId
    ? theme.selected
    : theme[element.origin]
  drawSpine(buffer, bounds, spineColor, background)

  const textX = bounds.x + 3
  const textWidth = Math.max(0, bounds.width - 5)
  text(
    buffer,
    element.name,
    textX,
    bounds.y + 1,
    textWidth,
    theme.foreground,
    background,
    TextAttributes.BOLD,
  )
  text(
    buffer,
    kindLabel(element),
    textX,
    bounds.y + 2,
    textWidth,
    theme.foreground,
    background,
    TextAttributes.DIM,
  )
}
