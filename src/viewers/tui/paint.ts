import type { OptimizedBuffer } from '@opentui/core'

import type { ViewerTheme } from './atoms/theme.ts'
import { filterMatches } from './navigation.ts'
import type { FilterState, ViewerFocus } from './navigation.ts'
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
    detailsScroll: number
    focus?: ViewerFocus
    filter?: FilterState
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
    drawDetails(buffer, layout.details, selected, world, theme, {
      focused: options.focus === 'details',
      scroll: options.detailsScroll,
    })
  }
  drawChrome(
    buffer,
    layout,
    projection,
    theme,
    options.focus,
    options.filter && filterLine(world, options.filter),
  )
}

function filterLine(world: ArchitectureWorld, filter: FilterState): string {
  const matches = filterMatches(world, filter.query)
  const match = matches[filter.index]
  const position = match === undefined
    ? filter.query.trim().length === 0 ? '' : 'no matches'
    : `${filter.index + 1} of ${matches.length} · ${match.name}`
  return `/ ${filter.query}▏  ${position}   ↑↓ next   enter keep   esc back`
}
