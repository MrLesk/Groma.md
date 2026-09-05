import type { Building, Zone } from '../../sheet/types.ts'
import type { AnnotatedElement, Bounds } from '../../types.ts'
import type { TerminalViewModel } from './model.ts'
import type { WorldItem } from './projection.ts'
import { byPlacement, fittedWidth, rootIslands } from './projection-root.ts'

const CARD_GAP = 2
const LINE_GAP = 2

interface Band {
  zone: Zone | undefined
  buildings: Building[]
}

/** One row per floor; a ghost or building without files shows one empty row. */
export function floorRows(building: Building): string[] {
  const rows = building.floors.map(floor => {
    const largest = floor.files[0]?.split('/').at(-1) ?? ''
    return floor.files.length > 1 ? `${largest} +${floor.files.length - 1}` : largest
  })
  return rows.length === 0 ? [''] : rows
}

interface Sized {
  building: Building
  rows: string[]
  width: number
  height: number
}

/** A building is as wide as its border name or its widest floor row. */
function sized(building: Building): Sized {
  const rows = floorRows(building)
  return {
    building,
    rows,
    width: Math.max(building.title.length + 6, ...rows.map(row => row.length + 4)),
    height: rows.length + 2,
  }
}

function containerBuildings(model: TerminalViewModel, container: AnnotatedElement): Building[] {
  return byPlacement(model.sheet.buildings.filter(building => {
    return building.surface === container.representationId && building.kind === 'component'
  }))
}

function bands(model: TerminalViewModel, container: AnnotatedElement): Band[] {
  const buildings = containerBuildings(model, container)
  const zones = byPlacement(model.sheet.zones.filter(zone => zone.parent === container.representationId))
  const grouped = new Set(zones.flatMap(zone => zone.members))
  const loose = buildings.filter(building => !grouped.has(building.representationId))
  return [
    ...(loose.length === 0 ? [] : [{ zone: undefined, buildings: loose }]),
    ...zones.map(zone => ({
      zone,
      buildings: buildings.filter(building => zone.members.includes(building.representationId)),
    })),
  ]
}

/** Buildings left to right, wrapping when the next one would leave the band. */
function lines(buildings: readonly Sized[], width: number): Sized[][] {
  const result: Sized[][] = []
  let used = 0
  for (const entry of buildings) {
    const line = result.at(-1)
    if (line === undefined || used + CARD_GAP + entry.width > width) {
      result.push([entry])
      used = entry.width
    } else {
      line.push(entry)
      used += CARD_GAP + entry.width
    }
  }
  return result
}

function card({ building, rows }: Sized, element: AnnotatedElement, bounds: Bounds): WorldItem {
  return {
    key: building.representationId,
    representationId: building.representationId,
    id: building.id,
    title: building.title,
    kind: element.kind,
    origin: building.origin,
    external: element.external,
    shape: 'card',
    lines: rows,
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

/** Lay out one zone or the ungrouped band from `y`. */
function bandItems(
  band: Band,
  byId: ReadonlyMap<string, AnnotatedElement>,
  width: number,
  y: number,
): { items: WorldItem[]; height: number } {
  const framed = band.zone !== undefined
  const left = framed ? 4 : 2
  const items: WorldItem[] = []
  let lineY = framed ? y + 2 : y + 1
  const bandWidth = width - 2 * left
  for (const line of lines(band.buildings.map(sized), bandWidth)) {
    let x = left
    for (const entry of line) {
      const element = byId.get(entry.building.representationId)
      const bounds = {
        x,
        y: lineY,
        width: Math.min(entry.width, bandWidth),
        height: entry.height,
      }
      if (element !== undefined) items.push(card(entry, element, bounds))
      x += bounds.width + CARD_GAP
    }
    lineY += Math.max(...line.map(entry => entry.height)) + LINE_GAP
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

function siblingRows(model: TerminalViewModel, container: AnnotatedElement): AnnotatedElement[] {
  const rows = rootIslands(model)
    .find(entry => entry.rows.some(row => row.element.representationId === container.representationId))?.rows ?? []
  return rows.map(row => row.element)
}

/** The active container owns the map; neighbouring slabs are three-column named strips. */
export function containerLayout(
  model: TerminalViewModel,
  container: AnnotatedElement,
  mapWidth: number,
): WorldItem[] {
  const byId = new Map(model.elements.map(element => [element.representationId, element]))
  const width = Math.max(container.title.length + 6, fittedWidth(mapWidth))
  const items: WorldItem[] = []
  let y = 2
  for (const band of bands(model, container)) {
    const laid = bandItems(band, byId, width, y)
    items.push(...laid.items)
    y += laid.height + 1
  }
  const height = Math.max(4, y + 1)
  const neighbours = (['left', 'right'] as const).flatMap(side => {
    const element = neighbourContainer(model, container, side)
    if (element === undefined) return []
    return [{ ...slab(element, {
      x: side === 'left' ? -5 : width + 2,
      y: 0,
      width: 3,
      height,
    }), preview: 'vertical' as const }]
  })
  return [slab(container, { x: 0, y: 0, width, height }), ...items, ...neighbours]
}

/** The container before or after this one on its island. */
export function neighbourContainer(
  model: TerminalViewModel,
  container: AnnotatedElement,
  direction: 'left' | 'right',
): AnnotatedElement | undefined {
  const siblings = siblingRows(model, container)
  const at = siblings.findIndex(element => element.representationId === container.representationId)
  return siblings[at + (direction === 'right' ? 1 : -1)]
}

/** The first building of a container in placement order. */
export function firstBuilding(model: TerminalViewModel, container: AnnotatedElement): string | undefined {
  return containerBuildings(model, container)[0]?.representationId
}
