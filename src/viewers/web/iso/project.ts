import { MARGIN, PAD } from '../../../sheet/grid.ts'
import type {
  Building,
  CellRect,
  Island,
  Route,
  SheetScene,
  Slab,
  Zone,
} from '../../../sheet/types.ts'
import type { Bounds, Point } from '../../../types.ts'

/** A cell is a 48 × 24 diamond; a floor is 12 px tall, so a roof's shadow is exactly half a cell per floor and lands on the lattice. 2:1 dimetric keeps every lattice point on integers. */
const CELL_X = 24
const CELL_Y = 12
export const FLOOR = 12

/** Insets of each stack tier above the one below, in cells per side. */
const TIER_INSET = 0.25
/** Screen pixels a slab's thickness hangs below the grid line: its top is the ground, its sides are drawn over the island in front of it. */
const SLAB_HANG = 3
/** The compass rose: a circle of this many cells lying in the sheet's west corner. */
const COMPASS_RADIUS = 1
/** Cells between a needle tip and its letter. */
const COMPASS_LETTER = 0.4
/** Cells each arm of a corner tick runs along its grid axis. */
const TICK = 0.25

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

export interface Segment {
  from: Point
  to: Point
}

/** A compass rose lying on the sheet, its needles on the grid's axes: N is −gy, up and to the right on screen. */
export interface Compass {
  /** The rose's centre on the sheet. */
  at: { gx: number; gy: number }
  centre: Point
  rx: number
  ry: number
  /** Four-point star: the N, E, S and W tips with a notch between each pair. */
  star: Point[]
  /** The north half of the star, filled. */
  north: Point[]
  letters: { text: string; at: Point }[]
}

export interface ProjectedScene {
  /** The sheet's border. */
  frame: Point[]
  /** Crop marks at the sheet's four corners, two arms each along the grid's axes; the grid itself is endless. */
  ticks: Segment[]
  compass: Compass
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

/** Stack tiers from the ground up, each inset a quarter cell per side and sharing the floors equally. */
function buildingTiers(building: Building): Face[][] {
  const levels = building.shape.levels
  const tierHeight = building.floors / levels
  const tiers: Face[][] = []
  for (let level = 0; level < levels; level += 1) {
    tiers.push(boxFaces(inset(building.rect, TIER_INSET * level), level * tierHeight, (level + 1) * tierHeight))
  }
  return tiers
}

/** A building's name starts at its roof's north corner. */
function roofText(rect: CellRect, z: number, lines: string[]): SurfaceText {
  return { origin: project(rect.gx, rect.gy, z), lines }
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

/** Two arms per corner, each along one grid axis. */
function ticksOf(sheet: CellRect): Segment[] {
  const cornersOf = [
    [sheet.gx, sheet.gy], [sheet.gx + sheet.w, sheet.gy],
    [sheet.gx + sheet.w, sheet.gy + sheet.d], [sheet.gx, sheet.gy + sheet.d],
  ]
  return cornersOf.flatMap(([gx, gy]) => [
    { from: project(gx! - TICK, gy!, 0), to: project(gx! + TICK, gy!, 0) },
    { from: project(gx!, gy! - TICK, 0), to: project(gx!, gy! + TICK, 0) },
  ])
}

/** The rose lies in the middle of the sheet's west corner, clear of the border; a circle on the sheet projects to a 2:1 ellipse. */
function compassOf(sheet: CellRect): Compass {
  const at = { gx: sheet.gx + MARGIN / 2, gy: sheet.gy + sheet.d - MARGIN / 2 }
  const on = (dx: number, dy: number): Point => project(at.gx + dx, at.gy + dy, 0)
  const r = COMPASS_RADIUS
  const n = 0.18 * r
  const tip = r + COMPASS_LETTER
  return {
    at,
    centre: on(0, 0),
    rx: r * CELL_X * Math.SQRT2,
    ry: r * CELL_Y * Math.SQRT2,
    star: [on(0, -r), on(n, -n), on(r, 0), on(n, n), on(0, r), on(-n, n), on(-r, 0), on(-n, -n)],
    north: [on(0, -r), on(n, -n), on(0, 0), on(-n, -n)],
    letters: [
      { text: 'N', at: on(0, -tip) },
      { text: 'E', at: on(tip, 0) },
      { text: 'S', at: on(0, tip) },
      { text: 'W', at: on(-tip, 0) },
    ],
  }
}

/** Projects the sheet into screen polygons, route polylines and surface text, ready to paint. */
export function projectScene(scene: SheetScene): ProjectedScene {
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
  const buildings = paintOrder(scene.buildings).map(building => {
    const roof = inset(building.rect, TIER_INSET * (building.shape.levels - 1))
    return {
      building,
      tiers: buildingTiers(building),
      text: roofText(roof, building.floors, building.lines),
    }
  })
  const routes = scene.routes.map(route => {
    const points = route.points.map(point => project(point.gx, point.gy, 0))
    const last = route.points[route.points.length - 1]!
    const before = route.points[route.points.length - 2] ?? last
    const turn = last.gx > before.gx ? 0 : last.gy > before.gy ? 90 : last.gx < before.gx ? 180 : 270
    return { route, points, arrow: { at: points[points.length - 1]!, turn } }
  })
  const frame = corners(scene.sheet, 0)
  return {
    frame,
    ticks: ticksOf(scene.sheet),
    compass: compassOf(scene.sheet),
    islands,
    zones,
    slabs,
    routes,
    buildings,
    bounds: boundsOf([
      ...frame,
      ...buildings.flatMap(item => item.tiers.flatMap(tier => tier.flatMap(face => face.points))),
    ]),
  }
}
