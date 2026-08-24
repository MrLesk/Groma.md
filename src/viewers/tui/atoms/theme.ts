import { RGBA } from '@opentui/core'
import type { NormalizedTerminalPalette } from '@opentui/core'

import type { C4Kind, Origin } from '../../../types.ts'

export interface ViewerTheme extends Record<Origin | C4Kind, RGBA> {
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
  const background = palette.defaultBackground
  const foreground = palette.defaultForeground
  const accent = palette.palette[2]

  return {
    background,
    foreground,
    observed: foreground,
    planned: mix(background, foreground, 0.68),
    missing: mix(background, foreground, 0.48),
    selected: accent,
    observedTint: mix(background, foreground, 0.06),
    selectedTint: mix(background, accent, 0.18),
    actor: mix(background, foreground, 0.82),
    system: mix(background, foreground, 0.92),
    container: mix(background, foreground, 0.72),
    component: mix(background, foreground, 0.82),
  }
}
