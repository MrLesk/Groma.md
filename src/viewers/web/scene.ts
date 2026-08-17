import type {
  ArchitectureWorld,
  Bounds,
  C4Kind,
  Point,
  WorldElement,
  WorldGroup,
  WorldRelationship,
} from '../../types.ts'

/**
 * Camera angles in radians. Elevation is the angle the camera looks down at
 * the ground plane: PI/2 is a flat top-down plan where heights vanish.
 */
export interface Projection {
  rotation: number
  elevation: number
}

/** True isometric: 45° around, arctan(1/√2) down. */
export const defaultProjection: Projection = {
  rotation: Math.PI / 4,
  elevation: Math.atan(1 / Math.sqrt(2)),
}

/** Vertical rise of one containment layer; a parent's slab is exactly this thick. */
export const LAYER_RISE = 8

const prismHeights: Record<C4Kind, number> = {
  person: 9,
  system: 18,
  container: 13,
  component: 6,
}

export interface ScreenPoint {
  x: number
  y: number
}

/** Screen-depth of a ground point: larger means nearer to the viewer. */
function depth(projection: Projection, x: number, y: number): number {
  return x * Math.sin(projection.rotation) + y * Math.cos(projection.rotation)
}

export function project(
  projection: Projection,
  x: number,
  y: number,
  z: number,
): ScreenPoint {
  return {
    x: x * Math.cos(projection.rotation) - y * Math.sin(projection.rotation),
    y: depth(projection, x, y) * Math.sin(projection.elevation)
      - z * Math.cos(projection.elevation),
  }
}

export interface RoutePoint extends Point {
  z: number
}

export type SceneItem =
  | { kind: 'slab'; element: WorldElement; bottom: number; top: number }
  | { kind: 'zone'; group: WorldGroup; z: number }
  | {
    kind: 'route'
    relationship: WorldRelationship
    /** The lower endpoint surface; painter ordering only. */
    z: number
    /** The stepped polyline riding the surfaces the route crosses. */
    path: RoutePoint[]
    labelZ: number
  }
  | { kind: 'prism'; element: WorldElement; bottom: number; top: number }

function contains(bounds: Bounds, x: number, y: number): boolean {
  return x >= bounds.x && x <= bounds.x + bounds.width
    && y >= bounds.y && y <= bounds.y + bounds.height
}

/** The walking height at a ground point: one rise per plate above it. */
function surfaceAt(plates: Bounds[], x: number, y: number): number {
  return LAYER_RISE * plates.filter(plate => contains(plate, x, y)).length
}

/**
 * Splits one 2D segment at every parent boundary it crosses, so each
 * piece lies fully on one surface.
 */
function crossings(from: Point, to: Point, plates: Bounds[]): number[] {
  const ts = new Set([0, 1])
  const dx = to.x - from.x
  const dy = to.y - from.y
  for (const plate of plates) {
    if (dx !== 0) {
      for (const edge of [plate.x, plate.x + plate.width]) {
        const t = (edge - from.x) / dx
        if (t > 0 && t < 1) ts.add(t)
      }
    }
    if (dy !== 0) {
      for (const edge of [plate.y, plate.y + plate.height]) {
        const t = (edge - from.y) / dy
        if (t > 0 && t < 1) ts.add(t)
      }
    }
  }
  return [...ts].sort((left, right) => left - right)
}

/**
 * The route as a trace over the plates: each piece runs at the surface
 * under its midpoint, with a vertical step where the surface changes.
 * A route can never pass under a box.
 */
function elevatedRoute(route: Point[], plates: Bounds[]): RoutePoint[] {
  const path: RoutePoint[] = []
  const push = (x: number, y: number, z: number): void => {
    const last = path[path.length - 1]
    if (last && last.x === x && last.y === y && last.z === z) return
    path.push({ x, y, z })
  }
  for (let index = 0; index < route.length - 1; index += 1) {
    const from = route[index]!
    const to = route[index + 1]!
    const ts = crossings(from, to, plates)
    for (let piece = 0; piece < ts.length - 1; piece += 1) {
      const t0 = ts[piece]!
      const t1 = ts[piece + 1]!
      const mid = (t0 + t1) / 2
      const z = surfaceAt(plates, from.x + (to.x - from.x) * mid, from.y + (to.y - from.y) * mid)
      push(from.x + (to.x - from.x) * t0, from.y + (to.y - from.y) * t0, z)
      push(from.x + (to.x - from.x) * t1, from.y + (to.y - from.y) * t1, z)
    }
  }
  return path
}

/** Elevates the world; ordering is a separate, projection-dependent step. */
export function buildScene(world: ArchitectureWorld): SceneItem[] {
  const byId = new Map(world.elements.map(element => [element.representationId, element]))

  const layers = new Map<string, number>()
  const layerOf = (id: string): number => {
    const cached = layers.get(id)
    if (cached !== undefined) return cached
    const parent = byId.get(id)?.parent
    const layer = parent == null ? 0 : layerOf(parent) + 1
    layers.set(id, layer)
    return layer
  }
  const baseOf = (id: string): number => layerOf(id) * LAYER_RISE

  const items: SceneItem[] = []

  for (const element of world.elements) {
    const bottom = baseOf(element.representationId)
    if (element.children.length > 0) {
      items.push({ kind: 'slab', element, bottom, top: bottom + LAYER_RISE })
    } else {
      items.push({ kind: 'prism', element, bottom, top: bottom + prismHeights[element.kind] })
    }
  }

  for (const group of world.groups) {
    const z = group.parent === null ? 0 : baseOf(group.parent) + LAYER_RISE
    items.push({ kind: 'zone', group, z })
  }

  const plates = world.elements
    .filter(element => element.children.length > 0)
    .map(element => element.bounds)
  for (const relationship of world.relationships) {
    const z = Math.min(baseOf(relationship.source), baseOf(relationship.target))
    items.push({
      kind: 'route',
      relationship,
      z,
      path: elevatedRoute(relationship.route, plates),
      labelZ: relationship.label === null
        ? 0
        : surfaceAt(
          plates,
          relationship.label.x + relationship.label.width / 2,
          relationship.label.y + relationship.label.height / 2,
        ),
    })
  }

  return items
}

// Painter phases within one layer: flat decor on the surface first, then the
// blocks standing on it (which occlude decor passing behind them).
const phases = { zone: 0, route: 1, slab: 2, prism: 2 } as const

function center(projection: Projection, bounds: Bounds): number {
  return depth(projection, bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
}

function sortKey(projection: Projection, item: SceneItem) {
  switch (item.kind) {
    case 'slab':
    case 'prism':
      return { elevation: item.bottom, near: center(projection, item.element.bounds) }
    case 'zone':
      return { elevation: item.z, near: center(projection, item.group.bounds) }
    case 'route':
      return { elevation: item.z, near: 0 }
  }
}

/** Painter order for one projection: draw the result front to back. */
export function orderScene(items: SceneItem[], projection: Projection): SceneItem[] {
  return items.toSorted((left, right) => {
    const a = sortKey(projection, left)
    const b = sortKey(projection, right)
    if (a.elevation !== b.elevation) return a.elevation - b.elevation
    if (phases[left.kind] !== phases[right.kind]) return phases[left.kind] - phases[right.kind]
    return a.near - b.near
  })
}

export function corners(
  projection: Projection,
  bounds: Bounds,
  z: number,
): ScreenPoint[] {
  return [
    project(projection, bounds.x, bounds.y, z),
    project(projection, bounds.x + bounds.width, bounds.y, z),
    project(projection, bounds.x + bounds.width, bounds.y + bounds.height, z),
    project(projection, bounds.x, bounds.y + bounds.height, z),
  ]
}

/** Screen-space box around every projected corner, for the camera fit. */
export function fitScene(items: SceneItem[], projection: Projection): Bounds {
  const points: ScreenPoint[] = []
  for (const item of items) {
    if (item.kind === 'slab' || item.kind === 'prism') {
      points.push(
        ...corners(projection, item.element.bounds, item.bottom),
        ...corners(projection, item.element.bounds, item.top),
      )
    } else if (item.kind === 'zone') {
      points.push(...corners(projection, item.group.bounds, item.z))
    } else {
      points.push(...item.path.map(point => project(projection, point.x, point.y, point.z)))
    }
  }
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  const xs = points.map(point => point.x)
  const ys = points.map(point => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}
