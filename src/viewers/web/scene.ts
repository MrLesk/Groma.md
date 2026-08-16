import type {
  ArchitectureWorld,
  Bounds,
  C4Kind,
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

export const defaultProjection: Projection = {
  rotation: Math.PI / 6,
  elevation: Math.PI / 4,
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

export type SceneItem =
  | { kind: 'slab'; element: WorldElement; bottom: number; top: number }
  | { kind: 'zone'; group: WorldGroup; z: number }
  | { kind: 'route'; relationship: WorldRelationship; z: number }
  | { kind: 'prism'; element: WorldElement; bottom: number; top: number }

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

  for (const relationship of world.relationships) {
    const z = Math.min(baseOf(relationship.source), baseOf(relationship.target))
    items.push({ kind: 'route', relationship, z })
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
      points.push(...item.relationship.route.map(point => project(projection, point.x, point.y, item.z)))
    }
  }
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  const xs = points.map(point => point.x)
  const ys = points.map(point => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}
