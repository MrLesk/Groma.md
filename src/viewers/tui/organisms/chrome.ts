import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer } from '@opentui/core'

import { drawBorder } from '../atoms/border.ts'
import { cell } from '../atoms/cell.ts'
import { text } from '../atoms/text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import type { ViewerFocus, ZoomSlot } from '../navigation.ts'
import type { PaneLayout } from '../layout.ts'
import type { WorldProjection } from '../../../types.ts'

const zoomControl = '- context | containers | components +'

const zoomSlotLabel: Record<ZoomSlot, string> = {
  leave: '-',
  context: 'context',
  containers: 'containers',
  components: 'components',
  enter: '+',
}

function footerHints(focus: ViewerFocus): string {
  const hints = []
  if (focus === 'architecture') {
    hints.push('+ in', '- out')
  }
  hints.push(focus === 'zoom' ? 'z item' : 'z zoom')
  hints.push('[ ] panes', 'R refresh')
  return hints.join('   ')
}

export function drawChrome(
  buffer: OptimizedBuffer,
  layout: PaneLayout,
  projection: WorldProjection,
  theme: ViewerTheme,
  chrome: { focus?: ViewerFocus; zoomSlot?: ZoomSlot } = {},
): void {
  const focus = chrome.focus ?? 'architecture'
  for (const pane of [layout.hierarchy, layout.map]) {
    drawBorder(
      buffer,
      pane,
      'observed',
      theme.foreground,
      theme.background,
      'card',
      TextAttributes.DIM,
    )
  }

  cell(buffer, layout.header.x, layout.header.y, '▌', theme.selected, theme.background)
  text(
    buffer,
    'groma',
    layout.header.x + 2,
    layout.header.y,
    Math.max(0, layout.header.width - 2),
    theme.foreground,
    theme.background,
    TextAttributes.BOLD,
  )
  const exitHint = 'Ctrl+C exit'
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

  const footer = `${zoomControl}   ${footerHints(focus)}`
  text(
    buffer,
    footer,
    layout.footer.x + 1,
    layout.footer.y,
    Math.max(0, layout.footer.width - 2),
    theme.foreground,
    theme.background,
  )
  const slot = focus === 'zoom'
    ? chrome.zoomSlot ?? projection.level
    : projection.level
  const token = zoomSlotLabel[slot]
  text(
    buffer,
    token,
    layout.footer.x + 1 + zoomControl.indexOf(token),
    layout.footer.y,
    token.length,
    theme.selected,
    theme.background,
    TextAttributes.BOLD,
  )
}
