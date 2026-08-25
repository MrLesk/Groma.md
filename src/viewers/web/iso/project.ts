import { PAD, ROOF_SHADOW } from '../../../sheet/grid.ts'
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

/** A cell is a 48 × 24 diamond; a floor is 12 px tall, so a roof's shadow is exactly half a cell per floor and lands on the lattice. 2:1 dimetric keeps every lattice point on integers. */
const CELL_X = 24
const CELL_Y = 12
export const FLOOR = 12

/** Insets of each stack tier above the one below, in cells per side. */
const TIER_INSET = 0.25
/** Straight segments drawn along a semicircle of a curved roof. */
const ARC_STEPS = 16
/** Screen pixels a slab's thickness hangs below the grid line: its top is the ground, its sides are drawn over the island in front of it. */
const SLAB_HANG = 3

export function project(gx: number, gy: number, z: number): Point {
  return { x: (gx - gy) * CELL_X, y: (gx + gy) * CELL_Y - z * FLOOR }
}

/** The planes the viewer sees. Every flat decoration (names, patterns, compass letters) is drawn in plane pixels and laid onto the screen by one matrix per plane. */
export type Plane = 'ground' | 'left' | 'right'

/** Screen vector of one plane pixel along each plane axis: 24 plane pixels make a cell, 14 make a floor. */
const PLANE_AXES: Record<Plane, [Point, Point]> = {
  ground: [project(1 / CELL_X, 0, 0), project(0, 1 / CELL_X, 0)],
  left: [project(0, 1 / CELL_X, 0), project(0, 0, 1 / FLOOR)],
  right: [project(1 / CELL_X, 0, 0), project(0, 0, 1 / FLOOR)],
}

/** The SVG matrix that lays a plane's pixels onto the screen with the plane's origin at `origin`. */
export function planeMatrix(plane: Plane, origin: Point = { x: 0, y: 0 }): string {
  const [u, v] = PLANE_AXES[plane]
  const fixed = (value: number): string => String(Math.round(value * 100) / 100)
  return `matrix(${fixed(u.x)} ${fixed(u.y)} ${fixed(v.x)} ${fixed(v.y)} ${fixed(origin.x)} ${fixed(origin.y)})`
}

export interface Face {
  side: 'top' | 'left' | 'right'
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
  /** Bottom tier first; each tier is left, right, top. */
  tiers: Face[][]
  text: SurfaceText
}

export interface ProjectedRoute {
  route: Route
  points: Point[]
  /** The arrowhead lies on the sheet at the route's end, turned in plane degrees along the last step. */
  arrow: { at: Point; turn: number }
}

export interface ProjectedScene extends Blueprint {
  islands: ProjectedIsland[]
  zones: ProjectedZone[]
  slabs: ProjectedSlab[]
  routes: ProjectedRoute[]
  /** Painter order, back to front. */
  buildings: ProjectedBuilding[]
  /** What the fitted camera shows: the framed sheet and every roof above it. */
  bounds: Bounds
}

function corners(rect: CellRect, z: number): Point[] {
  return [
    project(rect.gx, rect.gy, z),
    project(rect.gx + rect.w, rect.gy, z),
    project(rect.gx + rect.w, rect.gy + rect.d, z),
    project(rect.gx, rect.gy + rect.d, z),
  ]
}

/** The three faces the viewer sees of a box standing on `rect` between two heights. */
export function boxFaces(rect: CellRect, z0: number, z1: number): Face[] {
  const [n0, e0, s0, w0] = corners(rect, z0)
  const [n1, e1, s1, w1] = corners(rect, z1)
  return [
    { side: 'left', points: [w0!, s0!, s1!, w1!] },
    { side: 'right', points: [e0!, s0!, s1!, e1!] },
    { side: 'top', points: [n1!, e1!, s1!, w1!] },
  ]
}

/** Farther footprints first: the viewer stands past the south corner. */
function depthKey(rect: CellRect): number {
  return rect.gx + rect.w + rect.gy + rect.d
}

export function paintOrder<T extends { rect: CellRect }>(items: readonly T[]): T[] {
  return [...items].sort((left, right) =>
    depthKey(left.rect) - depthKey(right.rect) || left.rect.gx - right.rect.gx)
}

function inset(rect: CellRect, by: number): CellRect {
  return { gx: rect.gx + by, gy: rect.gy + by, w: rect.w - 2 * by, d: rect.d - 2 * by }
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
  const { radius, west, east, middle } = stadium(rect, shadowed ? building.floors * ROOF_SHADOW : 0)
  /** Half the chord the outline cuts on a line `off` from the middle. A port sits inside a side at least two radii long, so the root is always real. */
  const half = (off: number): number => Math.sqrt(Math.max(0, radius * radius - off * off))
  if (point.gy === towards.gy) {
    const chord = half(point.gy - middle)
    return { gx: point.gx < towards.gx ? east + chord : west - chord, gy: point.gy }
  }
  const chord = half(point.gx - Math.min(Math.max(point.gx, west), east))
  return { gx: point.gx, gy: point.gy < towards.gy ? middle + chord : middle - chord }
}

/**
 * The roof and the one front band of a curved building: the ring between its
 * screen-left and screen-right extremes along the base and back along the
 * top. Stepping back through the ring from the left extreme reaches the right
 * extreme along the front, the part turned to the viewer. The band is the
 * left face for tint and pattern.
 */
function curvedFaces(outline: readonly { gx: number; gy: number }[], z0: number, z1: number): Face[] {
  const base = outline.map(point => project(point.gx, point.gy, z0))
  const top = outline.map(point => project(point.gx, point.gy, z1))
  const extreme = (better: (a: Point, b: Point) => boolean): number =>
    base.reduce((best, point, index) => (better(point, base[best]!) ? index : best), 0)
  const left = extreme((a, b) => a.x < b.x)
  const right = extreme((a, b) => a.x > b.x)
  const band: number[] = []
  for (let index = left; ; index = (index - 1 + base.length) % base.length) {
    band.push(index)
    if (index === right) break
  }
  return [
    { side: 'left', points: [...band.map(index => base[index]!), ...band.map(index => top[index]!).reverse()] },
    { side: 'top', points: top },
  ]
}

/** A box stacks tiers from the ground up, each inset a quarter cell per side and sharing the floors equally; a round building or pill is one curved tier. */
function buildingTiers(building: Building): Face[][] {
  if (curved(building.shape)) return [curvedFaces(roofOutline(building.rect), 0, building.floors)]
  const levels = building.shape.levels
  const tierHeight = building.floors / levels
  const tiers: Face[][] = []
  for (let level = 0; level < levels; level += 1) {
    tiers.push(boxFaces(inset(building.rect, TIER_INSET * level), level * tierHeight, (level + 1) * tierHeight))
  }
  return tiers
}

/** A box's name starts at the north corner of its top tier's roof; a curved roof centres the name's block. */
function roofText(building: Building): SurfaceText {
  const { shape, floors, lines } = building
  const roof = inset(building.rect, TIER_INSET * (shape.levels - 1))
  if (!curved(shape)) return { origin: project(roof.gx, roof.gy, floors), lines }
  const block = roofBlock(lines)
  return { origin: project(roof.gx + (roof.w - block.w / PLANE) / 2, roof.gy + (roof.d - block.d / PLANE) / 2, floors), lines }
}

/** A surface's own name lies in its front band along the west corner, in front of every child. */
function bandText(rect: CellRect, z: number, lines: string[]): SurfaceText {
  return { origin: project(rect.gx, rect.gy + rect.d - PAD, z), lines }
}

function boundsOf(points: readonly Point[]): Bounds {
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
export function projectScene(scene: SheetScene, profile?: ProjectProfile): ProjectedScene {
  const islands = scene.islands.map(island => ({
    island,
    polygon: corners(island.rect, 0),
    text: bandText(island.rect, 0, [island.name.toUpperCase()]),
  }))
  const zones = scene.zones.map(zone => ({
    zone,
    polygon: corners(zone.rect, 0),
    text: bandText(zone.rect, 0, [zone.name]),
  }))
  const slabs = paintOrder(scene.slabs).map(slab => ({
    slab,
    faces: boxFaces(slab.rect, -SLAB_HANG / FLOOR, 0),
    text: bandText(slab.rect, 0, [slab.name]),
  }))
  const buildings = paintOrder(scene.buildings).map(building => ({
    building,
    tiers: buildingTiers(building),
    text: roofText(building),
  }))
  const standing = new Map(scene.buildings.map(building => [building.representationId, building]))
  const routes = scene.routes.map(route => {
    const cells = [...route.points]
    const end = cells.length - 1
    cells[0] = onWall(cells[0]!, cells[1]!, standing.get(route.source))
    cells[end] = onWall(cells[end]!, cells[end - 1]!, standing.get(route.target))
    const points = cells.map(point => project(point.gx, point.gy, 0))
    const last = cells[end]!
    const before = cells[end - 1]!
    const turn = last.gx > before.gx ? 0 : last.gy > before.gy ? 90 : last.gx < before.gx ? 180 : 270
    return { route, points, arrow: { at: points[end]!, turn } }
  })
  const blueprint = projectBlueprint(scene.sheet, profile, project)
  return {
    ...blueprint,
    islands,
    zones,
    slabs,
    routes,
    buildings,
    bounds: boundsOf([
      ...blueprint.frame,
      ...buildings.flatMap(item => item.tiers.flatMap(tier => tier.flatMap(face => face.points))),
    ]),
  }
}
