import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer } from '@opentui/core'

import { borderCharacters, drawBorder } from '../atoms/border.ts'
import type { BorderStyle } from '../atoms/border.ts'
import { cell } from '../atoms/cell.ts'
import { text } from '../atoms/text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import { drawChip } from './chip.ts'
import { kindLabel } from './kind-label.ts'
import type { ProjectedElement, WorldProjection } from '../../../types.ts'

export function drawBoundary(
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
  const style: BorderStyle = element.display === 'system-boundary'
    ? 'system'
    : 'container'

  drawBorder(
    buffer,
    bounds,
    element.origin,
    color,
    theme.background,
    style,
    TextAttributes.DIM,
  )
  if (bounds.y < projection.viewport.y) {
    const characters = borderCharacters(element.origin, style)
    const left = Math.max(bounds.x, projection.viewport.x)
    const right = Math.min(
      bounds.x + bounds.width,
      projection.viewport.x + projection.viewport.width,
    )
    for (let column = left; column < right; column += 1) {
      cell(
        buffer,
        column,
        projection.viewport.y,
        characters.horizontal,
        color,
        theme.background,
        TextAttributes.DIM,
      )
    }
  }

  const titleX = Math.max(bounds.x + 2, projection.viewport.x + 1)
  const titleY = Math.max(bounds.y, projection.viewport.y)
  const titleRight = Math.min(
    bounds.x + bounds.width - 2,
    projection.viewport.x + projection.viewport.width - 1,
  )
  const chipWidth = drawChip(
    buffer,
    element.origin,
    titleX,
    titleY,
    Math.max(0, titleRight - titleX),
    theme,
    background,
  )
  text(
    buffer,
    ` ${kindLabel(element)} · ${element.name} `,
    titleX + chipWidth,
    titleY,
    Math.max(0, titleRight - titleX - chipWidth),
    theme.foreground,
    background,
    TextAttributes.BOLD,
  )
}
