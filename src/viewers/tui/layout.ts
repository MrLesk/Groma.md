import type { Bounds } from '../../types.ts'

export const HIERARCHY_PANE_WIDTH = 26
export const DETAILS_PANE_WIDTH = 32

export interface PaneVisibility {
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
  panes: PaneVisibility = { details: true },
): PaneLayout {
  const body = { y: 2, height: Math.max(1, height - 4) }
  const detailsWidth = panes.details ? DETAILS_PANE_WIDTH : 0
  const hierarchy = {
    x: 0,
    ...body,
    width: HIERARCHY_PANE_WIDTH,
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
    header: { x: 0, y: 1, width, height: 1 },
    hierarchy,
    map,
    mapViewport: {
      x: map.x + 1,
      y: map.y + 1,
      width: Math.max(1, map.width - 2),
      height: Math.max(1, map.height - 2),
    },
    details,
    footer: { x: 0, y: height - 2, width, height: 1 },
  }
}
