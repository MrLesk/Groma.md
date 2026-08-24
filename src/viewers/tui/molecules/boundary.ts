import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer, RGBA } from '@opentui/core'

import { borderCharacters, drawBorder } from '../atoms/border.ts'
import type { BorderStyle } from '../atoms/border.ts'
import { cell } from '../atoms/cell.ts'
import { kindGlyph } from '../atoms/kind.ts'
import { text } from '../atoms/text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import { letterName } from '../projection-display.ts'
import { drawSurfacePattern } from './hatch.ts'
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
    titleBackground,
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
    color,
    titleBackground,
    titleAttributes,
  )
}

export function drawBoundary(
  buffer: OptimizedBuffer,
  element: ProjectedElement,
  projection: WorldProjection,
  theme: ViewerTheme,
  lit = false,
): void {
  const color = lit ? theme.selected : theme[element.kind]
  const background = element.origin === 'observed'
    ? theme.observedTint
    : theme.background
  const style: BorderStyle = element.display === 'system-boundary'
    ? 'system'
    : 'container'

  if (element.origin === 'observed' && element.cellBounds.width > 2 && element.cellBounds.height > 2) {
    buffer.fillRect(
      element.cellBounds.x + 1,
      element.cellBounds.y + 1,
      element.cellBounds.width - 2,
      element.cellBounds.height - 2,
      background,
    )
    drawSurfacePattern(
      buffer,
      element.cellBounds,
      element.kind,
      element.external,
      theme.missing,
      background,
    )
  }

  if (!letterName(element, projection.level)) {
    drawBorder(
      buffer,
      element.cellBounds,
      element.origin,
      color,
      background,
      style,
      TextAttributes.DIM,
    )
    return
  }

  drawTitledFrame(
    buffer,
    projection,
    theme,
    element.cellBounds,
    `${kindGlyph(element.kind)} ${element.name}`,
    element.origin,
    style,
    color,
    background,
    element.external ? TextAttributes.DIM : TextAttributes.BOLD,
  )
}

export function drawGroupBoundary(
  buffer: OptimizedBuffer,
  group: ProjectedGroup,
  projection: WorldProjection,
  theme: ViewerTheme,
): void {
  const background = theme.observedTint
  if (group.cellBounds.width > 2 && group.cellBounds.height > 2) {
    buffer.fillRect(
      group.cellBounds.x + 1,
      group.cellBounds.y + 1,
      group.cellBounds.width - 2,
      group.cellBounds.height - 2,
      background,
    )
    drawSurfacePattern(
      buffer,
      group.cellBounds,
      'group',
      false,
      theme.missing,
      background,
    )
  }
  const count = projection.elements.filter(element => {
    return element.group === group.name && element.parent === group.parent
  }).length
  drawTitledFrame(
    buffer,
    projection,
    theme,
    group.cellBounds,
    `${group.name} (${count})`,
    'observed',
    'group',
    theme.foreground,
    background,
    TextAttributes.DIM,
  )
}
