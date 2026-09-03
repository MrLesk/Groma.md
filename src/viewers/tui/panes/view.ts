import { actionCaption, actionLegs, worldCommands } from '../../action-path.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import { flowEndpointLabel, type ProjectedFlowStep } from '../flow.ts'
import type { TerminalViewModel } from '../model.ts'
import { detailsCommands, type LitAction, type ViewerState } from '../navigation.ts'
import type { TerminalProjection } from '../projection.ts'
import { semanticTreeRows } from '../tree.ts'
import { selectedWorkId, selectedWorkItem, workGroups } from '../work/model.ts'
import { footerHint, searchLine } from './chrome.ts'
import { DETAILS_TABS, detailsLines, flowLines, taskLines } from './details.ts'
import { hierarchyLines, legendLines, workListLines } from './hierarchy.ts'
import { DETAILS_CONTENT_WIDTH, HIERARCHY_CONTENT_WIDTH, type DetailsView, type ScreenView } from './screen.ts'
import { plain, type Line } from './text.ts'

function recapLine(theme: ViewerTheme, world: TerminalViewModel, workOpen: boolean): Line | undefined {
  const terminal = world.work?.statuses.at(-1)
  const groups = workGroups(world.work)
  const actionable = groups.filter(group => group.status !== terminal)
  const shown = (actionable.length === 0 ? groups : actionable).slice(0, 2)
  if (shown.length === 0) return undefined
  const counts = shown.map(group => `${group.items.length} ${group.status}`).join(' · ')
  return [plain(theme, ` Backlog · ${counts} · w ${workOpen ? 'close' : 'task details'} `)]
}

function actionTitle(world: TerminalViewModel, lit: LitAction, step: ProjectedFlowStep | undefined): string | undefined {
  const litCommand = world.relationships.find(item => item.id === lit.id)
  if (litCommand === undefined) return undefined
  const titles = new Map(world.elements.map(item => [item.representationId, item.title]))
  if (step === undefined) return actionCaption(litCommand, true, id => titles.get(id) ?? id).title
  return `leg ${step.index + 1}/${step.total} · ${flowEndpointLabel(step.source)}`
    + ` → ${flowEndpointLabel(step.target)} · ${step.description}`
}

function detailsView(
  theme: ViewerTheme,
  world: TerminalViewModel,
  state: ViewerState,
  projection: TerminalProjection,
  lit: LitAction,
  step: ProjectedFlowStep | undefined,
  commands: ReturnType<typeof worldCommands>,
): DetailsView | undefined {
  if (!state.panes.details) return undefined
  if (state.work !== undefined) {
    const item = selectedWorkItem(world.work, state.work)
    return {
      title: item?.id ?? 'Task',
      titleColor: item === undefined ? theme.foreground : theme.selected,
      lines: { lines: item === undefined ? [] : taskLines(theme, item, DETAILS_CONTENT_WIDTH) },
      scroll: state.detailsScroll,
    }
  }
  const focusedFlow = state.focus === 'hierarchy' ? commands.find(command => command.id === state.tree.cursor) : undefined
  if (focusedFlow !== undefined) {
    return {
      title: focusedFlow.description,
      titleColor: theme.selected,
      lines: { lines: flowLines(theme, focusedFlow.id === lit.id ? step : undefined, actionLegs(focusedFlow.id, world).length, DETAILS_CONTENT_WIDTH) },
      scroll: 0,
    }
  }
  const selected = world.elements.find(element => element.representationId === projection.currentId)
  if (selected === undefined) return undefined
  return {
    title: selected.title,
    titleColor: state.focus === 'details' ? theme.selected : theme[selected.origin],
    tab: DETAILS_TABS.indexOf(state.detailsTab),
    lines: detailsLines(theme, selected, world, DETAILS_CONTENT_WIDTH, state.detailsTab, state.activeActionId, state.actionCursor),
    scroll: state.detailsScroll,
  }
}

/** Everything the chrome shows for one viewer state: header, panes, recap and footer. */
export function screenView(
  theme: ViewerTheme,
  world: TerminalViewModel,
  state: ViewerState,
  projection: TerminalProjection,
  lit: LitAction,
  step: ProjectedFlowStep | undefined,
): ScreenView {
  const commands = worldCommands(world)
  const selectionId = projection.currentId ?? undefined
  const workOpen = state.work !== undefined
  const system = world.elements.find(element => element.kind === 'system' && element.origin === 'observed' && !element.external)
  const picking = !workOpen && state.focus === 'details'
    && detailsCommands(world, { currentId: selectionId, detailsTab: state.detailsTab }).length > 0
  const footer = workOpen
    ? state.focus === 'details'
      ? '↑↓ scroll   ← tasks   w close work   ] details'
      : '↑↓ task   enter details   w close work   ] details'
    : state.search !== undefined
      ? searchLine(state.search)
      : footerHint(state.focus, actionTitle(world, lit, step), picking)
  return {
    stats: system === undefined
      ? undefined
      : `${system.title} · ${commands.length} flows · ${world.elements.length} elements${workOpen ? ' · Work' : ''}`,
    focus: state.focus,
    footer,
    hierarchy: workOpen
      ? workListLines(theme, HIERARCHY_CONTENT_WIDTH, workGroups(world.work), selectedWorkId(state.work), state.focus === 'hierarchy')
      : hierarchyLines(
          theme,
          HIERARCHY_CONTENT_WIDTH,
          commands.map(command => ({ id: command.id, title: command.description })),
          semanticTreeRows(world, selectionId === undefined ? [] : [selectionId], state.tree),
          selectionId,
          state.tree.cursor ?? selectionId,
          state.activeActionId,
          state.focus === 'hierarchy',
        ),
    legend: workOpen ? undefined : legendLines(theme, HIERARCHY_CONTENT_WIDTH),
    details: detailsView(theme, world, state, projection, lit, step, commands),
    recap: recapLine(theme, world, workOpen),
  }
}
