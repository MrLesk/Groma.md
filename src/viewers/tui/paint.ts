import type { OptimizedBuffer } from '@opentui/core'

import {
  actionCaption,
  actionLegs,
  elementOnPath,
  worldCommands,
} from '../action-path.ts'
import type { ViewerTheme } from './atoms/theme.ts'
import { detailsCommands, filterMatches } from './navigation.ts'
import type { DetailsTab, FilterState, ViewerFocus } from './navigation.ts'
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
    activeActionId?: string
    actionStep?: number
    actionCursor?: string
    detailsTab: DetailsTab
  },
): void {
  buffer.clear(theme.background)
  const legs = actionLegs(options.activeActionId, world)
  const pathIds = new Set(legs.map(leg => leg.id))
  const traced = options.actionStep === undefined ? undefined : legs[options.actionStep]
  const selectionId = projection.currentId ?? undefined
  drawWorld(buffer, projection, theme, {
    pathIds,
    onPath: elementId => {
      return elementId === selectionId || elementOnPath(elementId, pathIds, world)
    },
    tracedId: traced?.id,
  })
  const commands = worldCommands(world)
  const tree = options.tree
  drawHierarchy(
    buffer,
    layout.hierarchy,
    commands.map(command => ({ id: command.id, title: command.description })),
    treeRows(world, selectionId, tree),
    selectionId,
    tree.cursor ?? selectionId,
    options.activeActionId,
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
      tab: options.detailsTab,
      activeActionId: options.activeActionId,
      actionCursor: options.actionCursor,
    })
  }
  const active = world.relationships.find(item => item.id === options.activeActionId)
  const names = new Map(world.elements.map(item => [item.representationId, item.name]))
  const nameOf = (id: string): string => names.get(id) ?? id
  const actionTitle = active === undefined
    ? undefined
    : traced === undefined
      ? actionCaption(active, true, nameOf).title
      : `step ${options.actionStep! + 1}/${legs.length} · ${nameOf(traced.source)}`
        + ` → ${nameOf(traced.target)} · ${traced.description}`
  const system = world.elements.find(element =>
    element.kind === 'system' && element.origin === 'observed' && !element.external)
  drawChrome(
    buffer,
    layout,
    projection,
    theme,
    options.focus,
    options.filter && filterLine(world, options.filter),
    actionTitle,
    options.focus === 'details' && detailsCommands(world, {
      currentId: selectionId,
      detailsTab: options.detailsTab,
    }).length > 0,
    system === undefined
      ? undefined
      : `${system.name} · ${commands.length} flows · ${world.elements.length} elements`,
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
