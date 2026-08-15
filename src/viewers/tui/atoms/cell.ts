import type { OptimizedBuffer, RGBA } from '@opentui/core'

function inside(buffer: OptimizedBuffer, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < buffer.width && y < buffer.height
}

export function cell(
  buffer: OptimizedBuffer,
  x: number,
  y: number,
  character: string,
  foreground: RGBA,
  background: RGBA,
  attributes = 0,
): void {
  if (inside(buffer, x, y)) {
    buffer.setCell(x, y, character, foreground, background, attributes)
  }
}
