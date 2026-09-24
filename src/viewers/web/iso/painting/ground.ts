import { CONTAINER_FONT, GROUP_FONT, ISLAND_FONT, ISLAND_SPACING, textWidth } from '../../../../sheet/measure.ts'
import type { Compass, PlateText, ProjectPlate, RichPlateText, Segment } from '../projection/blueprint.ts'
import type { ProjectedScene, ProjectedZone, ProjectionView } from '../projection/project.ts'
import { planeMatrix } from '../projection/project.ts'
import { node, pointsAttribute, round, type SvgNode } from './svg.ts'
import { surfaceLabel } from './text.ts'

function pathOf(segments: readonly Segment[]): string {
  return segments.map(segment =>
    `M${round(segment.from.x)} ${round(segment.from.y)}L${round(segment.to.x)} ${round(segment.to.y)}`).join('')
}

function compassGroup(compass: Compass, view: ProjectionView): SvgNode {
  return node('g', {}, 'compass', [
    node('polygon', { points: pointsAttribute(compass.ring) }, 'ring'),
    node('polygon', { points: pointsAttribute(compass.star) }, 'star'),
    node('polygon', { points: pointsAttribute(compass.north) }, 'north'),
    ...compass.letters.map(letter => node('g', { transform: planeMatrix('ground', letter.at, view) }, '', [
      node('text', { 'font-size': compass.fontSize, 'text-anchor': 'middle', 'dominant-baseline': 'middle' },
        'text', letter.text),
    ])),
  ])
}

function lineAttributes(text: PlateText | RichPlateText, plain: string, index: number) {
  return {
    y: text.fontSize * 0.9 + index * text.lineHeight,
    'font-size': text.fontSize,
    ...(textWidth(plain, text.fontSize) > text.maxWidth
      ? { textLength: text.maxWidth, lengthAdjust: 'spacingAndGlyphs' } : {}),
  }
}

function plateText(text: PlateText, className: string, view: ProjectionView): SvgNode {
  return node('g', { transform: planeMatrix('ground', text.origin, view) }, className,
    text.lines.map((line, index) => node('text', lineAttributes(text, line, index), 'text', line)))
}

function richPlateText(text: RichPlateText, view: ProjectionView): SvgNode {
  return node('g', { transform: planeMatrix('ground', text.origin, view) }, 'project-overview',
    text.lines.map((line, index) => node('text', lineAttributes(text, line.map(run => run.text).join(''), index), 'text',
      line.map(run => node('tspan', {}, run.styles.map(style => `md-${style}`).join(' '), run.text)))))
}

function pencilGroup(plate: ProjectPlate, view: ProjectionView): SvgNode {
  const { origin, length, thickness } = plate.edit.pencil
  const eraser = thickness * 0.45
  const ferrule = eraser + thickness * 0.25
  const tip = length - thickness * 0.8
  const lead = length - thickness * 0.2
  return node('g', { transform: planeMatrix('ground', origin, view) }, 'pencil', [
    node('polygon', { points: `0,0 ${thickness},0 ${thickness},${tip} ${thickness / 2},${length} 0,${tip}` }, 'body'),
    node('polygon', {
      points: `${thickness * 0.28},${ferrule} ${thickness * 0.72},${ferrule} ${thickness * 0.72},${tip} ${thickness * 0.28},${tip}`,
    }, 'facet'),
    node('polygon', { points: `0,0 ${thickness},0 ${thickness},${eraser} 0,${eraser}` }, 'eraser'),
    node('polygon', { points: `0,${eraser} ${thickness},${eraser} ${thickness},${ferrule} 0,${ferrule}` }, 'ferrule'),
    node('polygon', { points: `0,${tip} ${thickness},${tip} ${thickness / 2},${length}` }, 'tip'),
    node('polygon', { points: `${thickness * 0.4},${lead} ${thickness * 0.6},${lead} ${thickness / 2},${length}` }, 'lead'),
    node('path', { d: `M0 ${eraser}H${thickness}M0 ${ferrule}H${thickness}M0 ${tip}H${thickness}` }, 'seams'),
  ])
}

function projectPlateGroup(plate: ProjectPlate, view: ProjectionView): SvgNode {
  return node('g', {}, 'project-plate', [
    node('polygon', { points: pointsAttribute(plate.polygon) }, 'plate'),
    plateText(plate.title, 'project-title', view),
    richPlateText(plate.overview, view),
    plateText(plate.meta, 'project-meta', view),
    node('g', { 'data-project-edit': '', role: 'button', tabindex: 0, 'aria-label': 'Edit project profile' }, 'project-edit', [
      node('polygon', { points: pointsAttribute(plate.edit.polygon) }, 'edit-frame'),
      pencilGroup(plate, view),
    ]),
  ])
}

/** The sheet's frame, calibration and compass; the viewer places its grid behind them. */
export function sheetSvg(scene: ProjectedScene): SvgNode[] {
  return [
    node('polygon', { points: pointsAttribute(scene.frame) }, 'frame'),
    node('path', { d: pathOf(scene.calibrationTicks) }, 'calibration-tick'),
    compassGroup(scene.compass, scene.view),
    ...(scene.projectPlate === undefined ? [] : [projectPlateGroup(scene.projectPlate, scene.view)]),
  ]
}

function zoneGroup(zone: ProjectedZone, view: ProjectionView, zoom: number): SvgNode {
  const attributes: Record<string, string> = zone.zone.unidentifiedContainer
    ? { 'data-id': zone.zone.key, 'aria-label': zone.zone.name } : {}
  return node('g', attributes, 'zone', [
    node('polygon', { points: pointsAttribute(zone.polygon) }, 'ground'),
    surfaceLabel(zone.text, GROUP_FONT, view, 0, zoom),
  ])
}

/** System islands carry their architecture identity; actor and external grounds do not. */
export function islandsSvg(scene: ProjectedScene, zoom = 1): SvgNode[] {
  return [
    ...scene.islands.map(({ island, polygon, text }) => {
      const attributes: Record<string, string> = island.element === null
        ? {} : { 'data-id': island.element.representationId, 'aria-label': island.name }
      return node('g', attributes, `island ${island.kind}`, [
        node('polygon', { points: pointsAttribute(polygon) }, 'ground'),
        ...(island.kind === 'system' ? [] : [node('polygon', { points: pointsAttribute(polygon) }, 'pattern')]),
        surfaceLabel(text, ISLAND_FONT, scene.view, ISLAND_SPACING, zoom),
      ])
    }),
    ...scene.zones.filter(zone => scene.islands.some(item => item.island.key === zone.zone.parent))
      .map(zone => zoneGroup(zone, scene.view, zoom)),
  ]
}

/** Container slabs have hanging sides, external names and zones on top. */
export function slabsSvg(scene: ProjectedScene, zoom = 1): SvgNode[] {
  return scene.slabs.map(({ slab, faces, text }) => {
    const ghost = slab.origin === 'observed' ? '' : ` ghost ${slab.origin}`
    const top = faces.find(face => face.side === 'top')!
    return node('g', { 'aria-label': slab.title, 'data-id': slab.representationId }, `slab${ghost}`, [
      ...faces.map(face => node('polygon', { points: pointsAttribute(face.points) }, `face ${face.side}`)),
      node('polygon', { points: pointsAttribute(top.points) }, 'pattern'),
      surfaceLabel(text, CONTAINER_FONT, scene.view, 0, zoom),
      ...scene.zones.filter(zone => zone.zone.parent === slab.representationId)
        .map(zone => zoneGroup(zone, scene.view, zoom)),
    ])
  })
}
