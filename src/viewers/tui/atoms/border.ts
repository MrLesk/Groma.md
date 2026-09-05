import type { OptimizedBuffer, RGBA } from '@opentui/core'

import { cell } from './cell.ts'
import type { Bounds, Origin } from '../../../types.ts'

/** Buildings and zones stand square; surfaces are rounded. Origin controls line style. */
export type BorderStyle = 'building' | 'surface' | 'zone'

export interface BorderCharacters {
  bottomLeft: string
  bottomRight: string
  horizontal: string
  topLeft: string
  topRight: string
  vertical: string
}

/** The frame glyphs of a style; drafts dash their lines; heavy is the box a selected surface draws. */
export function borderCharacters(origin: Origin, style: BorderStyle, heavy = false): BorderCharacters {
  const dashed = origin !== 'observed'
  if (heavy) {
    return { topLeft: '┏', topRight: '┓', bottomLeft: '┗', bottomRight: '┛', horizontal: dashed ? '┅' : '━', vertical: dashed ? '┇' : '┃' }
  }
  const lines = { horizontal: dashed ? '╌' : '─', vertical: dashed ? '┆' : '│' }
  if (style !== 'surface') return { topLeft: '┌', topRight: '┐', bottomLeft: '└', bottomRight: '┘', ...lines }
  return { topLeft: '╭', topRight: '╮', bottomLeft: '╰', bottomRight: '╯', ...lines }
}

export function drawBorder(
  buffer: OptimizedBuffer,
  bounds: Bounds,
  characters: BorderCharacters,
  color: RGBA,
  background: RGBA,
  attributes = 0,
): void {
  const { x, y, width, height } = bounds
  if (width < 2 || height < 2) return

  for (let column = x + 1; column < x + width - 1; column += 1) {
    cell(buffer, column, y, characters.horizontal, color, background, attributes)
    cell(buffer, column, y + height - 1, characters.horizontal, color, background, attributes)
  }
  for (let row = y + 1; row < y + height - 1; row += 1) {
    cell(buffer, x, row, characters.vertical, color, background, attributes)
    cell(buffer, x + width - 1, row, characters.vertical, color, background, attributes)
  }
  cell(buffer, x, y, characters.topLeft, color, background, attributes)
  cell(buffer, x + width - 1, y, characters.topRight, color, background, attributes)
  cell(buffer, x, y + height - 1, characters.bottomLeft, color, background, attributes)
  cell(buffer, x + width - 1, y + height - 1, characters.bottomRight, color, background, attributes)
}
