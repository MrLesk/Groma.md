import { PLANE } from '../../../sheet/measure.ts'
import type { Camera } from './camera.ts'
import { DEFAULT_PROJECTION, planeMatrix, type ProjectionView } from './project.ts'
import { GRID_TILE_CELLS } from './scale.ts'

const TILE_SIZE = GRID_TILE_CELLS * PLANE

export function gridTransform(camera: Camera, view: ProjectionView): string {
  return `translate(${camera.x} ${camera.y}) scale(${camera.k}) ${planeMatrix('ground', undefined, view)}`
}

/** Graph paper belongs to the fixed viewport; its tile follows the map's projection and camera. */
export function gridPatternSvg(camera: Camera, view: ProjectionView = DEFAULT_PROJECTION): string {
  const minor: string[] = []
  const major: string[] = []
  for (let index = 0; index < GRID_TILE_CELLS; index += 1) {
    const offset = index * PLANE
    const lines = index === 0 ? major : minor
    lines.push(`M${offset} 0V${TILE_SIZE}`, `M0 ${offset}H${TILE_SIZE}`)
  }
  // Pattern strokes scale with the tile, so correct their width here rather than using vector-effect.
  return `<pattern id="grid" patternUnits="userSpaceOnUse" width="${TILE_SIZE}" height="${TILE_SIZE}" patternTransform="${gridTransform(camera, view)}">
    <path d="${minor.join('')}" class="grid" stroke-width="${1 / camera.k}"/>
    <path d="${major.join('')}" class="grid major" stroke-width="${1 / camera.k}"/>
  </pattern>`
}
