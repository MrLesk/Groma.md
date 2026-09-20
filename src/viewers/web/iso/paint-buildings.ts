import { buildingFont } from '../../../sheet/measure.ts'
import type { BuildingFloor } from '../../../sheet/types.ts'
import type { Plane, ProjectedBuilding, ProjectedScene } from './project.ts'
import { facadePattern, facadePatternId } from './style.ts'
import { pointsAttribute, svgMarkup as svg } from './svg.ts'
import { surfaceText } from './text.ts'

function classOf(projected: ProjectedBuilding): string {
  const { building } = projected
  const kind = building.kind === 'actor' ? 'actor' : building.external ? 'external' : 'component'
  const ghost = building.origin === 'observed' ? '' : ` ghost ${building.origin}`
  return `building ${kind}${ghost}`
}

/** Each file type contributes its two facade tiles once, before any building references them. */
export function facadeDefs(scene: ProjectedScene): string {
  const fileTypes = new Set(scene.buildings.flatMap(({ building }) => building.floors.map(floor => floor.facadeFileType)))
  return [...fileTypes].map(fileType =>
    facadePattern(fileType, 'left', scene.view) + facadePattern(fileType, 'right', scene.view)).join('')
}

function floorPattern(
  projected: ProjectedBuilding,
  floor: BuildingFloor | undefined,
  plane: Extract<Plane, 'left' | 'right'>,
): string {
  if (floor !== undefined) return facadePatternId(floor.facadeFileType, plane)
  if (projected.building.kind === 'actor') return `dots-${plane}`
  return `${projected.building.external ? 'cross' : 'lines'}-${plane}`
}

function floorSvg(
  projected: ProjectedBuilding,
  faces: ProjectedBuilding['floors'][number],
  floor: BuildingFloor | undefined,
): string {
  const body = faces.map(face => {
    const points = pointsAttribute(face.points)
    const shape = svg('polygon', { points }, `face ${face.side}`)
    if (face.side === 'top') return shape
    const pattern = floorPattern(projected, floor, face.plane!)
    return shape + svg('polygon', { points, style: `fill:url(#${pattern})` }, `pattern ${face.side}`)
  }).join('')
  return floor === undefined ? body
    : svg('g', { 'data-files': floor.files.join('\n'), 'data-file-type': floor.facadeFileType }, 'floor', body)
}

/** Buildings back to front: visible floors, patterned side faces and names on the final roofs. */
export function buildingsSvg(scene: ProjectedScene): string {
  return scene.buildings.map(projected => {
    const { building, floors, text } = projected
    return svg('g', { 'aria-label': building.title, 'data-id': building.representationId }, classOf(projected),
      floors.map((faces, index) => floorSvg(projected, faces, building.floors[index])).join('')
      + surfaceText(text, buildingFont(building), 'label', scene.view))
  }).join('')
}
