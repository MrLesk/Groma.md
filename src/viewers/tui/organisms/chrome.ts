import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer } from '@opentui/core'

import { drawBorder } from '../atoms/border.ts'
import { cell } from '../atoms/cell.ts'
import { text } from '../atoms/text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import type { ViewerFocus } from '../navigation.ts'
import type { PaneLayout } from '../layout.ts'
import type { Bounds, WorldProjection } from '../../../types.ts'

/** The camera state shown beside the zoom controls. */
export function zoomReadout(zoom: number, fitZoom: number): string {
  if (Math.abs(zoom - 1) < 1e-6) return '1:1'
  if (Math.abs(zoom - fitZoom) < 1e-6) return 'fit'
  return `${Math.round(zoom * 100)}%`
}

const paneHints: Record<ViewerFocus, string> = {
  architecture: '←↑↓→ select   enter open   backspace back   tab tree',
  hierarchy: '↑↓ move   ←→ fold   enter select   tab map   [ ] panes',
  details: '↑↓ scroll   backspace back   esc map   [ ] panes',
}

function footerHint(
  focus: ViewerFocus,
  actionTitle: string | undefined,
  picking: boolean,
): string {
  if (picking) {
    return actionTitle === undefined
      ? '↑↓ action   enter pick   esc map   [ ] panes   R refresh'
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
  projection: WorldProjection,
  theme: ViewerTheme,
  focus: ViewerFocus = 'architecture',
  footerOverride?: string,
  actionTitle?: string,
  picking = false,
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

  const readout = zoomReadout(projection.camera.zoom, projection.fitZoom)
  const zoomControls = `- out   + in · ${readout}`
  text(
    buffer,
    footerOverride ?? footerHint(focus, actionTitle, picking),
    layout.footer.x + 1,
    layout.footer.y,
    Math.max(0, layout.footer.width - zoomControls.length - 3),
    theme.foreground,
    theme.background,
  )
  text(
    buffer,
    zoomControls,
    Math.max(0, layout.footer.x + layout.footer.width - zoomControls.length - 1),
    layout.footer.y,
    zoomControls.length,
    theme.foreground,
    theme.background,
  )
}
