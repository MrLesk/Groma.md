import { compareElements } from '../element-order.ts'
import type { ArchitectureWorld, WorldElement } from '../types.ts'
import { ISLAND_GAP, MARGIN, translate, unionRects } from './grid.ts'
import {
  ISLAND_FONT,
  ISLAND_SPACING,
  SURFACE_FONT,
  floorsOf,
  footprintOf,
  nameCells,
  roofLines,
  shapeOf,
} from './measure.ts'
import { shelf } from './pack.ts'
import type {
  Building,
  CellRect,
  Island,
  IslandKind,
  Shape,
  SheetItem,
  Slab,
  Zone,
} from './types.ts'

const PEOPLE_ISLAND = 'island:people'
const EXTERNAL_ISLAND = 'island:external'

/** A packed subtree: its size in cells and where each child sits relative to its north corner. */
interface Node {
  key: string
  w: number
  d: number
  children: { node: Node; gx: number; gy: number }[]
  paint:
    | { kind: 'building'; element: WorldElement; floors: number; shape: Shape; lines: string[] }
    | { kind: 'slab'; element: WorldElement }
    | { kind: 'zone'; name: string; members: string[] }
    | { kind: 'island'; islandKind: IslandKind; name: string; element: WorldElement | null }
}

export interface Placement {
  sheet: CellRect
  islands: Island[]
  zones: Zone[]
  slabs: Slab[]
  buildings: Building[]
}

function item(element: WorldElement): SheetItem {
  return {
    representationId: element.representationId,
    id: element.id,
    name: element.name,
    origin: element.origin,
  }
}

/** The cells a surface's own name needs in its front band. */
function nameWidth(paint: Node['paint']): number {
  if (paint.kind === 'island') return nameCells(paint.name.toUpperCase(), ISLAND_FONT, ISLAND_SPACING)
  if (paint.kind === 'zone') return nameCells(paint.name, SURFACE_FONT)
  if (paint.kind === 'slab') return nameCells(paint.element.name, SURFACE_FONT)
  return 0
}

/** A surface holding its packed children, at least as wide as its own name. */
function packed(
  key: string,
  children: readonly Node[],
  paint: Node['paint'],
  cols?: number,
): Node {
  const packedShelf = shelf(children.map(child => ({ key: child.key, w: child.w, d: child.d })), cols)
  return {
    key,
    w: Math.max(packedShelf.w, nameWidth(paint)),
    d: packedShelf.d,
    children: children.map(child => ({ node: child, ...packedShelf.at.get(child.key)! })),
    paint,
  }
}

/** Siblings in hierarchy order, with each group's members folded into one zone node where its first member sat. */
function withZones(parentKey: string, siblings: readonly Node[], elements: readonly WorldElement[]): Node[] {
  const groupOf = new Map(elements.map(element => [element.representationId, element.group]))
  const buckets = new Map<string, { group: string | undefined; nodes: Node[] }>()
  for (const node of siblings) {
    const group = groupOf.get(node.key)
    const key = group === undefined ? node.key : `group:${parentKey}:${group}`
    const bucket = buckets.get(key) ?? { group, nodes: [] }
    bucket.nodes.push(node)
    buckets.set(key, bucket)
  }
  return [...buckets].map(([key, { group, nodes }]) => group === undefined
    ? nodes[0]!
    : packed(key, nodes, { kind: 'zone', name: group, members: nodes.map(member => member.key) }))
}

export function placeWorld(world: Pick<ArchitectureWorld, 'elements' | 'relationships'>): Placement {
  const degree = new Map<string, number>()
  for (const relationship of world.relationships) {
    degree.set(relationship.source, (degree.get(relationship.source) ?? 0) + 1)
    degree.set(relationship.target, (degree.get(relationship.target) ?? 0) + 1)
  }
  const childrenOf = (parent: string | null): WorldElement[] => world.elements
    .filter(element => element.parent === parent)
    .sort(compareElements)

  const building = (element: WorldElement): Node => {
    const lines = roofLines(element.name)
    const shape = element.kind === 'component' ? shapeOf(element.code.length) : shapeOf(0)
    const floors = element.kind === 'component' ? floorsOf(element.origin, element.codeLines ?? 0) : 1
    const { w, d } = footprintOf(lines, shape, degree.get(element.representationId) ?? 0)
    return { key: element.representationId, w, d, children: [], paint: { kind: 'building', element, floors, shape, lines } }
  }
  const slab = (container: WorldElement): Node => {
    const components = childrenOf(container.representationId).filter(child => child.kind === 'component')
    return packed(
      container.representationId,
      withZones(container.representationId, components.map(building), components),
      { kind: 'slab', element: container },
    )
  }
  const systemIsland = (system: WorldElement): Node => {
    const containers = childrenOf(system.representationId).filter(child => child.kind === 'container')
    return packed(
      system.representationId,
      withZones(system.representationId, containers.map(slab), containers),
      { kind: 'island', islandKind: 'system', name: system.name, element: system },
    )
  }
  const roots = childrenOf(null)
  const people = roots.filter(element => element.kind === 'person')
  const systems = roots.filter(element => element.kind === 'system' && !element.external)
  const externals = roots.filter(element => element.kind === 'system' && element.external)

  const islands: Node[] = []
  if (people.length > 0) {
    islands.push(packed(PEOPLE_ISLAND, people.map(building),
      { kind: 'island', islandKind: 'people', name: 'People', element: null }, 1))
  }
  islands.push(...systems.map(systemIsland))
  if (externals.length > 0) {
    islands.push(packed(EXTERNAL_ISLAND, externals.map(building),
      { kind: 'island', islandKind: 'external', name: 'External systems', element: null }, 1))
  }
  return collect(islands, placeRow(islands))
}

/**
 * Islands on one screen row, people at the left, externals at the right: moving
 * along the anti-diagonal shifts an island right on screen, moving along the
 * main diagonal shifts it down, so each island gets `t` for its column and `s`
 * to align its centre with the widest island.
 */
function placeRow(islands: readonly Node[]): CellRect[] {
  const spans = islands.map(island => island.w + island.d)
  const widest = Math.max(0, ...spans)
  const origins: CellRect[] = []
  let t = 0
  islands.forEach((island, index) => {
    if (index > 0) {
      const previous = islands[index - 1]!
      t += Math.ceil((previous.w + island.d + ISLAND_GAP) / 2)
    }
    const s = Math.round((widest - spans[index]!) / 4)
    origins.push({ gx: t + s, gy: s - t, w: island.w, d: island.d })
  })
  const union = unionRects(origins)
  if (!union) return origins
  return origins.map(origin => translate(origin, MARGIN - union.gx, MARGIN - union.gy))
}

function collect(islands: readonly Node[], origins: readonly CellRect[]): Placement {
  const placement: Placement = {
    sheet: { gx: 0, gy: 0, w: 0, d: 0 },
    islands: [],
    zones: [],
    slabs: [],
    buildings: [],
  }
  const visit = (node: Node, rect: CellRect, surface: string, islandKey: string): void => {
    const paint = node.paint
    if (paint.kind === 'island') {
      placement.islands.push({
        key: node.key,
        kind: paint.islandKind,
        name: paint.name,
        element: paint.element === null ? null : item(paint.element),
        rect,
      })
    } else if (paint.kind === 'slab') {
      placement.slabs.push({ ...item(paint.element), island: islandKey, rect })
    } else if (paint.kind === 'zone') {
      placement.zones.push({ key: node.key, name: paint.name, parent: surface, members: paint.members, rect })
    } else {
      placement.buildings.push({
        ...item(paint.element),
        kind: paint.element.kind,
        external: paint.element.external,
        surface,
        rect,
        floors: paint.floors,
        shape: paint.shape,
        lines: paint.lines,
      })
    }
    const childSurface = paint.kind === 'zone' ? surface : node.key
    for (const child of node.children) {
      visit(
        child.node,
        { gx: rect.gx + child.gx, gy: rect.gy + child.gy, w: child.node.w, d: child.node.d },
        childSurface,
        paint.kind === 'island' ? node.key : islandKey,
      )
    }
  }
  islands.forEach((island, index) => visit(island, origins[index]!, island.key, island.key))
  const union = unionRects(origins)
  placement.sheet = union
    ? { gx: 0, gy: 0, w: union.gx + union.w + MARGIN, d: union.gy + union.d + MARGIN }
    : { gx: 0, gy: 0, w: 2 * MARGIN, d: 2 * MARGIN }
  return placement
}
