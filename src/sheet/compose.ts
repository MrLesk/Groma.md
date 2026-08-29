import type { AnnotatedRelationship } from '../types.ts'
import type { Placement } from './place.ts'
import type { CellRect } from './types.ts'

const ROUTE_SPACE_SCALE = 1.18
const SURFACE_INSET = 2
const UNIT_GAP = 3
const MIN_COLUMN_GAP = 2
const ACTORS = 'island:actors'

interface Connection {
  source: string
  target: string
  weight: number
}

export interface ContainerFlow {
  entries: string[]
  mediators: string[]
  core: string
  connections: Connection[]
  ownerByElement: Map<string, string>
}

function centre(rect: CellRect): { x: number; y: number } {
  return { x: rect.gx + rect.w / 2, y: rect.gy + rect.d / 2 }
}

function translated(rect: CellRect, dx: number, dy: number): CellRect {
  return { ...rect, gx: rect.gx + dx, gy: rect.gy + dy }
}

function islandMembership(placement: Placement): {
  buildingIsland: Map<string, string>
  zoneIsland: Map<string, string>
} {
  const slabIsland = new Map(placement.slabs.map(slab => [slab.representationId, slab.island]))
  return {
    buildingIsland: new Map(placement.buildings.map(building => [
      building.representationId,
      slabIsland.get(building.surface) ?? building.surface,
    ])),
    zoneIsland: new Map(placement.zones.map(zone => [
      zone.key,
      slabIsland.get(zone.parent) ?? zone.parent,
    ])),
  }
}

function moveIsland(
  placement: Placement,
  islandKey: string,
  dx: number,
  dy: number,
  membership: ReturnType<typeof islandMembership>,
): void {
  const island = placement.islands.find(candidate => candidate.key === islandKey)!
  island.rect = translated(island.rect, dx, dy)
  for (const slab of placement.slabs) if (slab.island === islandKey) slab.rect = translated(slab.rect, dx, dy)
  for (const building of placement.buildings) {
    if (membership.buildingIsland.get(building.representationId) === islandKey) {
      building.rect = translated(building.rect, dx, dy)
    }
  }
  for (const zone of placement.zones) {
    if (membership.zoneIsland.get(zone.key) === islandKey) zone.rect = translated(zone.rect, dx, dy)
  }
}

function openSystemRouteSpace(
  placement: Placement,
  islandKey: string,
  membership: ReturnType<typeof islandMembership>,
): number {
  const island = placement.islands.find(candidate => candidate.key === islandKey)!
  const root = { ...island.rect }
  const scalePosition = (rect: CellRect): CellRect => ({
    ...rect,
    gx: root.gx + (rect.gx - root.gx) * ROUTE_SPACE_SCALE,
    gy: root.gy + (rect.gy - root.gy) * ROUTE_SPACE_SCALE,
  })
  island.rect = { ...root, w: root.w * ROUTE_SPACE_SCALE, d: root.d * ROUTE_SPACE_SCALE }
  for (const slab of placement.slabs) if (slab.island === islandKey) {
    slab.rect = scalePosition(slab.rect)
    slab.rect.w *= ROUTE_SPACE_SCALE
    slab.rect.d *= ROUTE_SPACE_SCALE
  }
  for (const building of placement.buildings) {
    if (membership.buildingIsland.get(building.representationId) === islandKey) {
      building.rect = scalePosition(building.rect)
    }
  }
  for (const zone of placement.zones) {
    if (membership.zoneIsland.get(zone.key) === islandKey) {
      zone.rect = scalePosition(zone.rect)
      zone.rect.w *= ROUTE_SPACE_SCALE
      zone.rect.d *= ROUTE_SPACE_SCALE
    }
  }
  return island.rect.w - root.w
}

function owners(placement: Placement): Map<string, string> {
  const result = new Map<string, string>()
  for (const island of placement.islands) {
    result.set(island.key, island.key)
    if (island.element) result.set(island.element.representationId, island.key)
  }
  for (const slab of placement.slabs) result.set(slab.representationId, slab.representationId)
  for (const building of placement.buildings) result.set(building.representationId, building.surface)
  return result
}

function connections(
  relationships: readonly AnnotatedRelationship[],
  ownerByElement: ReadonlyMap<string, string>,
): Connection[] {
  const grouped = new Map<string, Connection>()
  for (const relationship of relationships) {
    const source = ownerByElement.get(relationship.source)
    const target = ownerByElement.get(relationship.target)
    if (!source || !target || source === target) continue
    const key = `${source}\0${target}`
    const connection = grouped.get(key) ?? { source, target, weight: 0 }
    connection.weight += 1
    grouped.set(key, connection)
  }
  return [...grouped.values()]
    .sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target))
}

function incomingWeight(id: string, flow: readonly Connection[]): number {
  return flow
    .filter(connection => connection.target === id && connection.source !== ACTORS)
    .reduce((total, connection) => total + connection.weight, 0)
}

function mediatorScore(id: string, mediators: ReadonlySet<string>, flow: readonly Connection[]): number {
  return flow.reduce((score, connection) => {
    if (!mediators.has(connection.source) || !mediators.has(connection.target)) return score
    if (connection.source === id) return score + connection.weight
    if (connection.target === id) return score - connection.weight
    return score
  }, 0)
}

/** Reads the entry, mediator and sink roles of one internal system from its leaf relationships. */
export function containerFlow(
  placement: Placement,
  systemIsland: string,
  relationships: readonly AnnotatedRelationship[],
): ContainerFlow | null {
  const units = placement.slabs.filter(slab => slab.island === systemIsland)
  if (units.length < 2) return null
  const ownerByElement = owners(placement)
  const flow = connections(relationships, ownerByElement)
  const unitIds = new Set(units.map(unit => unit.representationId))
  const entries = [...new Set(flow.flatMap(connection => {
    if (connection.source === ACTORS && unitIds.has(connection.target)) return [connection.target]
    if (connection.target === ACTORS && unitIds.has(connection.source)) return [connection.source]
    return []
  }))].sort((a, b) => {
    const left = units.find(unit => unit.representationId === a)!
    const right = units.find(unit => unit.representationId === b)!
    return left.rect.gy - right.rect.gy || a.localeCompare(b)
  })
  if (entries.length === 0) return null
  const entryIds = new Set(entries)
  const core = [...units]
    .filter(unit => !entryIds.has(unit.representationId))
    .sort((a, b) => incomingWeight(b.representationId, flow) - incomingWeight(a.representationId, flow)
      || a.representationId.localeCompare(b.representationId))[0]
  if (!core) return null
  const mediatorIds = new Set(units
    .map(unit => unit.representationId)
    .filter(id => !entryIds.has(id) && id !== core.representationId))
  const mediators = [...mediatorIds].sort((a, b) =>
    mediatorScore(b, mediatorIds, flow) - mediatorScore(a, mediatorIds, flow)
    || units.find(unit => unit.representationId === a)!.rect.gy
      - units.find(unit => unit.representationId === b)!.rect.gy
    || a.localeCompare(b))
  return {
    entries,
    mediators,
    core: core.representationId,
    connections: flow,
    ownerByElement,
  }
}

function connectedCentreY(
  id: string,
  partners: ReadonlySet<string>,
  flow: readonly Connection[],
  positions: ReadonlyMap<string, CellRect>,
): { total: number; weight: number } {
  let total = 0
  let weight = 0
  for (const connection of flow) {
    const partner = connection.source === id
      ? connection.target
      : connection.target === id ? connection.source : undefined
    if (!partner || !partners.has(partner)) continue
    const rect = positions.get(partner)
    if (!rect) continue
    total += centre(rect).y * connection.weight
    weight += connection.weight
  }
  return { total, weight }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum))
}

function applyPositions(
  placement: Placement,
  units: ReadonlyMap<string, Placement['slabs'][number]>,
  positions: ReadonlyMap<string, CellRect>,
  ids: readonly string[],
): void {
  for (const id of ids) {
    const slab = units.get(id)!
    const target = positions.get(id)!
    const dx = target.gx - slab.rect.gx
    const dy = target.gy - slab.rect.gy
    slab.rect = target
    for (const building of placement.buildings) {
      if (building.surface === id) building.rect = translated(building.rect, dx, dy)
    }
    for (const zone of placement.zones) {
      if (zone.parent === id) zone.rect = translated(zone.rect, dx, dy)
    }
  }
}

function composeSystem(
  placement: Placement,
  systemIsland: string,
  relationships: readonly AnnotatedRelationship[],
): number {
  const flow = containerFlow(placement, systemIsland, relationships)
  if (!flow || flow.mediators.length === 0) return 0
  const island = placement.islands.find(candidate => candidate.key === systemIsland)!
  const units = new Map(placement.slabs
    .filter(slab => slab.island === systemIsland)
    .map(slab => [slab.representationId, slab]))
  const positions = new Map([...units].map(([id, unit]) => [id, { ...unit.rect }]))
  const entries = flow.entries.map(id => units.get(id)!)
  const mediators = flow.mediators.map(id => units.get(id)!)
  const core = units.get(flow.core)!
  const innerTop = island.rect.gy + SURFACE_INSET
  const innerBottom = island.rect.gy + island.rect.d - SURFACE_INSET
  const entryRight = Math.max(...entries.map(unit => unit.rect.gx + unit.rect.w))
  const mediatorWidth = Math.max(...mediators.map(unit => unit.rect.w))
  const occupiedWidth = entryRight + mediatorWidth + core.rect.w
  const availableRight = island.rect.gx + island.rect.w - SURFACE_INSET
  const extraWidth = Math.max(0, occupiedWidth + 2 * MIN_COLUMN_GAP - availableRight)
  island.rect.w += extraWidth
  const freeWidth = availableRight + extraWidth - occupiedWidth
  const columnGap = freeWidth / 2
  const mediatorX = entryRight + columnGap
  const coreX = mediatorX + mediatorWidth + columnGap

  const entryIds = new Set(flow.entries)
  const preferred = mediators.reduce((result, mediator) => {
    const connected = connectedCentreY(mediator.representationId, entryIds, flow.connections, positions)
    return { total: result.total + connected.total, weight: result.weight + connected.weight }
  }, { total: 0, weight: 0 })
  const mediatorHeight = mediators.reduce((total, unit) => total + unit.rect.d, 0)
    + UNIT_GAP * (mediators.length - 1)
  const currentCentre = mediators.reduce((total, unit) => total + centre(unit.rect).y, 0) / mediators.length
  const preferredCentre = preferred.weight > 0 ? preferred.total / preferred.weight : currentCentre
  let mediatorY = clamp(preferredCentre - mediatorHeight / 2, innerTop, innerBottom - mediatorHeight)
  for (const mediator of mediators) {
    positions.set(mediator.representationId, {
      ...mediator.rect,
      gx: mediatorX + (mediatorWidth - mediator.rect.w) / 2,
      gy: mediatorY,
    })
    mediatorY += mediator.rect.d + UNIT_GAP
  }

  const upstream = new Set([...entryIds, ...flow.mediators])
  const coreCentre = connectedCentreY(core.representationId, upstream, flow.connections, positions)
  positions.set(core.representationId, {
    ...core.rect,
    gx: coreX,
    gy: clamp(
      coreCentre.weight > 0 ? coreCentre.total / coreCentre.weight - core.rect.d / 2 : core.rect.gy,
      innerTop,
      innerBottom - core.rect.d,
    ),
  })

  applyPositions(placement, units, positions, [...flow.mediators, flow.core])
  return extraWidth
}

/** Opens route space, then composes each internal system from its weighted container flow. */
export function composePlacement(
  placement: Placement,
  relationships: readonly AnnotatedRelationship[],
): Placement {
  const membership = islandMembership(placement)
  let shiftX = 0
  for (const island of [...placement.islands].sort((a, b) => a.rect.gx - b.rect.gx)) {
    if (shiftX !== 0) moveIsland(placement, island.key, shiftX, 0, membership)
    if (island.kind === 'system') {
      shiftX += openSystemRouteSpace(placement, island.key, membership)
      shiftX += composeSystem(placement, island.key, relationships)
    }
  }
  placement.sheet.w += shiftX
  placement.sheet.d = Math.max(
    placement.sheet.d,
    ...placement.islands.map(island => island.rect.gy + island.rect.d + 4),
  )
  return placement
}
