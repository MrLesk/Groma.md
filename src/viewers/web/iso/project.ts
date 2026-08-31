import { PAD, ROOF_SHADOW, centredRect } from '../../../sheet/grid.ts'
import { PLANE, curved, roofBlock } from '../../../sheet/measure.ts'
import type {
  Building,
  CellRect,
  RoutePoint,
  Island,
  Route,
  SheetScene,
  Slab,
  Zone,
} from '../../../sheet/types.ts'
import type { ProjectProfile } from '../../../project-profile.ts'
import type { Bounds, Point } from '../../../types.ts'
import { projectBlueprint } from './blueprint.ts'
import type { Blueprint } from './blueprint.ts'

/** A cell is a 48 × 24 diamond; one height unit is 12 px. */
const CELL_X = 24
const CELL_Y = 12
export const HEIGHT_UNIT = 12
const DEFAULT_YAW = 45
const DEFAULT_PITCH = 30
const RAD = Math.PI / 180
const WORLD_SCALE = CELL_X / Math.cos(DEFAULT_YAW * RAD)
const HEIGHT_SCALE = HEIGHT_UNIT / Math.cos(DEFAULT_PITCH * RAD)
/** Straight segments drawn along a semicircle of a curved roof. */
const ARC_STEPS = 16
/** Screen pixels a slab's thickness hangs below the grid line: its top is the ground, its sides are drawn over the island in front of it. */
const SLAB_HANG = 3

export interface ProjectionView {
  yaw: number
  pitch: number
}

export const DEFAULT_PROJECTION: ProjectionView = { yaw: DEFAULT_YAW, pitch: DEFAULT_PITCH }

/** Orthographic projection around the vertical axis. The default pose is the original 2:1 isometric view. */
export function project(gx: number, gy: number, z: number, view: ProjectionView = DEFAULT_PROJECTION): Point {
  if (view.yaw === DEFAULT_YAW && view.pitch === DEFAULT_PITCH) {
    return { x: (gx - gy) * CELL_X, y: (gx + gy) * CELL_Y - z * HEIGHT_UNIT }
  }
  const yaw = view.yaw * RAD
  const pitch = view.pitch * RAD
  const depth = gx * Math.sin(yaw) + gy * Math.cos(yaw)
  return {
    x: (gx * Math.cos(yaw) - gy * Math.sin(yaw)) * WORLD_SCALE,
    y: depth * WORLD_SCALE * Math.sin(pitch) - z * HEIGHT_SCALE * Math.cos(pitch),
  }
}

/** The planes the viewer sees. Every flat decoration (names, patterns, compass letters) is drawn in plane pixels and laid onto the screen by one matrix per plane. */
export type Plane = 'ground' | 'left' | 'right'

/** Screen vector of one plane pixel along each plane axis. */
function planeAxes(view: ProjectionView): Record<Plane, [Point, Point]> {
  return {
    ground: [project(1 / CELL_X, 0, 0, view), project(0, 1 / CELL_X, 0, view)],
    left: [project(0, 1 / CELL_X, 0, view), project(0, 0, 1 / HEIGHT_UNIT, view)],
    right: [project(1 / CELL_X, 0, 0, view), project(0, 0, 1 / HEIGHT_UNIT, view)],
  }
}

/** The SVG matrix that lays a plane's pixels onto the screen with the plane's origin at `origin`. */
export function planeMatrix(
  plane: Plane,
  origin: Point = { x: 0, y: 0 },
  view: ProjectionView = DEFAULT_PROJECTION,
): string {
  const [u, v] = planeAxes(view)[plane]
  const fixed = (value: number): string => String(Math.round(value * 100) / 100)
  return `matrix(${fixed(u.x)} ${fixed(u.y)} ${fixed(v.x)} ${fixed(v.y)} ${fixed(origin.x)} ${fixed(origin.y)})`
}

export interface Face {
  side: 'top' | 'left' | 'right'
  /** Wall axis used to lay facade marks onto this face; roofs have no wall plane. */
  plane?: Extract<Plane, 'left' | 'right'>
  points: Point[]
}

/** Text lying on a surface: the plane's north corner on screen and the lines to lay along +gx. */
export interface SurfaceText {
  origin: Point
  lines: string[]
}

export interface ProjectedIsland {
  island: Island
  polygon: Point[]
  text: SurfaceText
}

export interface ProjectedZone {
  zone: Zone
  polygon: Point[]
  text: SurfaceText
}

export interface ProjectedSlab {
  slab: Slab
  /** Top level with the ground, sides hanging below it. */
  faces: Face[]
  text: SurfaceText
}

export interface ProjectedBuilding {
  building: Building
  /** Bottom floor first; each floor has visible side and roof faces. */
  floors: Face[][]
  text: SurfaceText
}

export interface ProjectedRoute {
  route: Route
  points: Point[]
  /** The arrowhead lies on the sheet at the route's end, turned in plane degrees along the last step. */
  arrow: { at: Point; turn: number }
}

export interface ProjectedScene extends Blueprint {
  view: ProjectionView
  islands: ProjectedIsland[]
  zones: ProjectedZone[]
  slabs: ProjectedSlab[]
  routes: ProjectedRoute[]
  /** Painter order, back to front. */
  buildings: ProjectedBuilding[]
  /** What the fitted camera shows: the framed sheet and every roof above it. */
  bounds: Bounds
}

function corners(rect: CellRect, z: number, view: ProjectionView): Point[] {
  return [
    project(rect.gx, rect.gy, z, view),
    project(rect.gx + rect.w, rect.gy, z, view),
    project(rect.gx + rect.w, rect.gy + rect.d, z, view),
    project(rect.gx, rect.gy + rect.d, z, view),
  ]
}

/** The three faces the viewer sees of a box standing on `rect` between two heights. */
export function boxFaces(rect: CellRect, z0: number, z1: number, view: ProjectionView = DEFAULT_PROJECTION): Face[] {
  const [n0, e0, s0, w0] = corners(rect, z0, view)
  const [n1, e1, s1, w1] = corners(rect, z1, view)
  const yaw = view.yaw * RAD
  const centre = project(rect.gx + rect.w / 2, rect.gy + rect.d / 2, (z0 + z1) / 2, view)
  const walls: Omit<Face, 'side'>[] = []
  if (Math.abs(Math.sin(yaw)) > 1e-8) {
    walls.push(Math.sin(yaw) > 0
      ? { plane: 'left', points: [e0!, s0!, s1!, e1!] }
      : { plane: 'left', points: [n0!, w0!, w1!, n1!] })
  }
  if (Math.abs(Math.cos(yaw)) > 1e-8) {
    walls.push(Math.cos(yaw) > 0
      ? { plane: 'right', points: [w0!, s0!, s1!, w1!] }
      : { plane: 'right', points: [n0!, e0!, e1!, n1!] })
  }
  const visible = walls.map(face => ({
    ...face,
    side: face.points.reduce((sum, point) => sum + point.x, 0) / face.points.length < centre.x
      ? 'left' as const
      : 'right' as const,
  })).sort((left, right) => left.side === right.side ? 0 : left.side === 'left' ? -1 : 1)
  return [...visible, { side: 'top', points: [n1!, e1!, s1!, w1!] }]
}

/** Farther footprints first: the viewer stands past the south corner. */
function depthKey(rect: CellRect, view: ProjectionView): number {
  const yaw = view.yaw * RAD
  const gx = Math.sin(yaw) >= 0 ? rect.gx + rect.w : rect.gx
  const gy = Math.cos(yaw) >= 0 ? rect.gy + rect.d : rect.gy
  return gx * Math.sin(yaw) + gy * Math.cos(yaw)
}

export function paintOrder<T extends { rect: CellRect }>(
  items: readonly T[],
  view: ProjectionView = DEFAULT_PROJECTION,
): T[] {
  return [...items].sort((left, right) =>
    depthKey(left.rect, view) - depthKey(right.rect, view) || left.rect.gx - right.rect.gx)
}

/** A curved footprint in ground cells: every point `radius` from the segment between the two cap centres, which runs from `west` to `east` along `middle`; in a square the caps share a centre and the shape is a circle. `back` slides the shape north-west, under a roof that hides that much ground. */
function stadium(rect: CellRect, back = 0): { radius: number; west: number; east: number; middle: number } {
  const radius = Math.min(rect.w, rect.d) / 2
  return {
    radius,
    west: rect.gx + radius - back,
    east: rect.gx + rect.w - radius - back,
    middle: rect.gy + rect.d / 2 - back,
  }
}

/** Points around a curved roof: the ring starts at the east cap's north, runs over its east to the south, and returns along the west cap. */
function roofOutline(rect: CellRect): { gx: number; gy: number }[] {
  const { radius, west, east, middle } = stadium(rect)
  const arc = (cx: number, from: number, to: number): { gx: number; gy: number }[] => Array.from(
    { length: ARC_STEPS + 1 },
    (_, step) => {
      const t = from + ((to - from) * step) / ARC_STEPS
      return { gx: cx + radius * Math.cos(t), gy: middle + radius * Math.sin(t) }
    },
  )
  return [...arc(east, -Math.PI / 2, Math.PI / 2), ...arc(west, Math.PI / 2, (3 * Math.PI) / 2)]
}

/**
 * Where a route meets a curved building: it was routed against the square
 * footprint, so an off-centre end sits beside the wall rather than on it. A
 * route leaves and meets a side square on, so the end slides along its own
 * axis onto the near wall of the shape, and the line reaches what the viewer sees
 * instead of stopping beside it. An end west or north of the footprint is the
 * anchor of a back side, which the router already placed where the roof's
 * shadow ends, so the shape slides under the roof to meet it there.
 */
function onWall(point: RoutePoint, towards: RoutePoint, building: Building | undefined): RoutePoint {
  if (building === undefined || !curved(building.shape)) return point
  const { rect } = building
  const shadowed = point.gx < rect.gx || point.gy < rect.gy
  const { radius, west, east, middle } = stadium(rect, shadowed ? building.heightUnits * ROOF_SHADOW : 0)
  /** Half the chord the outline cuts on a line `off` from the middle. A port sits inside a side at least two radii long, so the root is always real. */
  const half = (off: number): number => Math.sqrt(Math.max(0, radius * radius - off * off))
  if (point.gy === towards.gy) {
    const chord = half(point.gy - middle)
    return { gx: point.gx < towards.gx ? east + chord : west - chord, gy: point.gy }
  }
  const chord = half(point.gx - Math.min(Math.max(point.gx, west), east))
  return { gx: point.gx, gy: point.gy < towards.gy ? middle + chord : middle - chord }
}

function cross(left: Point, right: Point): number {
  return left.x * right.y - left.y * right.x
}

function rayEdgeDistance(origin: Point, direction: Point, start: Point, end: Point): number | null {
  const edge = { x: end.x - start.x, y: end.y - start.y }
  const divisor = cross(direction, edge)
  if (Math.abs(divisor) < 1e-9) return null
  const offset = { x: start.x - origin.x, y: start.y - origin.y }
  const distance = cross(offset, edge) / divisor
  const position = cross(offset, direction) / divisor
  return distance > 1e-9 && position >= -1e-9 && position <= 1 + 1e-9 ? distance : null
}

/**
 * A stepped tower is routed against its largest footprint, but its highest
 * visible face may be narrower. Extend the short endpoint leg until it first
 * meets a face the viewer can see, so the line never stops on the invisible
 * full-size roof used only for obstacle clearance.
 */
function onVisibleBuilding(
  at: Point,
  from: Point,
  building: ProjectedBuilding | undefined,
): Point {
  if (building === undefined || curved(building.building.shape) || building.building.floors.length === 0) return at
  const direction = { x: at.x - from.x, y: at.y - from.y }
  const distances: number[] = []
  for (const face of building.floors.flat()) {
    for (let index = 0; index < face.points.length; index += 1) {
      const distance = rayEdgeDistance(
        from,
        direction,
        face.points[index]!,
        face.points[(index + 1) % face.points.length]!,
      )
      if (distance !== null) distances.push(distance)
    }
  }
  const distance = Math.min(...distances)
  return Number.isFinite(distance)
    ? { x: from.x + direction.x * distance, y: from.y + direction.y * distance }
    : at
}

/**
 * The roof and the one front band of a curved building: the ring between its
 * screen-left and screen-right extremes along the base and back along the
 * top. Stepping back through the ring from the left extreme reaches the right
 * extreme along the front, the part turned to the viewer. The band is the
 * left face for tint and pattern.
 */
function curvedFaces(
  outline: readonly { gx: number; gy: number }[],
  z0: number,
  z1: number,
  view: ProjectionView,
): Face[] {
  const base = outline.map(point => project(point.gx, point.gy, z0, view))
  const top = outline.map(point => project(point.gx, point.gy, z1, view))
  const extreme = (better: (a: Point, b: Point) => boolean): number =>
    base.reduce((best, point, index) => (better(point, base[best]!) ? index : best), 0)
  const left = extreme((a, b) => a.x < b.x)
  const right = extreme((a, b) => a.x > b.x)
  const path = (step: -1 | 1): number[] => {
    const indices: number[] = []
    for (let index = left; ; index = (index + step + base.length) % base.length) {
      indices.push(index)
      if (index === right) return indices
    }
  }
  const yaw = view.yaw * RAD
  const depth = (index: number): number => {
    const point = outline[index]!
    return point.gx * Math.sin(yaw) + point.gy * Math.cos(yaw)
  }
  const paths = [path(-1), path(1)]
  const band = paths.reduce((front, candidate) => {
    const mean = (indices: number[]): number => indices.reduce((sum, index) => sum + depth(index), 0) / indices.length
    return mean(candidate) > mean(front) ? candidate : front
  })
  return [
    {
      side: 'left',
      plane: Math.abs(Math.sin(yaw)) > Math.abs(Math.cos(yaw)) ? 'left' : 'right',
      points: [...band.map(index => base[index]!), ...band.map(index => top[index]!).reverse()],
    },
    { side: 'top', points: top },
  ]
}

function sameFootprint(left: CellRect, right: CellRect): boolean {
  return left.gx === right.gx && left.gy === right.gy && left.w === right.w && left.d === right.d
}

/** File floors rise from the ground on one centred tower axis. */
function buildingFloors(building: Building, view: ProjectionView): Face[][] {
  if (curved(building.shape)) {
    return [curvedFaces(roofOutline(building.rect), 0, building.heightUnits, view)]
  }
  if (building.floors.length === 0) return [boxFaces(building.rect, 0, building.heightUnits, view)]
  const rects = building.floors.map(floor => centredRect(building.rect, floor.footprint))
  const faces: Face[][] = []
  let height = 0
  for (const [index, floor] of building.floors.entries()) {
    const rect = rects[index]!
    const nextHeight = height + floor.heightUnits
    const floorFaces = boxFaces(rect, height, nextHeight, view)
    const next = rects[index + 1]
    if (next !== undefined && sameFootprint(rect, next)) floorFaces.pop()
    faces.push(floorFaces)
    height = nextHeight
  }
  return faces
}

/** A box's name starts at the north corner of its top tier's roof; a curved roof centres the name's block. */
function roofText(building: Building, view: ProjectionView): SurfaceText {
  const { shape, heightUnits, lines } = building
  const top = building.floors.at(-1)
  const roof = top === undefined ? building.rect : centredRect(building.rect, top.footprint)
  if (!curved(shape)) return { origin: project(roof.gx, roof.gy, heightUnits, view), lines }
  const block = roofBlock(lines)
  return {
    origin: project(
      roof.gx + (roof.w - block.w / PLANE) / 2,
      roof.gy + (roof.d - block.d / PLANE) / 2,
      heightUnits,
      view,
    ),
    lines,
  }
}

/** A surface's own name lies in its front band along the west corner, in front of every child. */
function bandText(rect: CellRect, z: number, lines: string[], view: ProjectionView): SurfaceText {
  return { origin: project(rect.gx, rect.gy + rect.d - PAD, z, view), lines }
}

export function boundsOf(points: readonly Point[]): Bounds {
  if (points.length === 0) return { x: 0, y: 0, width: 1, height: 1 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  return { x: minX, y: minY, width: Math.max(maxX - minX, 1), height: Math.max(maxY - minY, 1) }
}

/** Projects the sheet into screen polygons, route polylines and surface text, ready to paint. */
export function projectScene(
  scene: SheetScene,
  profile?: ProjectProfile,
  view: ProjectionView = DEFAULT_PROJECTION,
): ProjectedScene {
  const islands = scene.islands.map(island => ({
    island,
    polygon: corners(island.rect, 0, view),
    text: bandText(island.rect, 0, [island.name.toUpperCase()], view),
  }))
  const zones = scene.zones.map(zone => ({
    zone,
    polygon: corners(zone.rect, 0, view),
    text: bandText(zone.rect, 0, [zone.name], view),
  }))
  const slabs = paintOrder(scene.slabs, view).map(slab => ({
    slab,
    faces: boxFaces(slab.rect, -SLAB_HANG / HEIGHT_UNIT, 0, view),
    text: bandText(slab.rect, 0, [slab.title], view),
  }))
  const buildings = paintOrder(scene.buildings, view).map(building => ({
    building,
    floors: buildingFloors(building, view),
    text: roofText(building, view),
  }))
  const standing = new Map(scene.buildings.map(building => [building.representationId, building]))
  const visibleBuildings = new Map(buildings.map(building => [building.building.representationId, building]))
  const routes = scene.routes.map(route => {
    const cells = [...route.points]
    const end = cells.length - 1
    cells[0] = onWall(cells[0]!, cells[1]!, standing.get(route.source))
    cells[end] = onWall(cells[end]!, cells[end - 1]!, standing.get(route.target))
    const points = cells.map(point => project(point.gx, point.gy, 0, view))
    points[0] = onVisibleBuilding(points[0]!, points[1]!, visibleBuildings.get(route.source))
    points[end] = onVisibleBuilding(points[end]!, points[end - 1]!, visibleBuildings.get(route.target))
    const last = cells[end]!
    const before = cells[end - 1]!
    const turn = last.gx > before.gx ? 0 : last.gy > before.gy ? 90 : last.gx < before.gx ? 180 : 270
    return { route, points, arrow: { at: points[end]!, turn } }
  })
  const blueprint = projectBlueprint(scene.sheet, profile, (gx, gy, z) => project(gx, gy, z, view))
  return {
    ...blueprint,
    view,
    islands,
    zones,
    slabs,
    routes,
    buildings,
    bounds: boundsOf([
      ...blueprint.frame,
      ...buildings.flatMap(item => item.floors.flatMap(floor => floor.flatMap(face => face.points))),
    ]),
  }
}
