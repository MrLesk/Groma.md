import type { ViewerAction, ViewerState } from '../navigation.ts'
import type { TerminalViewModel } from '../model.ts'
import { moveWorkFocus, toggleShownStatus } from './model.ts'

/** The Work list: Up and Down walk statuses and tasks; Enter on a status header shows or hides its tasks, on a task it opens the details. */
function reduceWorkList(world: TerminalViewModel, current: ViewerState, action: ViewerAction): ViewerState {
  const work = current.work!
  if (action === 'up' || action === 'down') {
    return { ...current, work: moveWorkFocus(world, work, action === 'down' ? 1 : -1), detailsScroll: 0 }
  }
  if (action === 'enter' && work.selection.state === 'status') {
    return { ...current, work: toggleShownStatus(work, work.selection.status) }
  }
  if ((action === 'enter' || action === 'right') && work.selection.state === 'selected') {
    return { ...current, focus: 'details', panes: { ...current.panes, details: true } }
  }
  return current
}

export function reduceWorkFocus(
  world: TerminalViewModel,
  current: ViewerState,
  action: ViewerAction,
): ViewerState {
  const work = current.work!
  if (action === 'dismiss' || action === 'toggle-work') {
    return {
      ...current,
      work: undefined,
      focus: work.before.focus,
      panes: work.before.panes,
      detailsScroll: work.before.detailsScroll,
      actionCursor: work.before.actionCursor,
    }
  }
  if (action === 'toggle-details') {
    const details = !current.panes.details
    return {
      ...current,
      panes: { ...current.panes, details },
      focus: !details && current.focus === 'details' ? 'hierarchy' : current.focus,
    }
  }
  if (action === 'tab') {
    return current.panes.details
      ? { ...current, focus: current.focus === 'details' ? 'hierarchy' : 'details' }
      : { ...current, focus: 'hierarchy' }
  }
  if (current.focus === 'hierarchy') return reduceWorkList(world, current, action)
  if (current.focus === 'details') {
    if (action === 'up' || action === 'down') {
      return {
        ...current,
        detailsScroll: Math.max(0, current.detailsScroll + (action === 'down' ? 1 : -1)),
      }
    }
    if (action === 'left') return { ...current, focus: 'hierarchy' }
    if (action === 'enter' && work.selection.state === 'selected') {
      return { ...current, taskRecord: { id: work.selection.taskId }, detailsScroll: 0 }
    }
    return current
  }
  return { ...current, focus: 'hierarchy' }
}
