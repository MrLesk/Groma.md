import { CONTAINER_FONT, GROUP_FONT, ISLAND_FONT, ISLAND_SPACING, textWidth } from '../../../sheet/measure.ts'
import { escaped } from '../atoms/escape.ts'
import type { Compass, PlateText, ProjectPlate, RichPlateText, Segment } from './blueprint.ts'
import type { ProjectedScene, ProjectedZone, ProjectionView } from './project.ts'
import { planeMatrix } from './project.ts'
import { pointsAttribute, round, svgMarkup as svg } from './svg.ts'
import { surfaceLabel } from './text.ts'

function pathOf(segments: readonly Segment[]): string {
  return segments.map(segment =>
    `M${round(segment.from.x)} ${round(segment.from.y)}L${round(segment.to.x)} ${round(segment.to.y)}`).join('')
}

function compassGroup(compass: Compass, view: ProjectionView): string {
  return svg('g', {}, 'compass',
    svg('polygon', { points: pointsAttribute(compass.ring) }, 'ring')
    + svg('polygon', { points: pointsAttribute(compass.star) }, 'star')
    + svg('polygon', { points: pointsAttribute(compass.north) }, 'north')
    + compass.letters.map(letter => svg('g', { transform: planeMatrix('ground', letter.at, view) }, '',
      svg('text', { 'font-size': compass.fontSize, 'text-anchor': 'middle', 'dominant-baseline': 'middle' },
        'text', escaped(letter.text)))).join(''))
}

function lineAttributes(text: PlateText | RichPlateText, plain: string, index: number) {
  return {
    y: text.fontSize * 0.9 + index * text.lineHeight,
    'font-size': text.fontSize,
    ...(textWidth(plain, text.fontSize) > text.maxWidth
      ? { textLength: text.maxWidth, lengthAdjust: 'spacingAndGlyphs' } : {}),
  }
}

function plateText(text: PlateText, className: string, view: ProjectionView): string {
  return svg('g', { transform: planeMatrix('ground', text.origin, view) }, className,
    text.lines.map((line, index) => svg('text', lineAttributes(text, line, index), 'text', escaped(line))).join(''))
}

function richPlateText(text: RichPlateText, view: ProjectionView): string {
  return svg('g', { transform: planeMatrix('ground', text.origin, view) }, 'project-overview',
    text.lines.map((line, index) => svg('text', lineAttributes(text, line.map(run => run.text).join(''), index), 'text',
      line.map(run => svg('tspan', {}, run.styles.map(style => `md-${style}`).join(' '), escaped(run.text))).join(''))).join(''))
}

function pencilGroup(plate: ProjectPlate, view: ProjectionView): string {
  const { origin, length, thickness } = plate.edit.pencil
  const eraser = thickness * 0.45
  const ferrule = eraser + thickness * 0.25
  const tip = length - thickness * 0.8
  const lead = length - thickness * 0.2
  return svg('g', { transform: planeMatrix('ground', origin, view) }, 'pencil', [
    svg('polygon', { points: `0,0 ${thickness},0 ${thickness},${tip} ${thickness / 2},${length} 0,${tip}` }, 'body'),
    svg('polygon', {
      points: `${thickness * 0.28},${ferrule} ${thickness * 0.72},${ferrule} ${thickness * 0.72},${tip} ${thickness * 0.28},${tip}`,
    }, 'facet'),
    svg('polygon', { points: `0,0 ${thickness},0 ${thickness},${eraser} 0,${eraser}` }, 'eraser'),
    svg('polygon', { points: `0,${eraser} ${thickness},${eraser} ${thickness},${ferrule} 0,${ferrule}` }, 'ferrule'),
    svg('polygon', { points: `0,${tip} ${thickness},${tip} ${thickness / 2},${length}` }, 'tip'),
    svg('polygon', { points: `${thickness * 0.4},${lead} ${thickness * 0.6},${lead} ${thickness / 2},${length}` }, 'lead'),
    svg('path', { d: `M0 ${eraser}H${thickness}M0 ${ferrule}H${thickness}M0 ${tip}H${thickness}` }, 'seams'),
  ].join(''))
}

function projectPlateGroup(plate: ProjectPlate, view: ProjectionView): string {
  return svg('g', {}, 'project-plate',
    svg('polygon', { points: pointsAttribute(plate.polygon) }, 'plate')
    + plateText(plate.title, 'project-title', view)
    + richPlateText(plate.overview, view)
    + plateText(plate.meta, 'project-meta', view)
    + svg('g', { 'data-project-edit': '', role: 'button', tabindex: 0, 'aria-label': 'Edit project profile' }, 'project-edit',
      svg('polygon', { points: pointsAttribute(plate.edit.polygon) }, 'edit-frame') + pencilGroup(plate, view)))
}

/** The sheet's frame, calibration and compass; the viewer places its grid behind them. */
export function sheetSvg(scene: ProjectedScene): string {
  return svg('polygon', { points: pointsAttribute(scene.frame) }, 'frame')
    + svg('path', { d: pathOf(scene.calibrationTicks) }, 'calibration-tick')
    + compassGroup(scene.compass, scene.view)
    + (scene.projectPlate === undefined ? '' : projectPlateGroup(scene.projectPlate, scene.view))
}

function zoneGroup(zone: ProjectedZone, view: ProjectionView, zoom: number): string {
  const attributes: Record<string, string> = zone.zone.unidentifiedContainer
    ? { 'data-id': zone.zone.key, 'aria-label': zone.zone.name } : {}
  return svg('g', attributes, 'zone',
    svg('polygon', { points: pointsAttribute(zone.polygon) }, 'ground')
    + surfaceLabel(zone.text, GROUP_FONT, view, 0, zoom))
}

/** System islands carry their architecture identity; actor and external grounds do not. */
export function islandsSvg(scene: ProjectedScene, zoom = 1): string {
  return scene.islands.map(({ island, polygon, text }) => {
    const attributes: Record<string, string> = island.element === null
      ? {} : { 'data-id': island.element.representationId, 'aria-label': island.name }
    return svg('g', attributes, `island ${island.kind}`,
      svg('polygon', { points: pointsAttribute(polygon) }, 'ground')
      + (island.kind === 'system' ? '' : svg('polygon', { points: pointsAttribute(polygon) }, 'pattern'))
      + surfaceLabel(text, ISLAND_FONT, scene.view, ISLAND_SPACING, zoom))
  }).join('') + scene.zones.filter(zone => scene.islands.some(item => item.island.key === zone.zone.parent))
    .map(zone => zoneGroup(zone, scene.view, zoom)).join('')
}

/** Container slabs have hanging sides, external names and zones on top. */
export function slabsSvg(scene: ProjectedScene, zoom = 1): string {
  return scene.slabs.map(({ slab, faces, text }) => {
    const ghost = slab.origin === 'observed' ? '' : ` ghost ${slab.origin}`
    const top = faces.find(face => face.side === 'top')!
    return svg('g', { 'aria-label': slab.title, 'data-id': slab.representationId }, `slab${ghost}`,
      faces.map(face => svg('polygon', { points: pointsAttribute(face.points) }, `face ${face.side}`)).join('')
      + svg('polygon', { points: pointsAttribute(top.points) }, 'pattern')
      + surfaceLabel(text, CONTAINER_FONT, scene.view, 0, zoom)
      + scene.zones.filter(zone => zone.zone.parent === slab.representationId)
        .map(zone => zoneGroup(zone, scene.view, zoom)).join(''))
  }).join('')
}
