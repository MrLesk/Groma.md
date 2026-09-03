import type { Building, CellRect, Island, Slab, Zone } from '../../sheet/types.ts'
import type { AnnotatedElement, Bounds, Point } from '../../types.ts'
import type { WorldItem } from './projection.ts'

/** One shared sheet cell always occupies the same terminal cells, at every viewport size. */
export const TERMINAL_CELL_WIDTH = 2
export const TERMINAL_CELL_HEIGHT = 1

export function terminalBounds(rect: CellRect): Bounds {
  return {
    x: Math.round(rect.gx * TERMINAL_CELL_WIDTH),
    y: Math.round(rect.gy * TERMINAL_CELL_HEIGHT),
    width: Math.max(3, Math.round(rect.w * TERMINAL_CELL_WIDTH)),
    height: Math.max(3, Math.round(rect.d * TERMINAL_CELL_HEIGHT)),
  }
}

export function terminalPoint(point: { gx: number; gy: number }): Point {
  return {
    x: Math.round(point.gx * TERMINAL_CELL_WIDTH),
    y: Math.round(point.gy * TERMINAL_CELL_HEIGHT),
  }
}

/** The sheet's placement order: by row, then column. */
export function byPlacement<T extends { rect: { gx: number; gy: number } }>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => left.rect.gy - right.rect.gy || left.rect.gx - right.rect.gx)
}

/** One row per visible floor: the largest file and +N for the rest. */
export function floorRows(building: Building): string[] {
  return building.floors.map(floor => {
    const largest = floor.files[0]?.split('/').at(-1) ?? ''
    return floor.files.length > 1 ? `${largest} +${floor.files.length - 1}` : largest
  })
}

export function islandItem(island: Island): WorldItem {
  return {
    key: island.key,
    ...(island.element === null ? {} : {
      representationId: island.element.representationId,
      id: island.element.id,
    }),
    title: island.name,
    kind: island.kind === 'actors' ? 'actor' : 'system',
    origin: island.element?.origin ?? 'observed',
    external: island.kind === 'external',
    shape: 'island',
    lines: [],
    worldBounds: terminalBounds(island.rect),
  }
}

export function slabItem(slab: Slab): WorldItem {
  return {
    key: slab.representationId,
    representationId: slab.representationId,
    id: slab.id,
    title: slab.title,
    kind: 'container',
    origin: slab.origin,
    external: false,
    shape: 'slab',
    lines: [],
    worldBounds: terminalBounds(slab.rect),
  }
}

export function zoneItem(zone: Zone): WorldItem {
  return {
    key: zone.key,
    title: zone.name,
    kind: 'group',
    origin: 'observed',
    external: false,
    shape: 'group',
    lines: [zone.name],
    worldBounds: terminalBounds(zone.rect),
  }
}

export function buildingItem(building: Building, element: AnnotatedElement): WorldItem {
  return {
    key: building.representationId,
    representationId: building.representationId,
    id: building.id,
    title: building.title,
    kind: element.kind,
    origin: building.origin,
    external: element.external,
    shape: 'card',
    lines: floorRows(building),
    worldBounds: terminalBounds(building.rect),
  }
}
