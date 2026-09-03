import type { Building, Zone } from '../../sheet/types.ts'
import type { AnnotatedElement, Bounds } from '../../types.ts'
import type { TerminalViewModel } from './model.ts'
import type { WorldItem } from './projection.ts'
import { byPlacement, fittedWidth, rootIslands } from './projection-root.ts'

const CARD_GAP = 2
const LINE_GAP = 2
const CARD_HEIGHT = 4

/** The buildings of one zone, or the ungrouped ones before any zone. */
interface Band {
  zone: Zone | undefined
  buildings: Building[]
}

function cardWidth(building: Building): number {
  return Math.max(...building.lines.map(line => line.length), building.title.length) + 7
}

/** The container's component buildings in placement order. */
function containerBuildings(model: TerminalViewModel, container: AnnotatedElement): Building[] {
  return byPlacement(model.sheet.buildings.filter(building => building.surface === container.representationId && building.kind === 'component'))
}

function bands(model: TerminalViewModel, container: AnnotatedElement): Band[] {
  const buildings = containerBuildings(model, container)
  const zones = byPlacement(model.sheet.zones.filter(zone => zone.parent === container.representationId))
  const grouped = new Set(zones.flatMap(zone => zone.members))
  const loose = buildings.filter(building => !grouped.has(building.representationId))
  return [
    ...(loose.length === 0 ? [] : [{ zone: undefined, buildings: loose }]),
    ...zones.map(zone => ({ zone, buildings: buildings.filter(building => zone.members.includes(building.representationId)) })),
  ]
}

/** Cards left to right, wrapping into a new line when the next one would leave the band. */
function lines(buildings: readonly Building[], width: number): Building[][] {
  const result: Building[][] = []
  let used = 0
  for (const building of buildings) {
    const line = result.at(-1)
    if (line === undefined || used + CARD_GAP + cardWidth(building) > width) {
      result.push([building])
      used = cardWidth(building)
    } else {
      line.push(building)
      used += CARD_GAP + cardWidth(building)
    }
  }
  return result
}

function card(building: Building, element: AnnotatedElement, bounds: Bounds): WorldItem {
  return {
    key: building.representationId,
    representationId: building.representationId,
    id: building.id,
    title: building.title,
    kind: element.kind,
    origin: building.origin,
    external: element.external,
    shape: 'card',
    lines: building.lines,
    worldBounds: bounds,
  }
}

function slab(element: AnnotatedElement, bounds: Bounds): WorldItem {
  return {
    key: element.representationId,
    representationId: element.representationId,
    id: element.id,
    title: element.title,
    kind: 'container',
    origin: element.origin,
    external: false,
    shape: 'slab',
    lines: [],
    worldBounds: bounds,
  }
}

/** One band's cards in wrapped lines from `y`, with its zone frame when it has one; returns the items and the band's height. */
function bandItems(band: Band, byId: ReadonlyMap<string, AnnotatedElement>, width: number, y: number): { items: WorldItem[]; height: number } {
  const framed = band.zone !== undefined
  const left = framed ? 4 : 2
  const items: WorldItem[] = []
  let lineY = framed ? y + 2 : y + 1
  for (const line of lines(band.buildings, width - 2 * left)) {
    let x = left
    for (const building of line) {
      const element = byId.get(building.representationId)
      if (element !== undefined) items.push(card(building, element, { x, y: lineY, width: cardWidth(building), height: CARD_HEIGHT }))
      x += cardWidth(building) + CARD_GAP
    }
    lineY += CARD_HEIGHT + LINE_GAP
  }
  const height = lineY - y - (framed ? 1 : 0)
  if (band.zone !== undefined) {
    items.push({
      key: band.zone.key,
      title: band.zone.name,
      kind: 'group',
      origin: 'observed',
      external: false,
      shape: 'group',
      lines: [band.zone.name],
      worldBounds: { x: 2, y, width: width - 4, height },
    })
  }
  return { items, height }
}

/** The container's rows on its island, in placement order. */
function siblingRows(model: TerminalViewModel, container: AnnotatedElement): AnnotatedElement[] {
  const rows = rootIslands(model).find(entry => entry.rows.some(row => row.element.representationId === container.representationId))?.rows ?? []
  return rows.map(row => row.element)
}

/**
 * The selected container fitted to the map width and its zones stacked as bands, each band's buildings
 * wrapped into lines two rows apart; the neighbouring containers of the same system peek on both sides.
 */
export function containerLayout(model: TerminalViewModel, container: AnnotatedElement, mapWidth: number): WorldItem[] {
  const byId = new Map(model.elements.map(element => [element.representationId, element]))
  const stacked = bands(model, container)
  const widest = Math.max(container.title.length + 6, ...stacked.flatMap(band => band.buildings.map(cardWidth)).map(width => width + 8))
  const width = Math.max(widest, fittedWidth(mapWidth))
  const items: WorldItem[] = []
  let y = 2
  for (const band of stacked) {
    const laid = bandItems(band, byId, width, y)
    items.push(...laid.items)
    y += laid.height + 1
  }
  const height = Math.max(4, y + 1)
  const neighbours = (['left', 'right'] as const).flatMap(side => {
    const element = neighbourContainer(model, container, side)
    return element === undefined ? [] : [slab(element, { x: side === 'left' ? -(width + 2) : width + 2, y: 0, width, height })]
  })
  return [slab(container, { x: 0, y: 0, width, height }), ...items, ...neighbours]
}

/** The container before or after this one on its island, for crossing past the first or last building. */
export function neighbourContainer(model: TerminalViewModel, container: AnnotatedElement, direction: 'left' | 'right'): AnnotatedElement | undefined {
  const siblings = siblingRows(model, container)
  const at = siblings.findIndex(element => element.representationId === container.representationId)
  return siblings[at + (direction === 'right' ? 1 : -1)]
}

/** The first building of a container in placement order. */
export function firstBuilding(model: TerminalViewModel, container: AnnotatedElement): string | undefined {
  return containerBuildings(model, container)[0]?.representationId
}
