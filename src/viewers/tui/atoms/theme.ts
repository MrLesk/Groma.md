import { RGBA } from '@opentui/core'
import type { NormalizedTerminalPalette } from '@opentui/core'

import type { Origin } from '../../../types.ts'

export interface ViewerTheme extends Record<Origin, RGBA> {
  background: RGBA
  foreground: RGBA
  selected: RGBA
  observedTint: RGBA
  selectedTint: RGBA
}

function mix(left: RGBA, right: RGBA, rightWeight: number): RGBA {
  const leftValues = left.toInts()
  const rightValues = right.toInts()
  const mixed = leftValues.slice(0, 3).map((value, index) => {
    return Math.round(value * (1 - rightWeight) + rightValues[index]! * rightWeight)
  })
  return RGBA.fromInts(mixed[0]!, mixed[1]!, mixed[2]!)
}

export function themeFromPalette(palette: NormalizedTerminalPalette): ViewerTheme {
  const observed = palette.palette[2]
  // Bright blue: the normal ANSI blue is barely readable on dark themes.
  const planned = palette.palette[12]
  const missing = palette.palette[1]

  return {
    background: palette.defaultBackground,
    foreground: palette.defaultForeground,
    observed,
    planned,
    missing,
    selected: observed,
    observedTint: mix(palette.defaultBackground, observed, 0.08),
    selectedTint: mix(palette.defaultBackground, observed, 0.18),
  }
}
