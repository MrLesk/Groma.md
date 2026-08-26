import type { AnnotatedRelationship, C4Kind, Origin } from '../types.ts'

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

export type IslandKind = 'actors' | 'external' | 'system'

/** A flat island on the sheet. Actors and external systems share one island each; every internal system has its own. */
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

/** A container: a slab level with its system island. */
export interface Slab extends SheetItem {
  island: string
  rect: CellRect
}

/** A component's block; an actor's round building; an external system's pill. */
export type Shape =
  { kind: 'block' | 'round' | 'pill' }

/** Source files combined into one visible floor of a component building. */
export interface BuildingFloor {
  files: string[]
  /** Facade pattern chosen from the largest member; grouped files may have other types. */
  facadeFileType: string
  heightUnits: number
  footprint: { w: number; d: number }
}

/** A component, actor or external system standing on a slab or island. */
export interface Building extends SheetItem {
  kind: C4Kind
  external: boolean
  /** Slab representation id or island key the building stands on. */
  surface: string
  /** Complete tower envelope reserved by packing. */
  rect: CellRect
  heightUnits: number
  shape: Shape
  floors: BuildingFloor[]
  /** The name as laid on the roof, one or two lines. */
  lines: string[]
}

/** A lattice point on the ground plane; every route runs there. */
export interface RoutePoint {
  gx: number
  gy: number
}

/** One authored relationship routed on the quarter-cell lattice. */
export type Route = Pick<AnnotatedRelationship, 'id' | 'source' | 'target' | 'description' | 'origin'> & {
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
