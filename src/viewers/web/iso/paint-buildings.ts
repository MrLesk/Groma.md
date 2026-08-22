import { ROOF_FONT } from '../../../sheet/measure.ts'
import type { ProjectedBuilding, ProjectedScene } from './project.ts'
import { pointsAttribute, svg } from './svg.ts'
import { surfaceText } from './text.ts'

function classOf(projected: ProjectedBuilding): string {
  const { building } = projected
  const kind = building.kind === 'person' ? 'person' : building.external ? 'external' : 'component'
  const ghost = building.origin === 'observed' ? '' : ` ghost ${building.origin}`
  return `building ${kind} ${building.shape.kind}${ghost}`
}

/** Buildings back to front: every tier's three faces, a hatch on tower sides, a pattern on people and externals, the name on the roof. */
export function paintBuildings(layer: SVGGElement, scene: ProjectedScene): Map<string, Element> {
  const nodes = new Map<string, Element>()
  for (const projected of scene.buildings) {
    const { building, tiers, text } = projected
    const group = svg('g', { 'aria-label': building.name }, classOf(projected))
    group.dataset.id = building.representationId
    for (const tier of tiers) {
      for (const face of tier) {
        group.append(svg('polygon', { points: pointsAttribute(face.points) }, `face ${face.side}`))
        if (building.shape.kind === 'tower' && face.side !== 'top') {
          group.append(svg('polygon', { points: pointsAttribute(face.points) }, 'hatch'))
        }
        if (building.kind !== 'component' && face.side === 'top') {
          group.append(svg('polygon', { points: pointsAttribute(face.points) }, 'pattern'))
        }
      }
    }
    group.append(surfaceText(text, ROOF_FONT, 'label'))
    nodes.set(building.representationId, group)
    layer.append(group)
  }
  return nodes
}
