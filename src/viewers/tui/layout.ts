import type { ViewerState } from './navigation.ts'

export const HIERARCHY_PANE_WIDTH = 26
export const DETAILS_PANE_WIDTH = 32
export const READING_CONTENT_WIDTH = 80

export interface PaneVisibility {
  hierarchy: boolean
  details: boolean
}

/**
 * How the panes start at a terminal width, keeping the map at least 60 columns:
 * both open at 120 and wider, the hierarchy alone from 90 to 119, none under 90.
 */
export function panesForWidth(width: number): PaneVisibility {
  return { hierarchy: width >= 90, details: width >= 120 }
}

/** Reserve at least forty map columns; the pane receiving keys stays open. */
export function fitPanes(width: number, panes: PaneVisibility, focus: 'architecture' | 'hierarchy' | 'details'): PaneVisibility {
  const next = { ...panes }
  const available = (): number => width - 2 - (next.hierarchy ? HIERARCHY_PANE_WIDTH : 0) - (next.details ? DETAILS_PANE_WIDTH : 0)
  if (available() >= 40) return next
  if (focus === 'details') next.hierarchy = false
  else next.details = false
  if (available() < 40 && focus === 'architecture') next.hierarchy = false
  return next
}

/** Reading temporarily borrows the map's space; the user's normal pane choices stay intact. */
export function terminalLayout(state: ViewerState): PaneVisibility & { map: boolean; detailsWidth: number; mapWidth: number } {
  const roomForTask = state.taskRecord !== undefined
    && state.terminalWidth >= READING_CONTENT_WIDTH + 4 + 42 + (state.panes.hierarchy ? HIERARCHY_PANE_WIDTH : 0)
  const reading = (state.focus === 'details' || roomForTask) && !state.keys
    && (state.taskRecord !== undefined || state.sourceView !== undefined || state.diffView !== undefined)
  const detailsWidth = reading ? Math.min(READING_CONTENT_WIDTH + 4, state.terminalWidth) : DETAILS_PANE_WIDTH
  const remaining = state.terminalWidth - detailsWidth
  const panes = reading
    ? { details: state.panes.details, hierarchy: state.panes.hierarchy && remaining >= HIERARCHY_PANE_WIDTH + 42 }
    : fitPanes(state.terminalWidth, state.panes, state.focus)
  return {
    ...panes,
    map: !reading || remaining >= 42,
    detailsWidth,
    mapWidth: Math.max(1, state.terminalWidth - (panes.hierarchy ? HIERARCHY_PANE_WIDTH : 0) - (panes.details ? detailsWidth : 0) - 2),
  }
}

/** Layout and record navigation must wrap at the same width. */
export function detailsContentWidth(state: ViewerState): number {
  return Math.max(1, terminalLayout(state).detailsWidth - 4)
}
