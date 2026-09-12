import { buildingFont } from '../../../sheet/measure.ts'
import type { BuildingFloor } from '../../../sheet/types.ts'
import type { Plane, ProjectedBuilding, ProjectedScene, ProjectionView } from './project.ts'
import { facadePattern, facadePatternId } from './style.ts'
import { pointsAttribute, svg } from './svg.ts'
import { surfaceText } from './text.ts'

function classOf(projected: ProjectedBuilding): string {
  const { building } = projected
  const kind = building.kind === 'actor' ? 'actor' : building.external ? 'external' : 'component'
  const ghost = building.origin === 'observed' ? '' : ` ghost ${building.origin}`
  return `building ${kind}${ghost}`
}

function ensureFacadePattern(
  layer: SVGGElement,
  fileType: string,
  plane: Extract<Plane, 'left' | 'right'>,
  view: ProjectionView,
): string {
  const id = facadePatternId(fileType, plane)
  const root = layer.ownerSVGElement!
  if (root.querySelector(`[id="${id}"]`) === null) {
    root.querySelector('defs')!.insertAdjacentHTML('beforeend', facadePattern(fileType, plane, view))
  }
  return id
}

function floorPattern(
  layer: SVGGElement,
  projected: ProjectedBuilding,
  floor: BuildingFloor | undefined,
  plane: Extract<Plane, 'left' | 'right'>,
  view: ProjectionView,
): string {
  if (floor !== undefined) return ensureFacadePattern(layer, floor.facadeFileType, plane, view)
  if (projected.building.kind === 'actor') return `dots-${plane}`
  return `${projected.building.external ? 'cross' : 'lines'}-${plane}`
}

function paintFloor(
  layer: SVGGElement,
  buildingGroup: SVGGElement,
  projected: ProjectedBuilding,
  faces: ProjectedBuilding['floors'][number],
  floor: BuildingFloor | undefined,
  view: ProjectionView,
): void {
  const group = floor === undefined
    ? buildingGroup
    : svg('g', { 'data-files': floor.files.join('\n'), 'data-file-type': floor.facadeFileType }, 'floor')
  for (const face of faces) {
    group.append(svg('polygon', { points: pointsAttribute(face.points) }, `face ${face.side}`))
    if (face.side !== 'top') {
      const plane = face.plane!
      const pattern = floorPattern(layer, projected, floor, plane, view)
      const attributes = { points: pointsAttribute(face.points), style: `fill:url(#${pattern})` }
      group.append(svg('polygon', attributes, `pattern ${face.side}`))
    }
  }
  if (floor !== undefined) buildingGroup.append(group)
}

function paintBuilding(
  layer: SVGGElement,
  projected: ProjectedBuilding,
  view: ProjectionView,
): SVGGElement {
  const { building, floors, text } = projected
  const group = svg('g', { 'aria-label': building.title }, classOf(projected))
  group.dataset.id = building.representationId
  for (const [index, faces] of floors.entries()) {
    paintFloor(layer, group, projected, faces, building.floors[index], view)
  }
  group.append(surfaceText(text, buildingFont(building), 'label', view))
  return group
}

/** Buildings back to front: one group per visible floor, patterned side faces, and the name on the final roof. */
export function paintBuildings(layer: SVGGElement, scene: ProjectedScene): Map<string, Element> {
  const nodes = new Map<string, Element>()
  for (const projected of scene.buildings) {
    const group = paintBuilding(layer, projected, scene.view)
    nodes.set(projected.building.representationId, group)
    layer.append(group)
  }
  return nodes
}
