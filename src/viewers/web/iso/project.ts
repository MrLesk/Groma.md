import { PAD, SLAB_RISE } from '../../../sheet/grid.ts'
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

/** A cell is a 48 × 24 diamond; a floor is 14 px tall. 2:1 dimetric keeps every lattice point on integers. */
const CELL_X = 24
const CELL_Y = 12
export const FLOOR = 14

/** Insets of each stack tier above the one below, in cells per side. */
const TIER_INSET = 0.25

export function project(gx: number, gy: number, z: number): Point {
  return { x: (gx - gy) * CELL_X, y: (gx + gy) * CELL_Y - z * FLOOR }
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
  arrow: { at: Point; angle: number }
}

export interface Segment {
  from: Point
  to: Point
}

export interface ProjectedScene {
  sheet: { polygon: Point[]; minor: Segment[]; major: Segment[] }
  islands: ProjectedIsland[]
  zones: ProjectedZone[]
  slabs: ProjectedSlab[]
  routes: ProjectedRoute[]
  /** Painter order, back to front. */
  buildings: ProjectedBuilding[]
  /** Everything but the sheet, for the fitted camera. */
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

/** Stack tiers from the bottom up, each inset a quarter cell per side and sharing the floors equally. */
function buildingTiers(building: Building, base: number): Face[][] {
  const levels = building.shape.levels
  const tierHeight = building.floors / levels
  const tiers: Face[][] = []
  for (let level = 0; level < levels; level += 1) {
    tiers.push(boxFaces(
      inset(building.rect, TIER_INSET * level),
      base + level * tierHeight,
      base + (level + 1) * tierHeight,
    ))
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

function gridSegments(sheet: CellRect): { minor: Segment[]; major: Segment[] } {
  const minor: Segment[] = []
  const major: Segment[] = []
  for (let gx = sheet.gx; gx <= sheet.gx + sheet.w; gx += 1) {
    const segment = { from: project(gx, sheet.gy, 0), to: project(gx, sheet.gy + sheet.d, 0) }
    ;(gx % 4 === 0 ? major : minor).push(segment)
  }
  for (let gy = sheet.gy; gy <= sheet.gy + sheet.d; gy += 1) {
    const segment = { from: project(sheet.gx, gy, 0), to: project(sheet.gx + sheet.w, gy, 0) }
    ;(gy % 4 === 0 ? major : minor).push(segment)
  }
  return { minor, major }
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
export function projectScene(scene: SheetScene): ProjectedScene {
  const slabRise = new Map(scene.slabs.map(slab => [slab.representationId, SLAB_RISE]))
  const surfaceZ = (surface: string): number => slabRise.get(surface) ?? 0

  const islands = scene.islands.map(island => ({
    island,
    polygon: corners(island.rect, 0),
    text: bandText(island.rect, 0, [island.name.toUpperCase()]),
  }))
  const zones = scene.zones.map(zone => ({
    zone,
    polygon: corners(zone.rect, surfaceZ(zone.parent)),
    text: bandText(zone.rect, surfaceZ(zone.parent), [zone.name]),
  }))
  const slabs = paintOrder(scene.slabs).map(slab => ({
    slab,
    faces: boxFaces(slab.rect, 0, SLAB_RISE),
    text: bandText(slab.rect, SLAB_RISE, [slab.name]),
  }))
  const buildings = paintOrder(scene.buildings).map(building => {
    const base = surfaceZ(building.surface)
    const roof = inset(building.rect, TIER_INSET * (building.shape.levels - 1))
    return {
      building,
      tiers: buildingTiers(building, base),
      text: roofText(roof, base + building.floors, building.lines),
    }
  })
  const routes = scene.routes.map(route => {
    const points = route.points.map(point => project(point.gx, point.gy, point.z))
    const last = points[points.length - 1]!
    const before = points[points.length - 2] ?? last
    return {
      route,
      points,
      arrow: { at: last, angle: (Math.atan2(last.y - before.y, last.x - before.x) * 180) / Math.PI },
    }
  })
  const allPoints = [
    ...islands.flatMap(item => item.polygon),
    ...buildings.flatMap(item => item.tiers.flatMap(tier => tier.flatMap(face => face.points))),
    ...routes.flatMap(item => item.points),
  ]
  return {
    sheet: { polygon: corners(scene.sheet, 0), ...gridSegments(scene.sheet) },
    islands,
    zones,
    slabs,
    routes,
    buildings,
    bounds: boundsOf(allPoints),
  }
}
