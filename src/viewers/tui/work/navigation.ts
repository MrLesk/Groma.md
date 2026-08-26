import type { ViewerAction, ViewerState } from '../navigation.ts'
import type { TerminalViewModel } from '../model.ts'
import { moveWorkFocus } from './model.ts'

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
      panes: { ...current.panes, details: work.before.details },
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
  if (current.focus === 'hierarchy') {
    if (action === 'up' || action === 'down') {
      return {
        ...current,
        work: moveWorkFocus(world.work, work, action === 'down' ? 1 : -1),
        detailsScroll: 0,
      }
    }
    if (action === 'enter' || action === 'right') {
      return {
        ...current,
        focus: 'details',
        panes: { ...current.panes, details: true },
      }
    }
    return current
  }
  if (current.focus === 'details') {
    if (action === 'up' || action === 'down') {
      return {
        ...current,
        detailsScroll: Math.max(0, current.detailsScroll + (action === 'down' ? 1 : -1)),
      }
    }
    if (action === 'left') return { ...current, focus: 'hierarchy' }
    return current
  }
  return { ...current, focus: 'hierarchy' }
}
