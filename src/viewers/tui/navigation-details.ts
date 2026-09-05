import type { CodeFile } from '../source/structure.ts'
import type { TerminalViewModel } from './model.ts'
import type { ViewerAction, ViewerState } from './navigation.ts'
import { viewerTheme } from './atoms/theme.ts'
import { detailsContentWidth } from './layout.ts'
import { taskRecordView } from './panes/details.ts'

export interface CodeStructureState {
  elementId: string
  files: CodeFile[]
}

export interface SourceViewState {
  file: string
  line: number
  returnScroll: number
  text?: string
}

export interface DiffViewState {
  file: string
}

/** Declaration cursor stops as file:line, in authored order. */
export function declarationStops(
  state: Pick<ViewerState, 'currentId' | 'detailsTab' | 'profile' | 'keys' | 'codeStructure'>,
): string[] {
  const structure = state.codeStructure
  if (state.detailsTab !== 'how' || state.profile || state.keys || structure === undefined || structure.elementId !== state.currentId) return []
  return structure.files.flatMap(file => file.declarations.flatMap(declaration => [
    `${file.file}:${declaration.line}`,
    ...(declaration.kind === 'class' ? declaration.members.map(member => `${file.file}:${member.line}`) : []),
  ]))
}

/** Cursor stops in the selected element's details. */
function detailsStops(
  state: ViewerState,
  commandIds: readonly string[],
): string[] {
  if (state.sourceView !== undefined || state.diffView !== undefined) return []
  return [...declarationStops(state), ...commandIds]
}

/** Reads records, moves other details cursors, and opens sources, diffs or references. */
export function reduceDetailsNavigation(
  world: TerminalViewModel,
  current: ViewerState,
  action: ViewerAction,
  commandIds: readonly string[],
): ViewerState | undefined {
  if (current.taskRecord !== undefined && current.diffView === undefined) {
    if (action === 'up' || action === 'down') return moveRecordCursor(world, current, action === 'down' ? 1 : -1)
    return action === 'enter' ? openTaskRow(world, current) : undefined
  }
  const stops = detailsStops(current, commandIds)
  if (action === 'up' || action === 'down') {
    return moveDetailsCursor(current, stops, action === 'down' ? 1 : -1)
  }
  return action === 'enter' ? openDetailsCursor(current) : undefined
}

/** Read each rendered row, selecting a link only when its row is reached. */
function recordContent(world: TerminalViewModel, current: ViewerState) {
  const item = world.work?.items.find(item => item.id === current.taskRecord?.id)
  return item === undefined ? undefined : taskRecordView(viewerTheme(), item, current.taskRecord?.details, detailsContentWidth(current), current.taskRecord?.row, current.taskRecord?.diff?.files)
}

function moveRecordCursor(world: TerminalViewModel, current: ViewerState, step: 1 | -1): ViewerState {
  const content = recordContent(world, current)
  if (content === undefined) return current
  const row = Math.max(0, Math.min(content.lines.length - 1, current.taskRecord!.row + step))
  return { ...current, taskRecord: { ...current.taskRecord!, row } }
}

/** The reading row is the only authority for which task file or reference Enter opens. */
function openTaskRow(world: TerminalViewModel, current: ViewerState): ViewerState {
  const record = current.taskRecord!
  const id = recordContent(world, current)?.ids?.[record.row]
  const element = world.elements.find(item => item.id === id)
  if (element !== undefined) {
    return {
      ...current, work: undefined, taskRecord: undefined, actionCursor: undefined,
      currentId: element.representationId, level: element.kind === 'component' ? 'components' : 'context',
      focus: 'architecture', detailsScroll: 0,
    }
  }
  const task = world.work?.items.find(item => item.id === record.id)
  return id !== undefined && task?.modifiedFiles.includes(id)
    ? { ...current, diffView: { file: id }, detailsScroll: 0 }
    : current
}

function moveDetailsCursor(current: ViewerState, stops: readonly string[], step: 1 | -1): ViewerState {
  const index = stops.indexOf(current.actionCursor ?? '')
  if (stops.length === 0 || (index === stops.length - 1 && (step > 0 || current.detailsScroll > 0))) {
    return { ...current, detailsScroll: Math.max(0, current.detailsScroll + step) }
  }
  const next = index < 0
    ? (step > 0 ? 0 : stops.length - 1)
    : Math.max(0, Math.min(stops.length - 1, index + step))
  return { ...current, actionCursor: stops[next], actionStep: undefined, detailsScroll: 0 }
}

function openDetailsCursor(
  current: ViewerState,
): ViewerState | undefined {
  if (current.actionCursor === undefined) return undefined
  if (declarationStops(current).includes(current.actionCursor)) {
    const separator = current.actionCursor.lastIndexOf(':')
    const line = Number(current.actionCursor.slice(separator + 1))
    return {
      ...current,
      sourceView: { file: current.actionCursor.slice(0, separator), line, returnScroll: current.detailsScroll },
      detailsScroll: Math.max(0, line - 3),
    }
  }
  return undefined
}
