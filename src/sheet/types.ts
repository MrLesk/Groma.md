import type { C4Kind, Origin, WorldRelationship } from '../types.ts'

/** A rectangle of whole grid cells: `gx`, `gy` is the north corner, `w` runs along gx, `d` along gy. */
export interface CellRect {
  gx: number
  gy: number
  w: number
  d: number
}

/** What every drawn element carries, so a painter never looks the world up. */
export interface SheetItem {
  representationId: string
  id: string
  name: string
  origin: Origin
}

export type IslandKind = 'people' | 'external' | 'system'

/** A flat island on the sheet. People and external systems share one island each; every internal system has its own. */
export interface Island {
  key: string
  kind: IslandKind
  name: string
  /** The system element, for system islands only. */
  element: SheetItem | null
  rect: CellRect
}

/** A narrative group drawn as a flat zone around its members, on an island or on a slab deck. */
export interface Zone {
  key: string
  name: string
  /** Island key or slab representation id the zone lies on. */
  parent: string
  members: string[]
  rect: CellRect
}

/** A container: a low slab on its system island. */
export interface Slab extends SheetItem {
  island: string
  rect: CellRect
}

export interface Shape {
  kind: 'block' | 'stack' | 'tower'
  levels: number
}

/** A component, person or external system standing on a slab or island. */
export interface Building extends SheetItem {
  kind: C4Kind
  external: boolean
  /** Slab representation id or island key the building stands on. */
  surface: string
  rect: CellRect
  floors: number
  shape: Shape
  /** The name as laid on the roof, one or two lines. */
  lines: string[]
}

export interface RoutePoint {
  gx: number
  gy: number
  /** Floors above the sheet: the surface under the point, with risers where it changes. */
  z: number
}

/** One authored relationship routed on the quarter-cell lattice. */
export type Route = Pick<WorldRelationship, 'id' | 'source' | 'target' | 'description' | 'origin'> & {
  points: RoutePoint[]
}

export interface SheetScene {
  /** The lattice domain in whole cells; islands sit at least MARGIN cells inside it. */
  sheet: CellRect
  islands: Island[]
  zones: Zone[]
  slabs: Slab[]
  buildings: Building[]
  routes: Route[]
}
