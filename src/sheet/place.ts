import { compareSemanticElements } from '../element-order.ts'
import type { AnnotatedElement, AnnotatedRelationship, ArchitectureGraph } from '../types.ts'
import { composePlacement } from './compose.ts'
import { GAP, ISLAND_GAP, NESTED_CONTENT_PAD } from './forces.ts'
import { MARGIN, PAD, shadeOf, translate, unionRects } from './grid.ts'
import {
  ISLAND_FONT,
  ISLAND_SPACING,
  CONTAINER_FONT,
  GROUP_FONT,
  buildingFont,
  labelBand,
  type FileMeasureRanges,
  fileMeasureRanges,
  footprintOf,
  floorsOf,
  nameCells,
  roofLines,
} from './measure.ts'
import { grow, shelf } from './pack.ts'
import type { Partnered } from './pack.ts'
import { flowRanks } from './rank.ts'
import { mapRelationships } from './relationships.ts'
import { connectionCounts, portSideCells, routeReach } from './route-space.ts'
import type {
  Building,
  BuildingFloor,
  CellRect,
  Island,
  IslandKind,
  Shape,
  SheetItem,
  Slab,
  Zone,
} from './types.ts'

const ACTORS_ISLAND = 'island:actors'
const EXTERNAL_ISLAND = 'island:external'

/** A packed subtree: its size in cells and where each child sits relative to its north corner. */
interface Node {
  key: string
  w: number
  d: number
  connections: number
  children: { node: Node; gx: number; gy: number }[]
  paint:
    | { kind: 'building'; element: AnnotatedElement; heightUnits: number; shape: Shape; floors: BuildingFloor[]; lines: string[] }
    | { kind: 'slab'; element: AnnotatedElement }
    | { kind: 'zone'; name: string; members: string[] }
    | { kind: 'island'; islandKind: IslandKind; name: string; element: AnnotatedElement | null }
}

export interface Placement {
  sheet: CellRect
  islands: Island[]
  zones: Zone[]
  slabs: Slab[]
  buildings: Building[]
}

function item(element: AnnotatedElement): SheetItem {
  return {
    representationId: element.representationId,
    id: element.id,
    title: element.title,
    origin: element.origin,
  }
}

function buildingNode(element: AnnotatedElement, ranges: FileMeasureRanges, degree: number): Node {
  const shape: Shape = element.kind === 'actor'
    ? { kind: 'round' }
    : element.external ? { kind: 'pill' } : { kind: 'block' }
  const size = buildingFont(element)
  const lines = shape.kind === 'pill' ? [element.title] : roofLines(element.title, size)
  const base = footprintOf(lines, shape, degree, size)
  const floors = element.kind === 'component'
    ? floorsOf(element.origin, element.code, ranges, base)
    : []
  const heightUnits = element.kind !== 'component'
    ? 1
    : floors.reduce((total, floor) => total + floor.heightUnits, 0) || 1
  const w = Math.max(base.w, ...floors.map(floor => floor.footprint.w))
  const d = Math.max(base.d, ...floors.map(floor => floor.footprint.d))
  return { key: element.representationId, w, d, connections: degree, children: [], paint: { kind: 'building', element, heightUnits, shape, floors, lines } }
}

/** Reserve a node's connection fan beyond the minimum gap already supplied by packing. */
function routeMargin(node: Node): number {
  return Math.max(0, routeReach(node.connections) - GAP / 2)
}

function subtreeConnections(key: string, children: readonly Node[], relationships: readonly Pick<AnnotatedRelationship, 'source' | 'target'>[]): number {
  const keys = new Set([key])
  const visit = (node: Node): void => {
    keys.add(node.key)
    for (const child of node.children) visit(child.node)
  }
  for (const child of children) visit(child)
  return relationships.filter(relationship => keys.has(relationship.source) || keys.has(relationship.target)).length
}

/** The cells a surface's own name needs in its front band. */
function nameWidth(paint: Node['paint']): number {
  if (paint.kind === 'island') return nameCells(paint.name.toUpperCase(), ISLAND_FONT, ISLAND_SPACING)
  if (paint.kind === 'zone') return nameCells(paint.name, GROUP_FONT)
  if (paint.kind === 'slab') return nameCells(paint.element.title, CONTAINER_FONT)
  return 0
}

/** The relationships among siblings, lifted from whatever stands inside them. */
interface Lifted {
  /** Siblings something outside them feeds: an actor, or anything beyond their surface. */
  entries: Set<string>
  /** Directed edges between siblings, in relationship order. */
  edges: Map<string, string[]>
  /** Every sibling's partners with the number of relationships between them. */
  partners: Map<string, Map<string, number>>
}

function lifted(siblings: readonly Node[], relationships: readonly Pick<AnnotatedRelationship, 'source' | 'target'>[]): Lifted {
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
 * A surface holding its children by growth placement (the actors and
 * external islands stack theirs in one column), at least as wide as its own
 * name.
 */
function packed(
  key: string,
  children: readonly Node[],
  paint: Node['paint'],
  relationships: readonly Pick<AnnotatedRelationship, 'source' | 'target'>[],
  stack = false,
): Node {
  const { entries, partners } = lifted(children, relationships)
  /**
   * A roof hides the ground to its north and west, so a building claims those
   * cells in the packing and stands that far inside the claim; only its
   * neighbours there move.
   */
  const behind = (child: Node): number => (child.paint.kind === 'building' ? shadeOf(child.paint.heightUnits) : 0)
  const items: Partnered[] = children.map(child => ({
    key: child.key,
    w: child.w + behind(child) + 2 * routeMargin(child),
    d: child.d + behind(child) + 2 * routeMargin(child),
    entry: entries.has(child.key),
    partners: partners.get(child.key)!,
  }))
  const placed = stack ? shelf(items, 1) : grow(items)
  /** Systems, slabs and zones share the roomier nested-surface inset; the centred actors and external islands stay compact. */
  const connections = subtreeConnections(key, children, relationships)
  const ownPorts = connectionCounts(relationships).get(key) ?? 0
  const portSide = Math.ceil(portSideCells(ownPorts))
  const minimumPadding = paint.kind === 'island' && paint.islandKind !== 'system' ? PAD : NESTED_CONTENT_PAD
  const padding = Math.max(minimumPadding, routeReach(connections))
  const extra = padding - PAD
  const font = paint.kind === 'island' ? ISLAND_FONT : paint.kind === 'slab' ? CONTAINER_FONT : GROUP_FONT
  return {
    key,
    connections,
    w: Math.max(placed.w + 2 * extra, nameWidth(paint) + 2 * extra, portSide),
    d: Math.max(placed.d + 2 * extra + labelBand(font), portSide),
    children: children.map(child => {
      const at = placed.at.get(child.key)!
      return { node: child, gx: at.gx + behind(child) + routeMargin(child) + extra, gy: at.gy + behind(child) + routeMargin(child) + extra }
    }),
    paint,
  }
}

/**
 * Actors and external islands are squares with their buildings centred above the name band, so a
 * lone building does not sit in the corner of a strip cut for the island's
 * name. Centring preserves the complete roof and connection allowance.
 */
function squared(node: Node): Node {
  const content = unionRects(node.children.map(child => ({
    gx: child.gx, gy: child.gy, w: child.node.w, d: child.node.d,
  })))!
  const shadow = Math.max(...node.children.map(child =>
    child.node.paint.kind === 'building' ? shadeOf(child.node.paint.heightUnits) : 0))
  const padding = Math.max(PAD, routeReach(node.connections)) + shadow
  const band = labelBand(ISLAND_FONT)
  const side = Math.max(node.w, node.d, content.w + 2 * padding, content.d + band + 2 * padding)
  const dx = (side - content.w) / 2 - content.gx
  const dy = (side - band - content.d) / 2 - content.gy
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
  elements: readonly AnnotatedElement[],
  relationships: readonly Pick<AnnotatedRelationship, 'source' | 'target'>[],
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

export function placeWorld(world: ArchitectureGraph): Placement {
  const relationships = mapRelationships(world)
  const degree = connectionCounts(relationships)
  const ranges = fileMeasureRanges(world.elements)
  const childrenOf = (parent: string | null): AnnotatedElement[] => world.elements
    .filter(element => element.parent === parent)
    .sort(compareSemanticElements)

  const building = (element: AnnotatedElement): Node =>
    buildingNode(element, ranges, degree.get(element.representationId) ?? 0)
  const slab = (container: AnnotatedElement): Node => {
    const components = childrenOf(container.representationId).filter(child => child.kind === 'component')
    return packed(
      container.representationId,
      withZones(container.representationId, components.map(building), components, relationships),
      { kind: 'slab', element: container },
      relationships,
    )
  }
  const systemIsland = (system: AnnotatedElement): Node => {
    const containers = childrenOf(system.representationId).filter(child => child.kind === 'container')
    return packed(
      system.representationId,
      withZones(system.representationId, containers.map(slab), containers, relationships),
      { kind: 'island', islandKind: 'system', name: system.title, element: system },
      relationships,
    )
  }
  const roots = childrenOf(null)
  const actors = roots.filter(element => element.kind === 'actor')
  const systems = roots.filter(element => element.kind === 'system' && !element.external)
  const externals = roots.filter(element => element.kind === 'system' && element.external)

  const islands: Node[] = []
  if (actors.length > 0) {
    islands.push(squared(packed(ACTORS_ISLAND, actors.map(building),
      { kind: 'island', islandKind: 'actors', name: 'Actors', element: null }, relationships, true)))
  }
  const systemIslands = systems.map(systemIsland)
  const externalIslands = externals.length === 0 ? [] : [squared(packed(EXTERNAL_ISLAND, externals.map(building),
    { kind: 'island', islandKind: 'external', name: 'External systems', element: null }, relationships, true))]
  const all = [...islands, ...systemIslands, ...externalIslands]
  const { entries, edges } = lifted(all, relationships)
  const ranks = flowRanks(all.map(island => island.key), entries, edges)
  const rankOf = (island: Node): number => ranks.get(island.key) ?? Number.MAX_SAFE_INTEGER
  islands.push(...systemIslands.sort((a, b) => rankOf(a) - rankOf(b)), ...externalIslands)
  return composePlacement(collect(islands, placeRow(islands, relationships)), relationships)
}

/**
 * Islands in one row along +gx in the order given (actors, systems by the
 * flow among them, externals), their centres on one gy line, ISLAND_GAP
 * cells apart; then the actors and external islands slide along gy so the
 * centre of their buildings faces the centre of what those buildings talk to.
 */
function placeRow(islands: readonly Node[], relationships: readonly Pick<AnnotatedRelationship, 'source' | 'target'>[]): CellRect[] {
  const deepest = Math.max(0, ...islands.map(island => island.d))
  const origins: CellRect[] = []
  let gx = 0
  for (const [index, island] of islands.entries()) {
    origins.push({ gx, gy: Math.round((deepest - island.d) / 2), w: island.w, d: island.d })
    const next = islands[index + 1]
    gx += island.w + Math.max(ISLAND_GAP, routeReach(island.connections) + routeReach(next?.connections ?? 0))
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
  islands.forEach((island, index) => {
    walk(island, origins[index]!, island.key)
  })
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
        heightUnits: paint.heightUnits,
        shape: paint.shape,
        floors: paint.floors,
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
  islands.forEach((island, index) => {
    visit(island, origins[index]!, island.key, island.key)
  })
  const union = unionRects(origins)
  placement.sheet = union
    ? { gx: 0, gy: 0, w: union.gx + union.w + MARGIN, d: union.gy + union.d + MARGIN }
    : { gx: 0, gy: 0, w: 2 * MARGIN, d: 2 * MARGIN }
  return placement
}
