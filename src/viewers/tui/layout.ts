export const HIERARCHY_PANE_WIDTH = 26
export const DETAILS_PANE_WIDTH = 32

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
