import type { TaskFileDiff } from '../source/diff-lines.ts'
import type { CodeFile } from '../source/structure.ts'
import type { TerminalViewModel } from './model.ts'
import type { ViewerAction, ViewerState } from './navigation.ts'

export interface CodeStructureState {
  elementId: string
  files: CodeFile[]
}

export interface SourceViewState {
  file: string
  line: number
  text?: string
}

export interface DiffViewState {
  taskId: string
  file: string
  diff?: TaskFileDiff
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

/** Cursor stops in a task record or the selected element's details. */
function detailsStops(
  world: TerminalViewModel,
  state: ViewerState,
  commandIds: readonly string[],
  taskIds: readonly string[],
): string[] {
  if (state.sourceView !== undefined || state.diffView !== undefined) return []
  if (state.taskRecord !== undefined) {
    return world.work?.items.find(item => item.id === state.taskRecord?.id)?.modifiedFiles ?? []
  }
  return [...commandIds, ...taskIds, ...declarationStops(state)]
}

/** Handles cursor movement and opens tasks, source declarations, or task diffs. */
export function reduceDetailsNavigation(
  world: TerminalViewModel,
  current: ViewerState,
  action: ViewerAction,
  commandIds: readonly string[],
  taskIds: readonly string[],
): ViewerState | undefined {
  const stops = detailsStops(world, current, commandIds, taskIds)
  if (action === 'up' || action === 'down') {
    return moveDetailsCursor(current, stops, action === 'down' ? 1 : -1)
  }
  return action === 'enter' ? openDetailsCursor(current, stops, taskIds) : undefined
}

function moveDetailsCursor(current: ViewerState, stops: readonly string[], step: 1 | -1): ViewerState {
  const index = stops.indexOf(current.actionCursor ?? '')
  if (stops.length === 0 || (index === stops.length - 1 && step > 0)) {
    return { ...current, detailsScroll: Math.max(0, current.detailsScroll + step) }
  }
  const next = index < 0
    ? (step > 0 ? 0 : stops.length - 1)
    : Math.max(0, Math.min(stops.length - 1, index + step))
  return { ...current, actionCursor: stops[next], actionStep: undefined }
}

function openDetailsCursor(
  current: ViewerState,
  stops: readonly string[],
  taskIds: readonly string[],
): ViewerState | undefined {
  if (current.actionCursor === undefined) return undefined
  if (current.taskRecord !== undefined && stops.includes(current.actionCursor)) {
    return {
      ...current,
      diffView: { taskId: current.taskRecord.id, file: current.actionCursor },
      detailsScroll: 0,
    }
  }
  if (taskIds.includes(current.actionCursor)) {
    return { ...current, taskRecord: { id: current.actionCursor }, detailsScroll: 0 }
  }
  if (declarationStops(current).includes(current.actionCursor)) {
    const separator = current.actionCursor.lastIndexOf(':')
    const line = Number(current.actionCursor.slice(separator + 1))
    return {
      ...current,
      sourceView: { file: current.actionCursor.slice(0, separator), line },
      detailsScroll: Math.max(0, line - 3),
    }
  }
  return undefined
}
