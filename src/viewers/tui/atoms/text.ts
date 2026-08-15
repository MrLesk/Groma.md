import type { OptimizedBuffer, RGBA } from '@opentui/core'

export function text(
  buffer: OptimizedBuffer,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  foreground: RGBA,
  background: RGBA,
  attributes = 0,
): void {
  if (maxWidth <= 0 || y < 0 || y >= buffer.height) return
  const start = Math.max(0, x)
  const skipped = start - x
  const available = Math.min(maxWidth - skipped, buffer.width - start)
  if (available <= 0) return
  buffer.drawText(
    [...value].slice(skipped, skipped + available).join(''),
    start,
    y,
    foreground,
    background,
    attributes,
  )
}
