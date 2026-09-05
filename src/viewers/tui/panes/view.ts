import { actionCaption, actionLegs, worldCommands } from '../../action-path.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import { flowEndpointLabel, type ProjectedFlowStep } from '../flow.ts'
import type { TerminalViewModel } from '../model.ts'
import { detailsTabs, type LitAction, type ViewerState } from '../navigation.ts'
import { detailsContentWidth, terminalLayout } from '../layout.ts'
import { ancestorOfKind, canEnter } from '../navigation-spatial.ts'
import type { TerminalProjection } from '../projection.ts'
import { semanticTreeRows } from '../tree.ts'
import { selectedWorkItem, shownStatuses, workGroups, workRows } from '../work/model.ts'
import { footerHint, searchLine } from './chrome.ts'
import { DETAILS_TABS, detailsLines, flowLines, keysLines, profileLines, taskLines, taskRecordView } from './details.ts'
import { diffLines, sourceLines } from './code.ts'
import { hierarchyLines, legendLines, revisionLines, workListLines } from './hierarchy.ts'
import { HIERARCHY_CONTENT_WIDTH, type DetailsView, type ScreenView } from './screen.ts'
import { plain, type Line, type PaneLines } from './text.ts'
import type { AnnotatedElement } from '../../../types.ts'

/** A compact entry to Backlog, centered below the architecture canvas. */
function recapLine(theme: ViewerTheme, world: TerminalViewModel, width: number): Line | undefined {
  const groups = workGroups(world.work)
  if (groups.length === 0) return undefined
  const counts = groups.map(group => `${group.items.length} ${group.status}`).join(' · ')
  const summary = ` [w] Backlog · ${counts} `
  return [plain(theme, summary.length + 2 <= width ? summary : ` [w] Backlog · ${world.work!.items.length} tasks `)]
}

function actionTitle(world: TerminalViewModel, lit: LitAction, step: ProjectedFlowStep | undefined): string | undefined {
  const litCommand = world.relationships.find(item => item.id === lit.id)
  if (litCommand === undefined) return undefined
  const titles = new Map(world.elements.map(item => [item.representationId, item.title]))
  if (step === undefined) return actionCaption(litCommand, true, id => titles.get(id) ?? id).title
  return `leg ${step.index + 1}/${step.total} · ${flowEndpointLabel(step.source)}`
    + ` → ${flowEndpointLabel(step.target)} · ${step.description}`
}

/** Inside a container map: the scope path with its component count. */
function scopeStats(world: TerminalViewModel, state: ViewerState, selected: AnnotatedElement | undefined): string | undefined {
  if (state.level !== 'components') return undefined
  const byId = new Map(world.elements.map(item => [item.representationId, item]))
  const container = ancestorOfKind(selected, 'container', byId)
  if (container === undefined) return undefined
  const system = ancestorOfKind(container, 'system', byId)
  return `${system === undefined ? '' : `${system.title} › `}${container.title} · ${container.children.length} components`
}

function rootStats(world: TerminalViewModel, flows: number, workOpen: boolean): string | undefined {
  const system = world.elements.find(element => element.kind === 'system' && element.origin === 'observed' && !element.external)
  if (system === undefined) return undefined
  return `${system.title} · ${flows} flows · ${world.elements.length} elements${workOpen ? ' · Work' : ''}`
}

/** The keys box or the project profile, shown over whatever the pane held. */
function modeView(theme: ViewerTheme, world: TerminalViewModel, state: ViewerState): DetailsView | undefined {
  const width = detailsContentWidth(state)
  if (state.keys) {
    return { title: 'Keys', titleColor: theme.foreground, lines: { lines: keysLines(theme, width) }, scroll: state.detailsScroll }
  }
  if (state.sourceView !== undefined) {
    return { title: `${state.sourceView.file}:${state.sourceView.line}`, titleColor: theme.foreground, lines: { lines: sourceLines(theme, state.sourceView, width) }, scroll: state.detailsScroll }
  }
  if (state.diffView !== undefined) {
    const file = state.diffView.file
    const diff = state.taskRecord?.diff?.files.find(candidate => candidate.file === file)
    return { title: file, titleColor: theme.foreground, lines: { lines: diffLines(theme, { file, diff }, width) }, scroll: state.detailsScroll }
  }
  const record = state.taskRecord === undefined ? undefined : world.work?.items.find(item => item.id === state.taskRecord?.id)
  if (record !== undefined) {
    return { title: record.id, titleColor: theme.selected, lines: taskRecordView(theme, record, state.taskRecord?.details, width, state.taskRecord?.row, state.taskRecord?.diff?.files), scroll: 0 }
  }
  if (state.profile && world.project !== undefined) {
    return {
      title: world.project.title,
      titleColor: theme.foreground,
      lines: { lines: profileLines(theme, world.project, width) },
      scroll: state.detailsScroll,
    }
  }
  return undefined
}

function detailsView(
  theme: ViewerTheme,
  world: TerminalViewModel,
  state: ViewerState,
  selected: AnnotatedElement | undefined,
  lit: LitAction,
  step: ProjectedFlowStep | undefined,
  commands: ReturnType<typeof worldCommands>,
): DetailsView | undefined {
  if (!terminalLayout(state).details) return undefined
  const width = detailsContentWidth(state)
  const mode = modeView(theme, world, state)
  if (mode !== undefined) return mode
  if (state.work !== undefined) {
    const item = selectedWorkItem(world.work, state.work)
    return {
      title: item?.id ?? 'Task',
      titleColor: item === undefined ? theme.foreground : theme.selected,
      lines: { lines: item === undefined ? [] : taskLines(theme, item, width) },
      scroll: state.detailsScroll,
    }
  }
  const focusedFlow = state.focus === 'hierarchy' ? commands.find(command => command.id === state.tree.cursor) : undefined
  if (focusedFlow !== undefined) {
    return {
      title: focusedFlow.description,
      titleColor: theme.selected,
      lines: { lines: flowLines(theme, focusedFlow.id === lit.id ? step : undefined, actionLegs(focusedFlow.id, world).length, width, world, focusedFlow) },
      scroll: 0,
    }
  }
  if (selected === undefined) return undefined
  return {
    title: selected.title,
    titleColor: state.focus === 'details' ? theme.selected : theme[selected.origin],
    tab: selected.kind === 'actor' ? undefined : DETAILS_TABS.indexOf(state.detailsTab),
    tabCount: detailsTabs(world, selected.representationId).length,
    lines: selectedDetails(theme, world, state, selected),
    scroll: state.detailsScroll,
  }
}

/** The focus hint; with the details folded the footer is the only place that names the selection. */
function footerLine(
  world: TerminalViewModel,
  state: ViewerState,
  selected: AnnotatedElement | undefined,
  lit: LitAction,
  step: ProjectedFlowStep | undefined,
): string {
  if (state.history !== undefined) return '[↑↓] Revision  [Enter] Open  [h] Close  [Esc] Close  [?] Help'
  if (state.work !== undefined) {
    return state.focus === 'details'
      ? '[↑↓] Read  [Enter] Open  [t] Hierarchy  [Esc] Back  [?] Help'
      : '[↑↓] Select  [Enter] Open/fold  [Space] Show/hide  [d] Details  [Esc] Map  [?] Help'
  }
  if (state.search !== undefined) return searchLine(state.search)
  const hint = footerHint(state.focus, actionTitle(world, lit, step), selected !== undefined && canEnter(selected))
  if (state.sourceView !== undefined || state.diffView !== undefined || state.taskRecord !== undefined) return '[↑↓] Read  [Enter] Open  [t] Hierarchy  [Esc] Back  [?] Help'
  if (state.keys) return '[?] Close  [↑↓] Scroll  [Esc] Close'
  if (state.profile) return '[p] Back  [↑↓] Scroll  [Esc] Back  [?] Help'
  if (state.focus === 'hierarchy' && worldCommands(world).some(command => command.id === state.tree.cursor)) {
    return '[↑↓] Browse  [Space/Enter] Toggle flow  [x] Clear  [s] Step  [Esc] Map  [?] Help'
  }
  return focusedDetailsHint(state, selected) ?? hint
}

function focusedDetailsHint(state: ViewerState, selected: AnnotatedElement | undefined): string | undefined {
  if (state.focus !== 'details') return undefined
  if (state.detailsTab === 'tasks') return '[↑↓] Select  [Enter] Open/fold  [Tab] Tabs  [t] Hierarchy  [Esc] Map  [?] Help'
  if (selected?.kind === 'actor') return '[↑↓] Browse  [Space/Enter] Toggle flow  [t] Hierarchy  [Esc] Map  [?] Help'
  return undefined
}

/** The flows and tree, or the task list in Work focus; absent while the pane is folded. */
function hierarchyView(
  theme: ViewerTheme,
  world: TerminalViewModel,
  state: ViewerState,
  commands: ReturnType<typeof worldCommands>,
  selectionId: string | undefined,
): PaneLines | undefined {
  if (!terminalLayout(state).hierarchy) return undefined
  if (state.history !== undefined) {
    return revisionLines(
      theme,
      HIERARCHY_CONTENT_WIDTH,
      world.revisions ?? [],
      state.history.cursor,
      world.revision?.id,
      state.focus === 'hierarchy',
    )
  }
  if (state.work !== undefined) {
    return workListLines(theme, HIERARCHY_CONTENT_WIDTH, workRows(world, state.work), state.work.selection, shownStatuses(world, state.work), state.focus === 'hierarchy')
  }
  return hierarchyLines(
    theme,
    HIERARCHY_CONTENT_WIDTH,
    commands.map(command => ({ id: command.id, title: command.description })),
    semanticTreeRows(world, selectionId === undefined ? [] : [selectionId], state.tree),
    selectionId,
    state.tree.cursor ?? selectionId,
    state.activeActionId,
    state.focus === 'hierarchy',
  )
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
  const selected = world.elements.find(element => element.representationId === selectionId)
  const workOpen = state.work !== undefined
  const historyOpen = state.history !== undefined
  return {
    layout: terminalLayout(state),
    stats: world.revision === undefined
      ? scopeStats(world, { ...state, level: projection.level }, selected) ?? rootStats(world, commands.length, workOpen)
      : `${world.revision.shortId} · ${world.revision.subject}`,
    focus: state.focus,
    footer: footerLine(world, state, selected, lit, step),
    hierarchy: hierarchyView(theme, world, state, commands, selectionId),
    legend: workOpen || historyOpen ? undefined : legendLines(theme, HIERARCHY_CONTENT_WIDTH),
    details: detailsView(theme, world, state, selected, lit, step, commands),
    recap: recapLine(theme, world, terminalLayout(state).mapWidth),
  }
}

function selectedDetails(theme: ViewerTheme, world: TerminalViewModel, state: ViewerState, selected: AnnotatedElement): PaneLines {
  const structure = state.codeStructure?.elementId === selected.representationId ? state.codeStructure.files : undefined
  return detailsLines(theme, selected, world, detailsContentWidth(state), state.detailsTab, state.activeActionId, state.actionCursor, structure, state.workList)
}
