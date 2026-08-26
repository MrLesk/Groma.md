import { ROOF_FONT } from '../../../sheet/measure.ts'
import type { BuildingSection } from '../../../sheet/types.ts'
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

function paintTier(
  layer: SVGGElement,
  buildingGroup: SVGGElement,
  tier: ProjectedBuilding['tiers'][number],
  section: BuildingSection | undefined,
): void {
  const group = section === undefined
    ? buildingGroup
    : svg('g', { 'data-file': section.file, 'data-file-type': section.fileType }, 'section')
  for (const face of tier) {
    group.append(svg('polygon', { points: pointsAttribute(face.points) }, `face ${face.side}`))
    if (face.side !== 'top') {
      const attributes: Record<string, string> = { points: pointsAttribute(face.points) }
      if (section !== undefined) {
        attributes.style = `fill:url(#${ensureFacadePattern(layer, section.fileType, face.side)})`
      }
      group.append(svg('polygon', attributes, `pattern ${face.side}`))
    }
  }
  if (section !== undefined) buildingGroup.append(group)
}

function paintBuilding(layer: SVGGElement, projected: ProjectedBuilding): SVGGElement {
  const { building, tiers, text } = projected
  const group = svg('g', { 'aria-label': building.name }, classOf(projected))
  group.dataset.id = building.representationId
  for (const [index, tier] of tiers.entries()) paintTier(layer, group, tier, building.sections[index])
  group.append(surfaceText(text, ROOF_FONT, 'label'))
  return group
}

/** Buildings back to front: one group per file section, patterned side faces, and the name on the final plain roof. */
export function paintBuildings(layer: SVGGElement, scene: ProjectedScene): Map<string, Element> {
  const nodes = new Map<string, Element>()
  for (const projected of scene.buildings) {
    const group = paintBuilding(layer, projected)
    nodes.set(projected.building.representationId, group)
    layer.append(group)
  }
  return nodes
}
