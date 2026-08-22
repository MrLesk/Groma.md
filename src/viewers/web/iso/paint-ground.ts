import { ISLAND_FONT, SURFACE_FONT } from '../../../sheet/measure.ts'
import type { ProjectedScene, ProjectedZone, Segment } from './project.ts'
import { pointsAttribute, round, svg } from './svg.ts'
import { surfaceText } from './text.ts'

const TICK = 6

function pathOf(segments: readonly Segment[]): string {
  return segments
    .map(segment => `M${round(segment.from.x)} ${round(segment.from.y)}L${round(segment.to.x)} ${round(segment.to.y)}`)
    .join('')
}

/** The grid field with its frame and corner registration ticks. */
export function paintSheet(layer: SVGGElement, scene: ProjectedScene): void {
  layer.append(
    svg('path', { d: pathOf(scene.sheet.minor) }, 'grid'),
    svg('path', { d: pathOf(scene.sheet.major) }, 'grid major'),
    svg('polygon', { points: pointsAttribute(scene.sheet.polygon) }, 'frame'),
  )
  for (const corner of scene.sheet.polygon) {
    layer.append(svg('path', {
      d: `M${round(corner.x - TICK)} ${round(corner.y)}H${round(corner.x + TICK)}`
        + `M${round(corner.x)} ${round(corner.y - TICK)}V${round(corner.y + TICK)}`,
    }, 'tick'))
  }
}

function zoneGroup(zone: ProjectedZone): SVGGElement {
  const group = svg('g', {}, 'zone')
  group.append(
    svg('polygon', { points: pointsAttribute(zone.polygon) }, 'ground'),
    surfaceText(zone.text, SURFACE_FONT, 'label'),
  )
  return group
}

/** Flat islands; system islands are selectable, people and external islands are not. */
export function paintIslands(layer: SVGGElement, scene: ProjectedScene): Map<string, Element> {
  const nodes = new Map<string, Element>()
  for (const { island, polygon, text } of scene.islands) {
    const group = svg('g', {}, `island ${island.kind}`)
    group.append(svg('polygon', { points: pointsAttribute(polygon) }, 'ground'))
    if (island.kind !== 'system') group.append(svg('polygon', { points: pointsAttribute(polygon) }, 'pattern'))
    group.append(surfaceText(text, ISLAND_FONT, 'label'))
    if (island.element) {
      group.dataset.id = island.element.representationId
      group.setAttribute('aria-label', island.name)
      nodes.set(island.element.representationId, group)
    }
    layer.append(group)
  }
  for (const zone of scene.zones) {
    if (scene.islands.some(item => item.island.key === zone.zone.parent)) layer.append(zoneGroup(zone))
  }
  return nodes
}

/** Container slabs with their faces, name and the zones lying on their deck. */
export function paintSlabs(layer: SVGGElement, scene: ProjectedScene): Map<string, Element> {
  const nodes = new Map<string, Element>()
  for (const { slab, faces, text } of scene.slabs) {
    const group = svg('g', { 'aria-label': slab.name }, `slab${slab.origin === 'observed' ? '' : ` ghost ${slab.origin}`}`)
    group.dataset.id = slab.representationId
    for (const face of faces) group.append(svg('polygon', { points: pointsAttribute(face.points) }, `face ${face.side}`))
    group.append(surfaceText(text, SURFACE_FONT, 'label'))
    for (const zone of scene.zones) {
      if (zone.zone.parent === slab.representationId) group.append(zoneGroup(zone))
    }
    nodes.set(slab.representationId, group)
    layer.append(group)
  }
  return nodes
}
