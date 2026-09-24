import { PLANE } from '../../../sheet/measure.ts'
import type { Camera } from './camera/camera.ts'
import { DEFAULT_PROJECTION, planeMatrix, type ProjectionView } from './project.ts'
import { mark, node, patch, svg, type SvgNode } from './svg.ts'

/** A graph-paper tile: minor rows one plane cell apart, and a major row at its edge. */
const TILE_CELLS = 5
const TILE_SIZE = TILE_CELLS * PLANE
/** Rows closer than this on screen leave paint, minor rows first, before they become a dense moving texture. */
const MIN_ROW_PITCH_PX = 6
/** Rows at least this far apart on screen draw one-pixel lines; closer rows draw thinner ones, so the grid keeps one weight at every zoom. */
const FULL_LINE_PITCH_PX = 24

/** One row each way across the tile, at this offset from its edge. */
const row = (offset: number): string => `M${offset} 0V${TILE_SIZE}M0 ${offset}H${TILE_SIZE}`
const MAJOR_ROWS = row(0)
const MINOR_ROWS = Array.from({ length: TILE_CELLS - 1 }, (_, index) => row((index + 1) * PLANE)).join('')

/** A line's width in tile units: one screen pixel, or less once its rows are closer than FULL_LINE_PITCH_PX on screen. */
function lineWidth(k: number, pitch: number): number {
  return Math.min(1 / k, pitch / FULL_LINE_PITCH_PX)
}

/** The graph paper under one camera: its tile follows the map's projection and camera, and its lines thin as rows close up. */
export function gridPattern(camera: Camera, view: ProjectionView = DEFAULT_PROJECTION): SvgNode {
  const minorHidden = camera.k * PLANE < MIN_ROW_PITCH_PX
  return node('pattern', {
    id: 'grid', patternUnits: 'userSpaceOnUse', width: TILE_SIZE, height: TILE_SIZE,
    patternTransform: `translate(${camera.x} ${camera.y}) scale(${camera.k}) ${planeMatrix('ground', undefined, view)}`,
  }, '', [
    mark('path', { class: 'grid', d: MINOR_ROWS, 'stroke-width': lineWidth(camera.k, PLANE), ...(minorHidden ? { display: 'none' } : {}) }),
    mark('path', { class: 'grid major', d: MAJOR_ROWS, 'stroke-width': lineWidth(camera.k, TILE_SIZE) }),
  ])
}

/** The map pane's endless grid, fixed to the viewport outside the cached camera layer. */
export function createGrid() {
  const surface = svg('svg', { width: '100%', height: '100%', 'aria-hidden': 'true' }, 'field-surface')
  const definitions = svg('defs')
  const field = svg('rect', { width: '100%', height: '100%', fill: 'url(#grid)' })
  surface.append(definitions, field)
  return {
    surface,
    /**
     * Lays the grid under the camera. Position, line widths and visibility change together on every frame, so the map
     * shows the same grid in motion and at rest; the writes repaint only the grid, never the cached camera layer.
     */
    follow(camera: Camera, view: ProjectionView): void {
      const visible = camera.k * TILE_SIZE >= MIN_ROW_PITCH_PX
      field.style.display = visible ? '' : 'none'
      if (visible) patch(definitions, [gridPattern(camera, view)])
    },
  }
}
