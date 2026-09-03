import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer, RGBA } from '@opentui/core'

import { borderCharacters, drawBorder } from '../atoms/border.ts'
import type { BorderStyle } from '../atoms/border.ts'
import { cell } from '../atoms/cell.ts'
import { kindGlyph } from '../../atoms/kind.ts'
import { text } from '../atoms/text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import type { ProjectedMapItem, TerminalProjection } from '../projection.ts'

function titleColor(theme: ViewerTheme, accented: boolean): RGBA {
  return accented ? theme.selected : theme.foreground
}

function frameStyle(item: ProjectedMapItem): BorderStyle {
  if (item.kind === 'group') return 'group'
  if (item.kind === 'system') return 'system'
  return 'container'
}

function drawTitle(
  buffer: OptimizedBuffer,
  item: ProjectedMapItem,
  projection: TerminalProjection,
  color: RGBA,
  background: RGBA,
): void {
  const bounds = item.cellBounds
  const title = item.kind === 'group'
    ? item.title
    : `${kindGlyph(item.kind)} ${item.title}`
  const inset = item.kind === 'group' ? 1 : 2
  const x = Math.max(bounds.x + inset, projection.viewport.x + 1)
  const y = Math.max(bounds.y, projection.viewport.y)
  const right = Math.min(
    bounds.x + bounds.width - inset,
    projection.viewport.x + projection.viewport.width - 1,
  )
  text(
    buffer,
    ` ${title} `,
    x,
    y,
    Math.max(0, right - x),
    color,
    background,
    item.kind === 'group' ? TextAttributes.DIM : TextAttributes.BOLD,
  )
}

export function fillBoundary(
  buffer: OptimizedBuffer,
  item: ProjectedMapItem,
  theme: ViewerTheme,
): void {
  const bounds = item.cellBounds
  const background = theme.background
  if (bounds.width > 2 && bounds.height > 2) {
    buffer.fillRect(bounds.x + 1, bounds.y + 1, bounds.width - 2, bounds.height - 2, background)
  }
}

export function drawBoundaryFrame(
  buffer: OptimizedBuffer,
  item: ProjectedMapItem,
  projection: TerminalProjection,
  theme: ViewerTheme,
  accented = false,
): void {
  const bounds = item.cellBounds
  const background = theme.background
  const color = titleColor(theme, accented)
  const style = frameStyle(item)
  drawBorder(buffer, bounds, item.origin, color, background, style, TextAttributes.DIM)

  // Keep the title on the viewport edge while panning through a large surface.
  if (bounds.y < projection.viewport.y) {
    const characters = borderCharacters(item.origin, style)
    const left = Math.max(bounds.x, projection.viewport.x)
    const right = Math.min(bounds.x + bounds.width, projection.viewport.x + projection.viewport.width)
    for (let x = left; x < right; x += 1) {
      cell(buffer, x, projection.viewport.y, characters.horizontal, color, theme.background, TextAttributes.DIM)
    }
  }
  drawTitle(buffer, item, projection, color, background)
}

/** Restores the current scope title when its large boundary starts above the viewport. */
export function drawPinnedBoundaryTitle(
  buffer: OptimizedBuffer,
  item: ProjectedMapItem,
  projection: TerminalProjection,
  theme: ViewerTheme,
): void {
  if (item.cellBounds.y >= projection.viewport.y) return
  const color = titleColor(theme, item.representationId === projection.currentId)
  const background = theme.background
  const characters = borderCharacters(item.origin, frameStyle(item))
  const left = Math.max(item.cellBounds.x, projection.viewport.x)
  const right = Math.min(
    item.cellBounds.x + item.cellBounds.width,
    projection.viewport.x + projection.viewport.width,
  )
  for (let x = left; x < right; x += 1) {
    cell(buffer, x, projection.viewport.y, characters.horizontal, color, theme.background, TextAttributes.DIM)
  }
  drawTitle(buffer, item, projection, color, background)
}
