import type { TerminalViewModel } from './model.ts'
import type { ViewerAction, ViewerState } from './navigation.ts'

export interface HistoryState {
  cursor: number
}

/** Opens history on the shown commit, or the newest commit from Current. */
export function openHistory(world: TerminalViewModel, current: ViewerState): ViewerState {
  const selected = world.revisions?.findIndex(revision => revision.id === current.revisionId) ?? -1
  return {
    ...current,
    history: { cursor: Math.max(0, selected) },
    work: undefined,
    focus: 'hierarchy',
    panes: { ...current.panes, hierarchy: true },
    profile: false,
    keys: false,
    detailsScroll: 0,
    actionCursor: undefined,
  }
}

function chooseRevision(world: TerminalViewModel, current: ViewerState, index: number): ViewerState {
  const revision = world.revisions?.[index]
  if (revision === undefined || !revision.compatible) return current
  return {
    ...current,
    history: undefined,
    revisionId: revision.id,
    focus: 'architecture',
    taskRecord: undefined,
    sourceView: undefined,
    diffView: undefined,
    codeStructure: undefined,
    detailsScroll: 0,
  }
}

function reduceOpenHistory(
  world: TerminalViewModel,
  current: ViewerState,
  history: HistoryState,
  action: ViewerAction,
): ViewerState {
  if (action === 'toggle-history' || action === 'dismiss') {
    return { ...current, history: undefined, focus: 'architecture' }
  }
  if (action === 'up' || action === 'down') {
    const last = Math.max(0, (world.revisions?.length ?? 1) - 1)
    const step = action === 'down' ? 1 : -1
    return { ...current, history: { cursor: Math.max(0, Math.min(last, history.cursor + step)) } }
  }
  if (action === 'enter') return chooseRevision(world, current, history.cursor)
  return current
}

function reduceHistoricalWorld(
  world: TerminalViewModel,
  current: ViewerState,
  action: ViewerAction,
): ViewerState | undefined {
  if (action === 'toggle-work' && world.revision !== undefined) return current
  if (action === 'dismiss' && world.revision !== undefined) {
    return {
      ...current,
      revisionId: undefined,
      focus: 'architecture',
      actionCursor: undefined,
      detailsScroll: 0,
    }
  }
  return undefined
}

/** Moves in the revision list, chooses one compatible commit, or returns to Current. */
export function reduceHistoryNavigation(
  world: TerminalViewModel,
  current: ViewerState,
  action: ViewerAction,
): ViewerState | undefined {
  if (action === 'toggle-history' && current.history === undefined) return openHistory(world, current)
  const history = current.history
  return history === undefined
    ? reduceHistoricalWorld(world, current, action)
    : reduceOpenHistory(world, current, history, action)
}

/** A clicked history row chooses the same revision as keyboard Enter. */
export function clickHistoryRevision(
  world: TerminalViewModel,
  current: ViewerState,
  revisionId: string,
): ViewerState {
  const index = world.revisions?.findIndex(revision => revision.id === revisionId) ?? -1
  return index < 0 ? current : chooseRevision(world, current, index)
}
