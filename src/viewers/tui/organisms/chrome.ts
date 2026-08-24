import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer } from '@opentui/core'

import { drawBorder } from '../atoms/border.ts'
import { cell } from '../atoms/cell.ts'
import { text } from '../atoms/text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import type { ViewerFocus } from '../navigation.ts'
import type { PaneLayout } from '../layout.ts'
import type { Bounds } from '../../../types.ts'

const paneHints: Record<ViewerFocus, string> = {
  architecture: '←↑↓→ select   enter open   backspace back   tab tree',
  hierarchy: '↑↓ move   ←→ fold   enter select   tab map   ] details',
  details: '↑↓ scroll   t tab   backspace back   esc map',
}

function footerHint(
  focus: ViewerFocus,
  actionTitle: string | undefined,
  picking: boolean,
): string {
  if (picking) {
    return actionTitle === undefined
      ? '↑↓ action   enter pick   t tab   esc map'
      : '↑↓ action   enter pick   x clear   esc map'
  }
  if (actionTitle !== undefined) {
    if (focus === 'architecture') {
      return `${actionTitle}   s step   x clear   enter open`
    }
    if (focus === 'hierarchy') {
      return `${actionTitle}   s step   x clear   enter select`
    }
    return `${actionTitle}   s step   x clear   esc map`
  }
  return paneHints[focus]
}

export function drawChrome(
  buffer: OptimizedBuffer,
  layout: PaneLayout,
  theme: ViewerTheme,
  focus: ViewerFocus = 'architecture',
  footerOverride?: string,
  actionTitle?: string,
  picking = false,
  stats?: string,
): void {
  const panes: Array<[ViewerFocus, Bounds]> = [
    ['hierarchy', layout.hierarchy],
    ['architecture', layout.map],
  ]
  for (const [paneFocus, pane] of panes) {
    const focused = focus === paneFocus
    drawBorder(
      buffer,
      pane,
      'observed',
      focused ? theme.selected : theme.foreground,
      theme.background,
      'card',
      focused ? 0 : TextAttributes.DIM,
    )
  }

  const wordmark = 'groma'
  cell(buffer, layout.header.x, layout.header.y, '▌', theme.selected, theme.background)
  text(
    buffer,
    wordmark,
    layout.header.x + 2,
    layout.header.y,
    Math.max(0, layout.header.width - 2),
    theme.foreground,
    theme.background,
    TextAttributes.BOLD,
  )
  const exitHint = 'Ctrl+C exit'
  if (stats !== undefined) {
    const statsX = layout.header.x + 2 + wordmark.length + 3
    text(
      buffer,
      stats,
      statsX,
      layout.header.y,
      Math.max(0, layout.header.width - (statsX - layout.header.x) - exitHint.length - 3),
      theme.foreground,
      theme.background,
      TextAttributes.DIM,
    )
  }
  text(
    buffer,
    exitHint,
    Math.max(0, layout.header.x + layout.header.width - exitHint.length - 1),
    layout.header.y,
    exitHint.length,
    theme.foreground,
    theme.background,
    TextAttributes.DIM,
  )

  text(
    buffer,
    footerOverride ?? footerHint(focus, actionTitle, picking),
    layout.footer.x + 1,
    layout.footer.y,
    Math.max(0, layout.footer.width - 2),
    theme.foreground,
    theme.background,
  )
}
