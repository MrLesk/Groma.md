import type { OptimizedBuffer, RGBA } from '@opentui/core'

import { cell } from '../atoms/cell.ts'
import type { Bounds } from '../../../types.ts'

export function drawSpine(
  buffer: OptimizedBuffer,
  bounds: Bounds,
  color: RGBA,
  background: RGBA,
): void {
  for (let row = bounds.y + 1; row < bounds.y + bounds.height - 1; row += 1) {
    cell(buffer, bounds.x + 1, row, '▌', color, background)
  }
}
