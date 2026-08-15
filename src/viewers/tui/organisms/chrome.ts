import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer } from '@opentui/core'

import { drawBorder } from '../atoms/border.ts'
import { cell } from '../atoms/cell.ts'
import { text } from '../atoms/text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import type { ViewerFocus, ViewerPanel } from '../navigation.ts'
import type { WorldProjection } from '../../../types.ts'

export function footerHints(focus: ViewerFocus, panel: ViewerPanel): string {
  const hints = [focus === 'zoom' ? 'z item' : 'z zoom']
  if (panel !== 'closed') hints.push(panel === 'full' ? 'f side' : 'f full')
  hints.push('R refresh')
  hints.push(panel === 'closed' ? 'Esc exit' : 'Esc close')
  return hints.join('   ')
}

export function drawChrome(
  buffer: OptimizedBuffer,
  projection: WorldProjection,
  theme: ViewerTheme,
  chrome: { focus?: ViewerFocus; panel?: ViewerPanel } = {},
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

  const control = '- context | containers | components +'
  const footer = `${control}   ${footerHints(focus, panel)}`
  text(
    buffer,
    footer,
    1,
    buffer.height - 1,
    Math.max(0, buffer.width - 2),
    theme.foreground,
    theme.background,
  )
  if (focus === 'zoom') {
    text(
      buffer,
      control,
      1,
      buffer.height - 1,
      control.length,
      theme.selected,
      theme.background,
      TextAttributes.BOLD,
    )
    return
  }
  text(
    buffer,
    projection.level,
    1 + control.indexOf(projection.level),
    buffer.height - 1,
    projection.level.length,
    theme.selected,
    theme.background,
    TextAttributes.BOLD,
  )
}
