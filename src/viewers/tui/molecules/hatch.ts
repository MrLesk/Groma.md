import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer, RGBA } from '@opentui/core'

import { cell } from '../atoms/cell.ts'
import type { Bounds } from '../../../types.ts'

export function drawHatch(
  buffer: OptimizedBuffer,
  bounds: Bounds,
  color: RGBA,
  background: RGBA,
): void {
  for (let row = bounds.y + 1; row < bounds.y + bounds.height - 1; row += 1) {
    for (let column = bounds.x + 2; column < bounds.x + bounds.width - 1; column += 1) {
      if ((column + row) % 2 === 0) {
        cell(buffer, column, row, '░', color, background, TextAttributes.DIM)
      }
    }
  }
}
