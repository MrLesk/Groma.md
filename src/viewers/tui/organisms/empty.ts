import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer } from '@opentui/core'

import { emptyWorldLines, noComponentsTitle, scannerSupportNote } from '../../../empty-world.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import { text } from '../atoms/text.ts'

function emptyLineColor(line: string, projectTitle: string, theme: ViewerTheme) {
  if (line === noComponentsTitle) return theme.selected
  if (line === projectTitle || line === scannerSupportNote) return theme.quiet
  return theme.foreground
}

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
      emptyLineColor(line, projectTitle, theme),
      theme.background,
      line === noComponentsTitle ? TextAttributes.BOLD : 0,
    )
  }
}
