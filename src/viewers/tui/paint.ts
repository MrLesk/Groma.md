import type { OptimizedBuffer } from '@opentui/core'

import {
  actionCaption,
  actionLegs,
  elementOnPath,
  worldCommands,
} from '../action-path.ts'
import type { ViewerTheme } from './atoms/theme.ts'
import { flowEndpointLabel, projectFlowStep } from './flow.ts'
import { detailsCommands } from './navigation.ts'
import type {
  DetailsTab,
  LitAction,
  SearchState,
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
import type { TerminalProjection } from './projection.ts'
import { projectWork, selectedWorkId, selectedWorkItem, workGroups } from './work/model.ts'
import type { WorkFocus } from './work/model.ts'
import { drawWorkDetails, drawWorkList, drawWorkRecap } from './work/paint.ts'

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
    search?: SearchState
    /** The committed pick; details and the flows rows mark it. */
    activeActionId?: string
    /** The walk the map lights: the details preview, or the committed pick. */
    lit: LitAction
    actionStep?: number
    actionCursor?: string
    detailsTab: DetailsTab
    workFocus?: WorkFocus
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
  const workMap = projectWork(world, projection, options.workFocus)
  drawWorld(buffer, projection, theme, {
    pathIds,
    onPath: elementId => {
      return elementId === selectionId || elementOnPath(elementId, pathIds, world)
    },
    tracedId: step?.id,
    step,
    work: workMap,
    animationPhase: options.animationPhase,
  })
  drawWorkRecap(
    buffer,
    layout.workRecap,
    world.work,
    options.workFocus !== undefined,
    theme,
  )
  const commands = worldCommands(world)
  const tree = options.tree
  if (options.workFocus !== undefined) {
    drawWorkList(
      buffer,
      layout.hierarchy,
      workGroups(world.work),
      selectedWorkId(options.workFocus),
      options.focus === 'hierarchy',
      theme,
    )
  } else {
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
  }
  const selected = world.elements.find(element => {
    return element.representationId === projection.currentId
  })
  const focusedFlow = options.workFocus === undefined && options.focus === 'hierarchy'
    ? commands.find(command => command.id === tree.cursor)
    : undefined
  if (options.workFocus !== undefined) {
    drawWorkDetails(
      buffer,
      layout.details,
      selectedWorkItem(world.work, options.workFocus),
      options.detailsScroll,
      options.focus === 'details',
      theme,
    )
  } else if (focusedFlow) {
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
    })
  }
  const litCommand = world.relationships.find(item => item.id === options.lit.id)
  const titles = new Map(world.elements.map(item => [item.representationId, item.title]))
  const titleOf = (id: string): string => titles.get(id) ?? id
  const actionTitle = litCommand === undefined
    ? undefined
    : step === undefined
      ? actionCaption(litCommand, true, titleOf).title
      : `leg ${step.index + 1}/${step.total} · ${flowEndpointLabel(step.source)}`
        + ` → ${flowEndpointLabel(step.target)} · ${step.description}`
  const system = world.elements.find(element =>
    element.kind === 'system' && element.origin === 'observed' && !element.external)
  drawChrome(
    buffer,
    layout,
    theme,
    options.focus,
    options.workFocus === undefined
      ? options.search && searchLine(options.search)
      : options.focus === 'details'
        ? '↑↓ scroll   ← tasks   w close work   ] details'
        : '↑↓ task   enter details   w close work   ] details',
    actionTitle,
    options.workFocus === undefined && options.focus === 'details' && detailsCommands(world, {
      currentId: selectionId,
      detailsTab: options.detailsTab,
    }).length > 0,
    system === undefined
      ? undefined
      : `${system.title} · ${commands.length} flows · ${world.elements.length} elements`
        + (options.workFocus === undefined ? '' : ' · Work'),
  )
}

function searchLine(search: SearchState): string {
  const match = search.matches[search.index]
  const position = match === undefined
    ? search.query.trim().length === 0 ? '' : 'no matches'
    : `${search.index + 1} of ${search.matches.length} · ${match.title}`
  return `/ ${search.query}▏  ${position}   ↑↓ next   enter keep   esc back`
}
