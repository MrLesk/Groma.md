import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer } from '@opentui/core'

import { emptyWorldLines } from '../../../empty-world.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import { text } from '../atoms/text.ts'

/** Centres the one empty-project invitation in the map pane. */
export function drawEmptyWorld(
  buffer: OptimizedBuffer,
  projectTitle: string,
  theme: ViewerTheme,
): void {
  const lines = emptyWorldLines(projectTitle)
  const top = Math.max(0, Math.floor((buffer.height - lines.length) / 2))
  for (const [index, line] of lines.entries()) {
    const left = Math.max(0, Math.floor((buffer.width - [...line].length) / 2))
    text(
      buffer,
      line,
      left,
      top + index,
      buffer.width,
      index === 0 ? theme.selected : theme.foreground,
      theme.background,
      index === 0 ? TextAttributes.BOLD : 0,
    )
  }
}
