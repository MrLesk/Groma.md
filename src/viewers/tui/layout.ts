import type { Bounds } from '../../types.ts'

export const HIERARCHY_PANE_WIDTH = 26
export const DETAILS_PANE_WIDTH = 32

export interface PaneVisibility {
  hierarchy: boolean
  details: boolean
}

export interface PaneLayout {
  header: Bounds
  hierarchy: Bounds
  map: Bounds
  /** Interior of the map pane; the camera viewport. */
  mapViewport: Bounds
  details: Bounds
  footer: Bounds
}

export function paneLayout(
  width: number,
  height: number,
  panes: PaneVisibility = { hierarchy: true, details: true },
): PaneLayout {
  const body = { y: 1, height: Math.max(1, height - 2) }
  const detailsWidth = panes.details ? DETAILS_PANE_WIDTH : 0
  const hierarchy = {
    x: 0,
    ...body,
    width: panes.hierarchy ? HIERARCHY_PANE_WIDTH : 0,
  }
  const details = {
    x: Math.max(hierarchy.width, width - detailsWidth),
    ...body,
    width: detailsWidth,
  }
  const map = {
    x: hierarchy.width,
    ...body,
    width: Math.max(3, details.x - hierarchy.width),
  }
  return {
    header: { x: 0, y: 0, width, height: 1 },
    hierarchy,
    map,
    mapViewport: {
      x: map.x + 1,
      y: map.y + 1,
      width: Math.max(1, map.width - 2),
      height: Math.max(1, map.height - 2),
    },
    details,
    footer: { x: 0, y: height - 1, width, height: 1 },
  }
}
