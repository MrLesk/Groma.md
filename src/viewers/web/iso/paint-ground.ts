import { ISLAND_FONT, ISLAND_SPACING, SURFACE_FONT } from '../../../sheet/measure.ts'
import type { Compass, ProjectedScene, ProjectedZone, Segment } from './project.ts'
import { planeMatrix } from './project.ts'
import { pointsAttribute, round, svg } from './svg.ts'
import { surfaceText } from './text.ts'

const COMPASS_FONT = 10

function pathOf(segments: readonly Segment[]): string {
  return segments
    .map(segment => `M${round(segment.from.x)} ${round(segment.from.y)}L${round(segment.to.x)} ${round(segment.to.y)}`)
    .join('')
}

function compassGroup(compass: Compass): SVGGElement {
  const group = svg('g', {}, 'compass')
  group.append(
    svg('ellipse', {
      cx: round(compass.centre.x), cy: round(compass.centre.y), rx: round(compass.rx), ry: round(compass.ry),
    }, 'ring'),
    svg('polygon', { points: pointsAttribute(compass.star) }, 'star'),
    svg('polygon', { points: pointsAttribute(compass.north) }, 'north'),
  )
  for (const letter of compass.letters) {
    const plane = svg('g', { transform: planeMatrix('ground', letter.at) })
    const text = svg('text', {
      'font-size': COMPASS_FONT, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
    }, 'text')
    text.textContent = letter.text
    plane.append(text)
    group.append(plane)
  }
  return group
}

/** The sheet's border with its corner ticks and the compass; the grid itself is the map's endless pattern. */
export function paintSheet(layer: SVGGElement, scene: ProjectedScene): void {
  layer.append(
    svg('polygon', { points: pointsAttribute(scene.frame) }, 'frame'),
    svg('path', { d: pathOf(scene.ticks) }, 'tick'),
    compassGroup(scene.compass),
  )
}

function zoneGroup(zone: ProjectedZone): SVGGElement {
  const group = svg('g', {}, 'zone')
  group.append(
    svg('polygon', { points: pointsAttribute(zone.polygon) }, 'ground'),
    surfaceText(zone.text, SURFACE_FONT, 'label', true),
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
    group.append(surfaceText(text, ISLAND_FONT, 'label', true, ISLAND_SPACING))
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

/** Container slabs: the top level with the ground under a faint grain, the sides hanging below it, the name on a chip and the zones lying on top. */
export function paintSlabs(layer: SVGGElement, scene: ProjectedScene): Map<string, Element> {
  const nodes = new Map<string, Element>()
  for (const { slab, faces, text } of scene.slabs) {
    const group = svg('g', { 'aria-label': slab.name }, `slab${slab.origin === 'observed' ? '' : ` ghost ${slab.origin}`}`)
    group.dataset.id = slab.representationId
    for (const face of faces) group.append(svg('polygon', { points: pointsAttribute(face.points) }, `face ${face.side}`))
    const top = faces.find(face => face.side === 'top')!
    group.append(svg('polygon', { points: pointsAttribute(top.points) }, 'pattern'))
    group.append(surfaceText(text, SURFACE_FONT, 'label', true))
    for (const zone of scene.zones) {
      if (zone.zone.parent === slab.representationId) group.append(zoneGroup(zone))
    }
    nodes.set(slab.representationId, group)
    layer.append(group)
  }
  return nodes
}
