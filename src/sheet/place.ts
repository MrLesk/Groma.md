import { compareElements } from '../element-order.ts'
import type { ArchitectureWorld, WorldElement, WorldRelationship } from '../types.ts'
import { ISLAND_GAP, MARGIN, PAD, shadeOf, translate, unionRects } from './grid.ts'
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
import { grow, shelf } from './pack.ts'
import type { Partnered } from './pack.ts'
import { flowRanks } from './rank.ts'
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

/** The relationships among siblings, lifted from whatever stands inside them. */
interface Lifted {
  /** Siblings something outside them feeds: a person, or anything beyond their surface. */
  entries: Set<string>
  /** Directed edges between siblings, in relationship order. */
  edges: Map<string, string[]>
  /** Every sibling's partners with the number of relationships between them. */
  partners: Map<string, Map<string, number>>
}

function lifted(siblings: readonly Node[], relationships: readonly WorldRelationship[]): Lifted {
  /** The sibling each node inside the surface stands in. */
  const holder = new Map<string, string>()
  const claim = (node: Node, sibling: string): void => {
    holder.set(node.key, sibling)
    for (const inner of node.children) claim(inner.node, sibling)
  }
  for (const sibling of siblings) claim(sibling, sibling.key)
  const result: Lifted = {
    entries: new Set(),
    edges: new Map(),
    partners: new Map(siblings.map(sibling => [sibling.key, new Map()])),
  }
  for (const { source, target } of relationships) {
    const a = holder.get(source)
    const b = holder.get(target)
    if (a === undefined && b !== undefined) result.entries.add(b)
    if (a === undefined || b === undefined || a === b) continue
    result.edges.set(a, [...(result.edges.get(a) ?? []), b])
    result.partners.get(a)!.set(b, (result.partners.get(a)!.get(b) ?? 0) + 1)
    result.partners.get(b)!.set(a, (result.partners.get(b)!.get(a) ?? 0) + 1)
  }
  return result
}

/**
 * A surface holding its children by growth placement (the people and
 * external islands stack theirs in one column), at least as wide as its own
 * name.
 */
function packed(
  key: string,
  children: readonly Node[],
  paint: Node['paint'],
  relationships: readonly WorldRelationship[],
  stack = false,
): Node {
  const { entries, partners } = lifted(children, relationships)
  /**
   * A roof hides the ground to its north and west, so a building claims those
   * cells in the packing and stands that far inside the claim; only its
   * neighbours there move.
   */
  const behind = (child: Node): number => (child.paint.kind === 'building' ? shadeOf(child.paint.floors) : 0)
  const items: Partnered[] = children.map(child => ({
    key: child.key,
    w: child.w + behind(child),
    d: child.d + behind(child),
    entry: entries.has(child.key),
    partners: partners.get(child.key)!,
  }))
  const placed = stack ? shelf(items, 1) : grow(items)
  return {
    key,
    w: Math.max(placed.w, nameWidth(paint)),
    d: placed.d,
    children: children.map(child => {
      const at = placed.at.get(child.key)!
      return { node: child, gx: at.gx + behind(child), gy: at.gy + behind(child) }
    }),
    paint,
  }
}

/**
 * People and external islands are squares with their buildings centred, so a
 * lone building does not sit in the corner of a strip cut for the island's
 * name. The side grows by one cell when the west and east margins would differ.
 */
function squared(node: Node): Node {
  const content = {
    w: Math.max(...node.children.map(child => child.gx + child.node.w)) - PAD,
    d: Math.max(...node.children.map(child => child.gy + child.node.d)) - PAD,
  }
  const side = Math.max(node.w, node.d) + (Math.max(node.w, node.d) - content.w) % 2
  const dx = Math.floor((side - content.w) / 2) - PAD
  const dy = Math.floor((side - content.d) / 2) - PAD
  return {
    ...node,
    w: side,
    d: side,
    children: node.children.map(child => ({ ...child, gx: child.gx + dx, gy: child.gy + dy })),
  }
}

/** Siblings in hierarchy order, with each group's members folded into one zone node where its first member sat. */
function withZones(
  parentKey: string,
  siblings: readonly Node[],
  elements: readonly WorldElement[],
  relationships: readonly WorldRelationship[],
): Node[] {
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
    : packed(key, nodes, { kind: 'zone', name: group, members: nodes.map(member => member.key) }, relationships))
}

export function placeWorld(world: Pick<ArchitectureWorld, 'elements' | 'relationships'>): Placement {
  const degree = new Map<string, number>()
  for (const relationship of world.relationships) {
    degree.set(relationship.source, (degree.get(relationship.source) ?? 0) + 1)
    degree.set(relationship.target, (degree.get(relationship.target) ?? 0) + 1)
  }
  const observedLines = world.elements
    .filter(element => element.kind === 'component' && element.origin === 'observed')
    .map(element => element.codeLines ?? 0)
  const range = { min: Math.min(...observedLines), max: Math.max(...observedLines) }
  const childrenOf = (parent: string | null): WorldElement[] => world.elements
    .filter(element => element.parent === parent)
    .sort(compareElements)

  const building = (element: WorldElement): Node => {
    const shape: Shape = element.kind === 'person'
      ? { kind: 'round', levels: 1 }
      : element.external ? { kind: 'pill', levels: 1 } : shapeOf(element.code.length)
    const lines = shape.kind === 'pill' ? [element.name] : roofLines(element.name)
    const floors = element.kind === 'component' ? floorsOf(element.origin, element.codeLines ?? 0, range) : 1
    const { w, d } = footprintOf(lines, shape, degree.get(element.representationId) ?? 0)
    return { key: element.representationId, w, d, children: [], paint: { kind: 'building', element, floors, shape, lines } }
  }
  const slab = (container: WorldElement): Node => {
    const components = childrenOf(container.representationId).filter(child => child.kind === 'component')
    return packed(
      container.representationId,
      withZones(container.representationId, components.map(building), components, world.relationships),
      { kind: 'slab', element: container },
      world.relationships,
    )
  }
  const systemIsland = (system: WorldElement): Node => {
    const containers = childrenOf(system.representationId).filter(child => child.kind === 'container')
    return packed(
      system.representationId,
      withZones(system.representationId, containers.map(slab), containers, world.relationships),
      { kind: 'island', islandKind: 'system', name: system.name, element: system },
      world.relationships,
    )
  }
  const roots = childrenOf(null)
  const people = roots.filter(element => element.kind === 'person')
  const systems = roots.filter(element => element.kind === 'system' && !element.external)
  const externals = roots.filter(element => element.kind === 'system' && element.external)

  const islands: Node[] = []
  if (people.length > 0) {
    islands.push(squared(packed(PEOPLE_ISLAND, people.map(building),
      { kind: 'island', islandKind: 'people', name: 'People', element: null }, world.relationships, true)))
  }
  const systemIslands = systems.map(systemIsland)
  const externalIslands = externals.length === 0 ? [] : [squared(packed(EXTERNAL_ISLAND, externals.map(building),
    { kind: 'island', islandKind: 'external', name: 'External systems', element: null }, world.relationships, true))]
  const all = [...islands, ...systemIslands, ...externalIslands]
  const { entries, edges } = lifted(all, world.relationships)
  const ranks = flowRanks(all.map(island => island.key), entries, edges)
  const rankOf = (island: Node): number => ranks.get(island.key) ?? Number.MAX_SAFE_INTEGER
  islands.push(...systemIslands.sort((a, b) => rankOf(a) - rankOf(b)), ...externalIslands)
  return collect(islands, placeRow(islands, world.relationships))
}

/**
 * Islands in one row along +gx in the order given (people, systems by the
 * flow among them, externals), their centres on one gy line, ISLAND_GAP
 * cells apart; then the people and external islands slide along gy so the
 * centre of their buildings faces the centre of what those buildings talk to.
 */
function placeRow(islands: readonly Node[], relationships: readonly WorldRelationship[]): CellRect[] {
  const deepest = Math.max(0, ...islands.map(island => island.d))
  const origins: CellRect[] = []
  let gx = 0
  for (const island of islands) {
    origins.push({ gx, gy: Math.round((deepest - island.d) / 2), w: island.w, d: island.d })
    gx += island.w + ISLAND_GAP
  }
  const rects = new Map<string, CellRect>()
  const islandOf = new Map<string, string>()
  const walk = (node: Node, rect: CellRect, island: string): void => {
    rects.set(node.key, rect)
    islandOf.set(node.key, island)
    for (const child of node.children) {
      walk(child.node, { gx: rect.gx + child.gx, gy: rect.gy + child.gy, w: child.node.w, d: child.node.d }, island)
    }
  }
  islands.forEach((island, index) => walk(island, origins[index]!, island.key))
  const centre = (id: string): number => rects.get(id)!.gy + rects.get(id)!.d / 2
  islands.forEach((island, index) => {
    if (island.paint.kind !== 'island' || island.paint.islandKind === 'system') return
    let shift = 0
    let count = 0
    for (const { source, target } of relationships) {
      const inside = islandOf.get(source) === island.key
      if (inside === (islandOf.get(target) === island.key)) continue
      shift += inside ? centre(target) - centre(source) : centre(source) - centre(target)
      count += 1
    }
    if (count > 0) origins[index] = translate(origins[index]!, 0, Math.round(shift / count))
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
