import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer, RGBA } from '@opentui/core'

import { borderCharacters, drawBorder } from '../atoms/border.ts'
import type { BorderStyle } from '../atoms/border.ts'
import { cell } from '../atoms/cell.ts'
import { text } from '../atoms/text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import type {
  Bounds,
  Origin,
  ProjectedElement,
  ProjectedGroup,
  WorldProjection,
} from '../../../types.ts'

function drawTitledFrame(
  buffer: OptimizedBuffer,
  projection: WorldProjection,
  theme: ViewerTheme,
  bounds: Bounds,
  name: string,
  origin: Origin,
  style: BorderStyle,
  color: RGBA,
  titleBackground: RGBA,
  titleAttributes: number,
): void {
  drawBorder(
    buffer,
    bounds,
    origin,
    color,
    theme.background,
    style,
    TextAttributes.DIM,
  )
  if (bounds.y < projection.viewport.y) {
    const characters = borderCharacters(origin, style)
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
  text(
    buffer,
    ` ${name} `,
    titleX,
    titleY,
    Math.max(0, titleRight - titleX),
    theme.foreground,
    titleBackground,
    titleAttributes,
  )
}

export function drawBoundary(
  buffer: OptimizedBuffer,
  element: ProjectedElement,
  projection: WorldProjection,
  theme: ViewerTheme,
): void {
  const color = element.origin === 'observed'
    ? theme.foreground
    : theme[element.origin]
  const background = element.origin === 'observed'
    ? theme.observedTint
    : theme.background
  const style: BorderStyle = element.display === 'system-boundary'
    ? 'system'
    : 'container'

  drawTitledFrame(
    buffer,
    projection,
    theme,
    element.cellBounds,
    element.name,
    element.origin,
    style,
    color,
    background,
    TextAttributes.BOLD,
  )
}

export function drawGroupBoundary(
  buffer: OptimizedBuffer,
  group: ProjectedGroup,
  projection: WorldProjection,
  theme: ViewerTheme,
): void {
  drawTitledFrame(
    buffer,
    projection,
    theme,
    group.cellBounds,
    group.name,
    'observed',
    'group',
    theme.foreground,
    theme.background,
    TextAttributes.DIM,
  )
}
