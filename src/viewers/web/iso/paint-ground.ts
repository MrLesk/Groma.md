import { ISLAND_FONT, ISLAND_SPACING, SURFACE_FONT, textWidth } from '../../../sheet/measure.ts'
import type { Compass, PlateText, ProjectPlate, RichPlateText, Segment } from './blueprint.ts'
import type { ProjectedScene, ProjectedZone, ProjectionView } from './project.ts'
import { planeMatrix } from './project.ts'
import { pointsAttribute, round, svg } from './svg.ts'
import { surfaceText } from './text.ts'

function pathOf(segments: readonly Segment[]): string {
  return segments
    .map(segment => `M${round(segment.from.x)} ${round(segment.from.y)}L${round(segment.to.x)} ${round(segment.to.y)}`)
    .join('')
}

function compassGroup(compass: Compass, view: ProjectionView): SVGGElement {
  const group = svg('g', {}, 'compass')
  group.append(
    svg('polygon', { points: pointsAttribute(compass.ring) }, 'ring'),
    svg('polygon', { points: pointsAttribute(compass.star) }, 'star'),
    svg('polygon', { points: pointsAttribute(compass.north) }, 'north'),
  )
  for (const letter of compass.letters) {
    const plane = svg('g', { transform: planeMatrix('ground', letter.at, view) })
    const text = svg('text', {
      'font-size': compass.fontSize, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
    }, 'text')
    text.textContent = letter.text
    plane.append(text)
    group.append(plane)
  }
  return group
}

function plateText(text: PlateText, className: string, view: ProjectionView): SVGGElement {
  const group = svg('g', { transform: planeMatrix('ground', text.origin, view) }, className)
  text.lines.forEach((line, index) => {
    const node = svg('text', {
      y: text.fontSize * 0.9 + index * text.lineHeight,
      'font-size': text.fontSize,
    }, 'text')
    if (textWidth(line, text.fontSize) > text.maxWidth) {
      node.setAttribute('textLength', String(text.maxWidth))
      node.setAttribute('lengthAdjust', 'spacingAndGlyphs')
    }
    node.textContent = line
    group.append(node)
  })
  return group
}

function richPlateText(text: RichPlateText, className: string, view: ProjectionView): SVGGElement {
  const group = svg('g', { transform: planeMatrix('ground', text.origin, view) }, className)
  text.lines.forEach((line, index) => {
    const node = svg('text', {
      y: text.fontSize * 0.9 + index * text.lineHeight,
      'font-size': text.fontSize,
    }, 'text')
    const plain = line.map(run => run.text).join('')
    if (textWidth(plain, text.fontSize) > text.maxWidth) {
      node.setAttribute('textLength', String(text.maxWidth))
      node.setAttribute('lengthAdjust', 'spacingAndGlyphs')
    }
    for (const run of line) {
      const span = svg('tspan', {}, run.styles.map(style => `md-${style}`).join(' '))
      span.textContent = run.text
      node.append(span)
    }
    group.append(node)
  })
  return group
}

function pencilGroup(plate: ProjectPlate, view: ProjectionView): SVGGElement {
  const { origin, length, thickness } = plate.edit.pencil
  const eraser = thickness * 0.45
  const ferrule = eraser + thickness * 0.25
  const tip = length - thickness * 0.8
  const lead = length - thickness * 0.2
  const group = svg('g', { transform: planeMatrix('ground', origin, view) }, 'pencil')
  group.append(
    svg('polygon', { points: `0,0 ${thickness},0 ${thickness},${tip} ${thickness / 2},${length} 0,${tip}` }, 'body'),
    svg('polygon', {
      points: `${thickness * 0.28},${ferrule} ${thickness * 0.72},${ferrule} ${thickness * 0.72},${tip} ${thickness * 0.28},${tip}`,
    }, 'facet'),
    svg('polygon', { points: `0,0 ${thickness},0 ${thickness},${eraser} 0,${eraser}` }, 'eraser'),
    svg('polygon', { points: `0,${eraser} ${thickness},${eraser} ${thickness},${ferrule} 0,${ferrule}` }, 'ferrule'),
    svg('polygon', { points: `0,${tip} ${thickness},${tip} ${thickness / 2},${length}` }, 'tip'),
    svg('polygon', { points: `${thickness * 0.4},${lead} ${thickness * 0.6},${lead} ${thickness / 2},${length}` }, 'lead'),
    svg('path', { d: `M0 ${eraser}H${thickness}M0 ${ferrule}H${thickness}M0 ${tip}H${thickness}` }, 'seams'),
  )
  return group
}

function projectPlateGroup(plate: ProjectPlate, view: ProjectionView): SVGGElement {
  const group = svg('g', {}, 'project-plate')
  group.append(
    svg('polygon', { points: pointsAttribute(plate.polygon) }, 'plate'),
    plateText(plate.name, 'project-name', view),
    richPlateText(plate.description, 'project-description', view),
    plateText(plate.meta, 'project-meta', view),
  )
  const edit = svg('g', {
    'data-project-edit': '', role: 'button', tabindex: 0, 'aria-label': 'Edit project profile',
  }, 'project-edit')
  edit.append(svg('polygon', { points: pointsAttribute(plate.edit.polygon) }, 'edit-frame'))
  edit.append(pencilGroup(plate, view))
  group.append(edit)
  return group
}

/** The sheet's frame, front-edge calibration and compass; the map paints its grid behind them. */
export function paintSheet(layer: SVGGElement, scene: ProjectedScene): void {
  layer.append(
    svg('polygon', { points: pointsAttribute(scene.frame) }, 'frame'),
    svg('path', { d: pathOf(scene.calibrationTicks) }, 'calibration-tick'),
    compassGroup(scene.compass, scene.view),
  )
  if (scene.projectPlate !== undefined) layer.append(projectPlateGroup(scene.projectPlate, scene.view))
}

function zoneGroup(zone: ProjectedZone, view: ProjectionView): SVGGElement {
  const group = svg('g', {}, 'zone')
  group.append(
    svg('polygon', { points: pointsAttribute(zone.polygon) }, 'ground'),
    surfaceText(zone.text, SURFACE_FONT, 'label', view, true),
  )
  return group
}

/** Flat islands; system islands are selectable, actors and external islands are not. */
export function paintIslands(layer: SVGGElement, scene: ProjectedScene): Map<string, Element> {
  const nodes = new Map<string, Element>()
  for (const { island, polygon, text } of scene.islands) {
    const group = svg('g', {}, `island ${island.kind}`)
    group.append(svg('polygon', { points: pointsAttribute(polygon) }, 'ground'))
    if (island.kind !== 'system') group.append(svg('polygon', { points: pointsAttribute(polygon) }, 'pattern'))
    group.append(surfaceText(text, ISLAND_FONT, 'label', scene.view, true, ISLAND_SPACING))
    if (island.element) {
      group.dataset.id = island.element.representationId
      group.setAttribute('aria-label', island.name)
      nodes.set(island.element.representationId, group)
    }
    layer.append(group)
  }
  for (const zone of scene.zones) {
    if (scene.islands.some(item => item.island.key === zone.zone.parent)) layer.append(zoneGroup(zone, scene.view))
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
    group.append(surfaceText(text, SURFACE_FONT, 'label', scene.view, true))
    for (const zone of scene.zones) {
      if (zone.zone.parent === slab.representationId) group.append(zoneGroup(zone, scene.view))
    }
    nodes.set(slab.representationId, group)
    layer.append(group)
  }
  return nodes
}
