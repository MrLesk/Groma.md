import type { OptimizedBuffer } from '@opentui/core'

import type { ViewerTheme } from './atoms/theme.ts'
import type { ViewerFocus, ViewerPanel } from './navigation.ts'
import { drawChrome } from './organisms/chrome.ts'
import { detailsBounds, drawDetails } from './organisms/details.ts'
import { drawWorld } from './organisms/world.ts'
import type { ArchitectureWorld, WorldProjection } from '../../types.ts'

export { themeFromPalette } from './atoms/theme.ts'

export function paintWorld(
  buffer: OptimizedBuffer,
  projection: WorldProjection,
  theme: ViewerTheme,
  options: {
    focus?: ViewerFocus
    panel?: ViewerPanel
    world?: ArchitectureWorld
  } = {},
): void {
  const focus = options.focus ?? 'architecture'
  const panel = options.panel ?? 'closed'
  buffer.clear(theme.background)
  if (panel !== 'full') {
    drawWorld(buffer, projection, theme, { showSelection: focus === 'architecture' })
  }
  if (panel !== 'closed' && options.world && projection.currentId) {
    const selected = options.world.elements.find(element => {
      return element.representationId === projection.currentId
    })
    if (selected) {
      drawDetails(
        buffer,
        detailsBounds(buffer.width, buffer.height, panel),
        selected,
        options.world,
        theme,
      )
    }
  }
  drawChrome(buffer, projection, theme, { focus, panel })
}
