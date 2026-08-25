import type { OptimizedBuffer } from '@opentui/core'

import {
  actionCaption,
  actionLegs,
  elementOnPath,
  worldCommands,
} from '../action-path.ts'
import type { ViewerTheme } from './atoms/theme.ts'
import { flowEndpointLabel, projectFlowStep } from './flow.ts'
import { detailsCommands, filterMatches } from './navigation.ts'
import type {
  DetailsTab,
  FilterState,
  LitAction,
  ViewerFocus,
} from './navigation.ts'
import type { PaneLayout } from './layout.ts'
import type { TerminalViewModel } from './model.ts'
import { drawChrome } from './organisms/chrome.ts'
import { drawDetails, drawFlowDetails } from './organisms/details.ts'
import { drawHierarchy } from './organisms/hierarchy.ts'
import { drawWorld } from './organisms/world.ts'
import { semanticTreeRows } from './tree.ts'
import type { TreeState } from './tree.ts'
import type { WorkMarker } from '../../types.ts'
import type { TerminalProjection } from './projection.ts'

export { themeFromPalette } from './atoms/theme.ts'

export function paintWorld(
  buffer: OptimizedBuffer,
  layout: PaneLayout,
  projection: TerminalProjection,
  world: TerminalViewModel,
  theme: ViewerTheme,
  options: {
    tree: TreeState
    detailsScroll: number
    focus?: ViewerFocus
    filter?: FilterState
    /** The committed pick; details and the flows rows mark it. */
    activeActionId?: string
    /** The walk the map lights: the details preview, or the committed pick. */
    lit: LitAction
    actionStep?: number
    actionCursor?: string
    detailsTab: DetailsTab
    work: WorkMarker[]
    animationPhase: number
  },
): void {
  buffer.clear(theme.background)
  const legs = actionLegs(options.lit.id, world, options.lit.actorId)
  const pathIds = new Set(legs.map(leg => leg.id))
  const step = projectFlowStep(
    world,
    projection,
    options.lit.id,
    options.lit.actorId,
    options.actionStep,
  )
  const selectionId = projection.currentId ?? undefined
  drawWorld(buffer, projection, theme, {
    pathIds,
    onPath: elementId => {
      return elementId === selectionId || elementOnPath(elementId, pathIds, world)
    },
    tracedId: step?.id,
    step,
    work: options.work,
    animationPhase: options.animationPhase,
  })
  const commands = worldCommands(world)
  const tree = options.tree
  drawHierarchy(
    buffer,
    layout.hierarchy,
    commands.map(command => ({ id: command.id, title: command.description })),
    semanticTreeRows(world, selectionId === undefined ? [] : [selectionId], tree),
    selectionId,
    tree.cursor ?? selectionId,
    options.activeActionId,
    options.focus === 'hierarchy',
    theme,
  )
  const selected = world.elements.find(element => {
    return element.representationId === projection.currentId
  })
  const focusedFlow = options.focus === 'hierarchy'
    ? commands.find(command => command.id === tree.cursor)
    : undefined
  if (focusedFlow) {
    drawFlowDetails(
      buffer,
      layout.details,
      focusedFlow,
      focusedFlow.id === options.lit.id ? step : undefined,
      actionLegs(focusedFlow.id, world).length,
      theme,
    )
  } else if (selected) {
    drawDetails(buffer, layout.details, selected, world, theme, {
      focused: options.focus === 'details',
      scroll: options.detailsScroll,
      tab: options.detailsTab,
      activeActionId: options.activeActionId,
      actionCursor: options.actionCursor,
      work: options.work.filter(marker => marker.elementId === selected.id),
    })
  }
  const litCommand = world.relationships.find(item => item.id === options.lit.id)
  const names = new Map(world.elements.map(item => [item.representationId, item.name]))
  const nameOf = (id: string): string => names.get(id) ?? id
  const actionTitle = litCommand === undefined
    ? undefined
    : step === undefined
      ? actionCaption(litCommand, true, nameOf).title
      : `leg ${step.index + 1}/${step.total} · ${flowEndpointLabel(step.source)}`
        + ` → ${flowEndpointLabel(step.target)} · ${step.description}`
  const system = world.elements.find(element =>
    element.kind === 'system' && element.origin === 'observed' && !element.external)
  drawChrome(
    buffer,
    layout,
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

function filterLine(world: TerminalViewModel, filter: FilterState): string {
  const matches = filterMatches(world, filter.query)
  const match = matches[filter.index]
  const position = match === undefined
    ? filter.query.trim().length === 0 ? '' : 'no matches'
    : `${filter.index + 1} of ${matches.length} · ${match.name}`
  return `/ ${filter.query}▏  ${position}   ↑↓ next   enter keep   esc back`
}
