import type { ViewerAction, ViewerState } from '../navigation.ts'
import type { TerminalViewModel } from '../model.ts'
import { foldWorkStatus, initialWorkFocus, moveWorkFocus, selectedWorkItem, toggleShownStatus, workRowId, workRows, workRowSelection } from './model.ts'
import { reduceDetailsNavigation } from '../navigation-details.ts'

/** Both task lists open the same record and map attention. */
export function openWorkTask(world: TerminalViewModel, current: ViewerState, taskId: string): ViewerState {
  const work = current.work ?? initialWorkFocus(world.work, current, current.workList)
  return {
    ...current, work: { ...work, selection: { state: 'selected', taskId } },
    taskRecord: { id: taskId, row: 0 }, focus: 'details', panes: { hierarchy: true, details: true },
    actionCursor: undefined, detailsScroll: 0,
  }
}

/** Enter folds a status or opens a task; Space alone controls map visibility. */
function reduceWorkList(world: TerminalViewModel, current: ViewerState, action: ViewerAction): ViewerState {
  const work = current.work!
  if (action === 'up' || action === 'down') {
    return { ...current, work: moveWorkFocus(world, work, action === 'down' ? 1 : -1), taskRecord: undefined, actionCursor: undefined, detailsScroll: 0 }
  }
  const status = work.selection.state === 'status' ? work.selection.status : selectedWorkItem(world.work, work)?.status
  if ((action === 'left' || action === 'right') && status !== undefined) {
    return { ...current, work: foldWorkStatus(world, work, status, action === 'right') }
  }
  if (action === 'enter' && work.selection.state === 'status') {
    return { ...current, work: foldWorkStatus(world, work, work.selection.status, !work.expanded?.includes(work.selection.status)) }
  }
  if (action === 'toggle-selection' && work.selection.state === 'status') {
    return { ...current, work: toggleShownStatus(work, work.selection.status) }
  }
  if (action === 'enter' && work.selection.state === 'selected') {
    return openWorkTask(world, current, work.selection.taskId)
  }
  return current
}

/** Component tasks share browsing and opening, while map visibility belongs to the hierarchy. */
export function reduceComponentTasks(world: TerminalViewModel, current: ViewerState, action: ViewerAction): ViewerState {
  if (action === 'toggle-selection') return current
  const rows = workRows(world, current.workList, current.currentId)
  const row = rows.find(row => workRowId(row) === current.actionCursor)
  const work = { ...initialWorkFocus(world.work, current, current.workList), selection: row === undefined ? { state: 'cleared' as const } : workRowSelection(row) }
  const next = action === 'up' || action === 'down'
    ? { ...current, work: moveWorkFocus(world, work, action === 'down' ? 1 : -1, current.currentId) }
    : reduceWorkList(world, { ...current, work }, action)
  if (next.taskRecord !== undefined) return next
  const selection = next.work!.selection
  const cursor = selection.state === 'selected' ? selection.taskId : selection.state === 'status' ? `status:${selection.status}` : undefined
  return { ...next, work: undefined, workList: { shown: next.work!.shown, expanded: next.work!.expanded }, actionCursor: cursor, detailsScroll: 0 }
}

export function reduceWorkFocus(
  world: TerminalViewModel,
  current: ViewerState,
  action: ViewerAction,
): ViewerState | undefined {
  const closed = closeWorkMode(current, action)
  if (closed !== undefined) return closed
  if (current.focus === 'hierarchy') return reduceWorkList(world, current, action)
  return current.focus === 'details' ? reduceWorkDetails(world, current, action) : undefined
}

function reduceWorkDetails(world: TerminalViewModel, current: ViewerState, action: ViewerAction): ViewerState {
  const work = current.work!
  if (current.taskRecord !== undefined) {
    const handled = reduceDetailsNavigation(world, current, action, [])
    return handled ?? current
  }
  if (action === 'up' || action === 'down') {
    return {
      ...current,
      detailsScroll: Math.max(0, current.detailsScroll + (action === 'down' ? 1 : -1)),
    }
  }
  if (action === 'enter' && work.selection.state === 'selected') {
    return openWorkTask(world, current, work.selection.taskId)
  }
  return current
}

function closeWorkMode(current: ViewerState, action: ViewerAction): ViewerState | undefined {
  const work = current.work!
  if (action === 'dismiss' && current.keys) return { ...current, keys: false, focus: 'architecture', detailsScroll: 0 }
  if (action === 'dismiss' && current.diffView !== undefined) return { ...current, diffView: undefined, detailsScroll: 0 }
  if (action === 'dismiss' || action === 'toggle-work') {
    return {
      ...current,
      work: undefined,
      workList: { shown: work.shown, expanded: work.expanded },
      focus: 'architecture',
      panes: work.before.panes,
      detailsScroll: work.before.detailsScroll,
      actionCursor: work.before.actionCursor,
      taskRecord: undefined,
      diffView: undefined,
    }
  }
  return undefined
}
