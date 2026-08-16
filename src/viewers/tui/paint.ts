import type { OptimizedBuffer } from '@opentui/core'

import type { ViewerTheme } from './atoms/theme.ts'
import type { ViewerFocus, ZoomSlot } from './navigation.ts'
import type { PaneLayout } from './layout.ts'
import { drawChrome } from './organisms/chrome.ts'
import { drawDetails } from './organisms/details.ts'
import { drawHierarchy } from './organisms/hierarchy.ts'
import { drawWorld } from './organisms/world.ts'
import { treeRows } from './tree.ts'
import type { TreeState } from './tree.ts'
import type { ArchitectureWorld, WorldProjection } from '../../types.ts'

export { themeFromPalette } from './atoms/theme.ts'

export function paintWorld(
  buffer: OptimizedBuffer,
  layout: PaneLayout,
  projection: WorldProjection,
  world: ArchitectureWorld,
  theme: ViewerTheme,
  options: {
    tree: TreeState
    focus?: ViewerFocus
    zoomSlot?: ZoomSlot
  },
): void {
  buffer.clear(theme.background)
  drawWorld(buffer, projection, theme)
  const selectionId = projection.currentId ?? undefined
  const tree = options.tree
  drawHierarchy(
    buffer,
    layout.hierarchy,
    treeRows(world, selectionId, tree),
    selectionId,
    tree.cursor ?? selectionId,
    options.focus === 'hierarchy',
    theme,
  )
  const selected = world.elements.find(element => {
    return element.representationId === projection.currentId
  })
  if (selected) {
    drawDetails(buffer, layout.details, selected, world, theme)
  }
  drawChrome(buffer, layout, projection, theme, options)
}
