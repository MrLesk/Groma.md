import { RGBA } from '@opentui/core'

import type { Origin } from '../../../types.ts'
import type { TokenKind } from '../../source/highlight.ts'

/** The brand green, the one colour that is not the terminal's own. */
export const ACCENT = '#1D9E75'

export interface ViewerTheme extends Record<Origin, RGBA> {
  background: RGBA
  foreground: RGBA
  /** The palette's bright black: frames and text that stay quiet. */
  quiet: RGBA
  selected: RGBA
  added: RGBA
  removed: RGBA
  modified: RGBA
  syntax: Record<TokenKind, RGBA>
}

/**
 * Every colour is an intent the terminal resolves itself: its default foreground and
 * background, palette colors for quiet text, syntax and diffs, or the brand green. Nothing is sampled from the palette,
 * so switching the terminal theme recolours the viewer live, as the splash does.
 */
export function viewerTheme(): ViewerTheme {
  const foreground = RGBA.defaultForeground()
  const quiet = RGBA.fromIndex(8)
  return {
    background: RGBA.defaultBackground(),
    foreground,
    quiet,
    selected: RGBA.fromHex(ACCENT),
    added: RGBA.fromIndex(2),
    removed: RGBA.fromIndex(1),
    modified: RGBA.fromIndex(3),
    syntax: {
      comment: quiet,
      function: RGBA.fromIndex(3),
      keyword: RGBA.fromIndex(5),
      number: RGBA.fromIndex(6),
      string: RGBA.fromIndex(2),
      type: RGBA.fromIndex(4),
    },
    observed: foreground,
    draft: quiet,
  }
}
