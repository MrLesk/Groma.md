import type {
  ArchitectureWorld,
  Bounds,
  C4Kind,
  WorldElement,
  WorldGroup,
  WorldRelationship,
} from '../../types.ts'

export const ISO_X = Math.cos(Math.PI / 6)
export const ISO_Y = Math.sin(Math.PI / 6)

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

export function project(x: number, y: number, z: number): ScreenPoint {
  return { x: (x - y) * ISO_X, y: (x + y) * ISO_Y - z }
}

export type SceneItem =
  | { kind: 'slab'; element: WorldElement; bottom: number; top: number }
  | { kind: 'zone'; group: WorldGroup; z: number }
  | { kind: 'route'; relationship: WorldRelationship; z: number }
  | { kind: 'prism'; element: WorldElement; bottom: number; top: number }

export interface IsoScene {
  /** Already in painter order: draw front to back of this array. */
  items: SceneItem[]
  /** Screen-space box around every projected corner, for the initial camera fit. */
  fit: Bounds
}

// Painter phases within one layer: flat decor on the surface first, then the
// blocks standing on it (which occlude decor passing behind them).
const phases = { zone: 0, route: 1, slab: 2, prism: 2 } as const

function nearness(bounds: Bounds): number {
  return bounds.x + bounds.width / 2 + bounds.y + bounds.height / 2
}

function sortKey(item: SceneItem) {
  switch (item.kind) {
    case 'slab':
    case 'prism':
      return { elevation: item.bottom, near: nearness(item.element.bounds) }
    case 'zone':
      return { elevation: item.z, near: nearness(item.group.bounds) }
    case 'route':
      return { elevation: item.z, near: 0 }
  }
}

export function buildScene(world: ArchitectureWorld): IsoScene {
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

  items.sort((left, right) => {
    const a = sortKey(left)
    const b = sortKey(right)
    if (a.elevation !== b.elevation) return a.elevation - b.elevation
    if (phases[left.kind] !== phases[right.kind]) return phases[left.kind] - phases[right.kind]
    return a.near - b.near
  })

  return { items, fit: fitBox(items) }
}

export function corners(bounds: Bounds, z: number): ScreenPoint[] {
  return [
    project(bounds.x, bounds.y, z),
    project(bounds.x + bounds.width, bounds.y, z),
    project(bounds.x + bounds.width, bounds.y + bounds.height, z),
    project(bounds.x, bounds.y + bounds.height, z),
  ]
}

function fitBox(items: SceneItem[]): Bounds {
  const points: ScreenPoint[] = []
  for (const item of items) {
    if (item.kind === 'slab' || item.kind === 'prism') {
      points.push(...corners(item.element.bounds, item.bottom), ...corners(item.element.bounds, item.top))
    } else if (item.kind === 'zone') {
      points.push(...corners(item.group.bounds, item.z))
    } else {
      points.push(...item.relationship.route.map(point => project(point.x, point.y, item.z)))
    }
  }
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  const xs = points.map(point => point.x)
  const ys = points.map(point => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}
