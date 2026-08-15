import type { OptimizedBuffer, RGBA } from '@opentui/core'

import { cell } from './cell.ts'
import type { Bounds, Origin } from '../../../types.ts'

export type BorderStyle = 'card' | 'system' | 'container'

export function borderCharacters(origin: Origin, style: BorderStyle) {
  if (origin === 'observed' && style === 'system') {
    return {
      bottomLeft: '╚',
      bottomRight: '╝',
      horizontal: '═',
      topLeft: '╔',
      topRight: '╗',
      vertical: '║',
    }
  }
  if (origin === 'observed') {
    return {
      bottomLeft: '└',
      bottomRight: '┘',
      horizontal: '─',
      topLeft: '┌',
      topRight: '┐',
      vertical: '│',
    }
  }
  if (origin === 'planned') {
    return {
      bottomLeft: '└',
      bottomRight: '┘',
      horizontal: '╌',
      topLeft: '┌',
      topRight: '┐',
      vertical: '┆',
    }
  }
  return {
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '┈',
    topLeft: '┌',
    topRight: '┐',
    vertical: '┊',
  }
}

export function drawBorder(
  buffer: OptimizedBuffer,
  bounds: Bounds,
  origin: Origin,
  color: RGBA,
  background: RGBA,
  style: BorderStyle = 'card',
  attributes = 0,
): void {
  const { x, y, width, height } = bounds
  if (width < 2 || height < 2) return
  const characters = borderCharacters(origin, style)

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
