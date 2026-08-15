import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer } from '@opentui/core'

import { drawBorder } from '../atoms/border.ts'
import { cell } from '../atoms/cell.ts'
import { text } from '../atoms/text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import type { ViewerFocus, ViewerPanel, ZoomSlot } from '../navigation.ts'
import type { WorldProjection } from '../../../types.ts'

const zoomControl = '- context | containers | components +'

const zoomSlotLabel: Record<ZoomSlot, string> = {
  leave: '-',
  context: 'context',
  containers: 'containers',
  components: 'components',
  enter: '+',
}

export function footerHints(focus: ViewerFocus, panel: ViewerPanel): string {
  const hints = []
  if (focus === 'architecture') {
    hints.push('+ in', '- out')
  }
  hints.push(focus === 'zoom' ? 'z item' : 'z zoom')
  if (panel !== 'closed') hints.push(panel === 'full' ? 'f side' : 'f full')
  hints.push('R refresh')
  if (panel !== 'closed') hints.push('Esc close')
  hints.push('Ctrl+C exit')
  return hints.join('   ')
}

export function drawChrome(
  buffer: OptimizedBuffer,
  projection: WorldProjection,
  theme: ViewerTheme,
  chrome: { focus?: ViewerFocus; panel?: ViewerPanel; zoomSlot?: ZoomSlot } = {},
): void {
  const focus = chrome.focus ?? 'architecture'
  const panel = chrome.panel ?? 'closed'
  const header = { x: 0, y: 0, width: buffer.width, height: 3 }
  drawBorder(
    buffer,
    header,
    'observed',
    theme.foreground,
    theme.background,
    'card',
    TextAttributes.DIM,
  )

  const title = `${projection.levelName} · ${projection.currentName}`
  text(
    buffer,
    title,
    2,
    1,
    Math.max(0, buffer.width - 4),
    theme.foreground,
    theme.background,
    TextAttributes.BOLD,
  )
  const underlineEnd = Math.min(2 + title.length, buffer.width - 2)
  for (let column = 2; column < underlineEnd; column += 1) {
    cell(buffer, column, 2, '━', theme.selected, theme.background)
  }

  const footer = `${zoomControl}   ${footerHints(focus, panel)}`
  text(
    buffer,
    footer,
    1,
    buffer.height - 1,
    Math.max(0, buffer.width - 2),
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
    1 + zoomControl.indexOf(token),
    buffer.height - 1,
    token.length,
    theme.selected,
    theme.background,
    TextAttributes.BOLD,
  )
}
