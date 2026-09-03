import { RGBA } from '@opentui/core'

import type { Origin } from '../../../types.ts'

/** The brand green, the one colour that is not the terminal's own. */
export const ACCENT = '#1D9E75'

export interface ViewerTheme extends Record<Origin, RGBA> {
  background: RGBA
  foreground: RGBA
  /** The palette's bright black: frames and text that stay quiet. */
  quiet: RGBA
  selected: RGBA
}

/**
 * Every colour is an intent the terminal resolves itself: its default foreground and
 * background, its bright black, or the brand green. Nothing is sampled from the palette,
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
    observed: foreground,
    draft: quiet,
  }
}
