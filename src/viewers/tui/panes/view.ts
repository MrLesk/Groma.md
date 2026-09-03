import { actionCaption, actionLegs, worldCommands } from '../../action-path.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import { flowEndpointLabel, type ProjectedFlowStep } from '../flow.ts'
import type { TerminalViewModel } from '../model.ts'
import { kindGlyph } from '../../atoms/kind.ts'
import { detailsCommands, type LitAction, type ViewerState } from '../navigation.ts'
import { ancestorOfKind } from '../navigation-spatial.ts'
import type { TerminalProjection } from '../projection.ts'
import { semanticTreeRows } from '../tree.ts'
import { mappedStatuses, selectedWorkItem, shownStatuses, workGroups, workRows, type WorkFocus } from '../work/model.ts'
import { footerHint, searchLine } from './chrome.ts'
import { DETAILS_TABS, detailsLines, diffLines, flowLines, keysLines, profileLines, sourceLines, taskLines, taskRecordLines } from './details.ts'
import { hierarchyLines, legendLines, revisionLines, workListLines } from './hierarchy.ts'
import { DETAILS_CONTENT_WIDTH, HIERARCHY_CONTENT_WIDTH, type DetailsView, type ScreenView } from './screen.ts'
import { plain, type Line, type PaneLines } from './text.ts'
import type { AnnotatedElement } from '../../../types.ts'

/** The count per status; a status that is a toggle carries its shown mark. */
function recapLine(theme: ViewerTheme, world: TerminalViewModel, focus: WorkFocus | undefined): Line | undefined {
  const groups = workGroups(world.work)
  if (groups.length === 0) return undefined
  const toggles = new Set(mappedStatuses(world))
  const shown = new Set(shownStatuses(world, focus))
  const counts = groups.map(group => {
    const mark = toggles.has(group.status) ? (shown.has(group.status) ? '✓ ' : '○ ') : ''
    return `${mark}${group.items.length} ${group.status}`
  }).join(' · ')
  return [plain(theme, ` Backlog · ${counts} · w ${focus === undefined ? 'task details' : 'close'} `)]
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
  if (state.sourceView !== undefined) {
    return { title: `${state.sourceView.file}:${state.sourceView.line}`, titleColor: theme.foreground, lines: { lines: sourceLines(theme, state.sourceView, DETAILS_CONTENT_WIDTH) }, scroll: state.detailsScroll }
  }
  if (state.diffView !== undefined) {
    return { title: state.diffView.file, titleColor: theme.foreground, lines: { lines: diffLines(theme, state.diffView, DETAILS_CONTENT_WIDTH) }, scroll: state.detailsScroll }
  }
  const record = state.taskRecord === undefined ? undefined : world.work?.items.find(item => item.id === state.taskRecord?.id)
  if (record !== undefined) {
    return { title: record.id, titleColor: theme.selected, lines: { lines: taskRecordLines(theme, record, state.taskRecord?.details, DETAILS_CONTENT_WIDTH) }, scroll: state.detailsScroll }
  }
  if (state.keys) {
    return { title: 'Keys', titleColor: theme.foreground, lines: { lines: keysLines(theme, DETAILS_CONTENT_WIDTH) }, scroll: state.detailsScroll }
  }
  if (state.profile && world.project !== undefined) {
    return {
      title: world.project.title,
      titleColor: theme.foreground,
      lines: { lines: profileLines(theme, world.project, DETAILS_CONTENT_WIDTH) },
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
  if (!state.panes.details) return undefined
  const mode = modeView(theme, world, state)
  if (mode !== undefined) return mode
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
  if (selected === undefined) return undefined
  return {
    title: selected.title,
    titleColor: state.focus === 'details' ? theme.selected : theme[selected.origin],
    tab: DETAILS_TABS.indexOf(state.detailsTab),
    lines: detailsLines(theme, selected, world, DETAILS_CONTENT_WIDTH, state.detailsTab, state.activeActionId, state.actionCursor, state.codeStructure?.elementId === selected.representationId ? state.codeStructure.files : undefined),
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
  if (state.history !== undefined) return '↑↓ revision   enter open   h close   esc close'
  if (state.work !== undefined) {
    return state.focus === 'details'
      ? '↑↓ scroll   ← tasks   w close work   ] details'
      : '↑↓ task   enter details   w close work   ] details'
  }
  if (state.search !== undefined) return searchLine(state.search)
  const picking = state.focus === 'details' && detailsCommands(world, state).length > 0
  const hint = footerHint(state.focus, actionTitle(world, lit, step), picking)
  const named = !state.panes.details && selected !== undefined
    ? `${kindGlyph(selected.kind)} ${selected.title}   ${hint}`
    : hint
  if (state.sourceView !== undefined || state.diffView !== undefined || state.taskRecord !== undefined) return `esc back   ↑↓ scroll   ${named}`
  if (state.keys) return `? close   esc close   ${named}`
  if (state.profile) return `p back   esc back   ${named}`
  return world.revision === undefined ? named : `esc Current   h history   ${named}`
}

/** The flows and tree, or the task list in Work focus; absent while the pane is folded. */
function hierarchyView(
  theme: ViewerTheme,
  world: TerminalViewModel,
  state: ViewerState,
  commands: ReturnType<typeof worldCommands>,
  selectionId: string | undefined,
): PaneLines | undefined {
  if (!state.panes.hierarchy) return undefined
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
    return workListLines(theme, HIERARCHY_CONTENT_WIDTH, workRows(world), state.work.selection, shownStatuses(world, state.work), state.focus === 'hierarchy')
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
    stats: world.revision === undefined
      ? scopeStats(world, state, selected) ?? rootStats(world, commands.length, workOpen)
      : `${world.revision.shortId} · ${world.revision.subject}`,
    focus: state.focus,
    footer: footerLine(world, state, selected, lit, step),
    hierarchy: hierarchyView(theme, world, state, commands, selectionId),
    legend: workOpen || historyOpen ? undefined : legendLines(theme, HIERARCHY_CONTENT_WIDTH),
    details: detailsView(theme, world, state, selected, lit, step, commands),
    recap: recapLine(theme, world, state.work),
  }
}
