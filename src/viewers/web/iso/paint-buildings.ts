import { ROOF_FONT } from '../../../sheet/measure.ts'
import type { BuildingFloor } from '../../../sheet/types.ts'
import type { ProjectedBuilding, ProjectedScene } from './project.ts'
import { facadePattern, facadePatternId } from './style.ts'
import { pointsAttribute, svg } from './svg.ts'
import { surfaceText } from './text.ts'

function classOf(projected: ProjectedBuilding): string {
  const { building } = projected
  const kind = building.kind === 'actor' ? 'actor' : building.external ? 'external' : 'component'
  const ghost = building.origin === 'observed' ? '' : ` ghost ${building.origin}`
  return `building ${kind}${ghost}`
}

function ensureFacadePattern(layer: SVGGElement, fileType: string, side: 'left' | 'right'): string {
  const id = facadePatternId(fileType, side)
  const root = layer.ownerSVGElement!
  if (root.querySelector(`[id="${id}"]`) === null) {
    root.querySelector('defs')!.insertAdjacentHTML('beforeend', facadePattern(fileType, side))
  }
  return id
}

function paintFloor(
  layer: SVGGElement,
  buildingGroup: SVGGElement,
  faces: ProjectedBuilding['floors'][number],
  floor: BuildingFloor | undefined,
): void {
  const group = floor === undefined
    ? buildingGroup
    : svg('g', { 'data-files': floor.files.join('\n'), 'data-file-type': floor.facadeFileType }, 'floor')
  for (const face of faces) {
    group.append(svg('polygon', { points: pointsAttribute(face.points) }, `face ${face.side}`))
    if (face.side !== 'top') {
      const attributes: Record<string, string> = { points: pointsAttribute(face.points) }
      if (floor !== undefined) {
        attributes.style = `fill:url(#${ensureFacadePattern(layer, floor.facadeFileType, face.side)})`
      }
      group.append(svg('polygon', attributes, `pattern ${face.side}`))
    }
  }
  if (floor !== undefined) buildingGroup.append(group)
}

function paintBuilding(layer: SVGGElement, projected: ProjectedBuilding): SVGGElement {
  const { building, floors, text } = projected
  const group = svg('g', { 'aria-label': building.name }, classOf(projected))
  group.dataset.id = building.representationId
  for (const [index, faces] of floors.entries()) paintFloor(layer, group, faces, building.floors[index])
  group.append(surfaceText(text, ROOF_FONT, 'label'))
  return group
}

/** Buildings back to front: one group per visible floor, patterned side faces, and the name on the final roof. */
export function paintBuildings(layer: SVGGElement, scene: ProjectedScene): Map<string, Element> {
  const nodes = new Map<string, Element>()
  for (const projected of scene.buildings) {
    const group = paintBuilding(layer, projected)
    nodes.set(projected.building.representationId, group)
    layer.append(group)
  }
  return nodes
}
