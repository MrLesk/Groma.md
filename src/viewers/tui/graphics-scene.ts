import type { Bounds, Point } from '../../types.ts'
import { buildingFont, CONTAINER_FONT, GROUP_FONT, ISLAND_FONT, textLineHeight, textPadding } from '../../sheet/measure.ts'
import { boundsOf, planeMatrix, projectScene } from '../web/iso/project.ts'
import type { ProjectedScene, SurfaceText } from '../web/iso/project.ts'
import { mapDefs } from '../web/iso/style.ts'
import type { TerminalViewModel } from './model.ts'
import type { ViewerState } from './navigation.ts'
import { insideGraphics } from './graphics-camera.ts'
import type { GraphicsCamera, PixelSize } from './graphics-camera.ts'

export interface GraphicsHit { id: string; polygon: Point[] }
export interface GraphicsScene { projected: ProjectedScene; hits: GraphicsHit[]; bounds: Map<string, Bounds> }

/** Fixed, axis-aligned plan: full footprints and horizontal labels without changing the source sheet. */
export function graphicsScene(model: TerminalViewModel): GraphicsScene {
  const sheet = {
    ...model.sheet,
    buildings: model.sheet.buildings.map(building => ({ ...building, heightUnits: 0, floors: [] })),
  }
  const projected = projectScene(sheet, model.project, { yaw: 0, pitch: 90 })
  const hits: GraphicsHit[] = [
    ...projected.islands.flatMap(item => item.island.element === null ? [] : [{ id: item.island.element.representationId, polygon: item.polygon }]),
    ...projected.slabs.flatMap(item => item.faces.filter(face => face.side === 'top').map(face => ({ id: item.slab.representationId, polygon: face.points }))),
    ...projected.buildings.flatMap(item => item.floors.flatMap(floor => floor.filter(face => face.side === 'top').map(face => ({ id: item.building.representationId, polygon: face.points })))),
  ]
  const points = new Map<string, Point[]>()
  for (const hit of hits) points.set(hit.id, [...points.get(hit.id) ?? [], ...hit.polygon])
  return { projected, hits, bounds: new Map([...points].map(([id, points]) => [id, boundsOf(points)])) }
}

/** Same C4 scope semantics as the text map, using the geometry actually displayed. */
export function graphicsAnchors(scene: GraphicsScene, model: TerminalViewModel, state: Pick<ViewerState, 'level'>): Map<string, Bounds> {
  const eligible = new Set(model.elements.filter(element => state.level === 'components'
    ? element.kind === 'component'
    : element.kind !== 'component').map(element => element.representationId))
  return new Map([...scene.bounds].filter(([id]) => eligible.has(id)))
}

export function graphicsHit(scene: GraphicsScene, point: Point, model: TerminalViewModel, state: Pick<ViewerState, 'level'>): string | undefined {
  const byId = new Map(model.elements.map(element => [element.representationId, element]))
  const hit = scene.hits.findLast(hit => insideGraphics(point, hit.polygon))
  let element = hit === undefined ? undefined : byId.get(hit.id)
  if (state.level === 'components') return element?.kind === 'component' ? element.representationId : undefined
  while (element?.kind === 'component') element = element.parent === null ? undefined : byId.get(element.parent)
  return element?.representationId
}

export function graphicsScope(scene: GraphicsScene, model: TerminalViewModel, state: Pick<ViewerState, 'level' | 'currentId'>): Bounds {
  if (state.level === 'context') return scene.projected.bounds
  const byId = new Map(model.elements.map(element => [element.representationId, element]))
  let element = state.currentId === undefined ? undefined : byId.get(state.currentId)
  while (element && element.kind !== 'container') element = element.parent === null ? undefined : byId.get(element.parent)
  if (!element) return scene.projected.bounds
  const ids = new Set([element.representationId, ...element.children])
  return boundsOf(scene.hits.filter(hit => ids.has(hit.id)).flatMap(hit => hit.polygon))
}

const PAPER = '#131b23'
const INK = '#b9c9d5'
const ACCENT = '#40d8a0'
const pointsOf = (points: readonly Point[]): string => points.map(point => `${point.x},${point.y}`).join(' ')
const escapeXml = (value: string): string => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!)

function polygon(points: readonly Point[], fill: string, selected: boolean, extra = ''): string {
  return `<polygon points="${pointsOf(points)}" fill="${fill}" stroke="${selected ? ACCENT : INK}" stroke-width="${selected ? 2.5 : 0.7}" vector-effect="non-scaling-stroke" ${extra}/>`
}

function textOnSurface(text: SurfaceText, size: number, scene: ProjectedScene): string {
  const lines = text.lines.map((line, index) => `<text x="${textPadding(size)}" y="${textPadding(size) + size * 0.9 + index * textLineHeight(size)}" font-size="${size}">${escapeXml(line)}</text>`).join('')
  return `<g transform="${planeMatrix('ground', text.origin, scene.view)}" fill="${INK}" font-family="sans-serif">${lines}</g>`
}

function paintBuilding(item: ProjectedScene['buildings'][number], scene: ProjectedScene, selectedId: string | undefined): string {
  const selected = item.building.representationId === selectedId
  const faces = item.floors.flat().filter(face => face.side === 'top').map(face =>
    polygon(face.points, '#425a69', selected, item.building.origin === 'draft' ? 'stroke-dasharray="5 4"' : '')).join('')
  return `${faces}${textOnSurface(item.text, buildingFont(item.building), scene)}`
}

/** Explicit arrow geometry avoids resvg's crash on SVG markers outside a zoomed viewport. */
function routeArrow(points: readonly Point[], scale: number, color: string): string {
  const end = points.at(-1)
  const before = points.at(-2)
  if (!end || !before) return ''
  const length = Math.hypot(end.x - before.x, end.y - before.y)
  if (length < 0.000001) return ''
  const dx = (end.x - before.x) / length * 7 / scale
  const dy = (end.y - before.y) / length * 7 / scale
  const arrow = [end, { x: end.x - dx - dy / 2, y: end.y - dy + dx / 2 }, { x: end.x - dx + dy / 2, y: end.y - dy - dx / 2 }]
  return `<polygon points="${pointsOf(arrow)}" fill="${color}"/>`
}

/** Fully resolved SVG: no browser, CSS variables, external resources, or architecture mutation. */
export function graphicsSvg(scene: GraphicsScene, camera: GraphicsCamera, size: PixelSize, selectedId?: string, pathIds: ReadonlySet<string> = new Set()): string {
  const projected = scene.projected
  const defs = mapDefs(projected.view).replaceAll('var(--map-hatch)', '#768e9e')
  const islands = projected.islands.map(item => polygon(item.polygon, '#1b2833', selectedId !== undefined && item.island.element?.representationId === selectedId)
    + textOnSurface(item.text, ISLAND_FONT, projected)).join('')
  const slabs = projected.slabs.map(item => item.faces.filter(face => face.side === 'top').map(face => polygon(face.points, '#243542', item.slab.representationId === selectedId)).join('')
    + textOnSurface(item.text, CONTAINER_FONT, projected)).join('')
  const zones = projected.zones.map(item => polygon(item.polygon, 'url(#hatch-ground)', false)
    + textOnSurface(item.text, GROUP_FONT, projected)).join('')
  const routes = projected.routes.map(item => {
    const lit = (item.route.relationshipIds ?? [item.route.id]).some(id => pathIds.has(id))
    return `<polyline points="${pointsOf(item.points)}" fill="none" stroke="${lit ? ACCENT : INK}" stroke-width="${lit ? 2.5 : 1}" vector-effect="non-scaling-stroke" ${item.route.origin === 'draft' ? 'stroke-dasharray="5 4"' : ''}/>${routeArrow(item.points, camera.scale, lit ? ACCENT : INK)}`
  }).join('')
  const buildings = projected.buildings.map(item => paintBuilding(item, projected, selectedId)).join('')
  const translate = `${size.width / 2 - camera.center.x * camera.scale} ${size.height / 2 - camera.center.y * camera.scale}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}"><defs>${defs}</defs><rect width="100%" height="100%" fill="${PAPER}"/><g transform="translate(${translate}) scale(${camera.scale})">${polygon(projected.frame, '#18232c', false)}${islands}${slabs}${zones}${routes}${buildings}</g></svg>`
}
