import type { ArchitectureGraph } from '../types.ts'
import { placeWorld } from './place.ts'
import { routeAll, type Endpoint } from './route.ts'
import type { SheetScene } from './types.ts'

/**
 * Composes the merged world into one grid-snapped sheet: flat islands for
 * actors, external systems and each internal system, container slabs level
 * with the system islands, buildings on the slabs and islands, group zones,
 * and one
 * lattice route per authored relationship. Pure: the same world gives the same
 * sheet and the world is never touched.
 */
export function sheetScene(world: ArchitectureGraph): SheetScene {
  const placement = placeWorld(world)
  const endpoints = new Map<string, Endpoint>()
  for (const island of placement.islands) {
    endpoints.set(island.key, { key: island.key, kind: 'island', rect: island.rect, within: [] })
  }
  for (const slab of placement.slabs) {
    endpoints.set(slab.representationId, {
      key: slab.representationId,
      kind: 'slab',
      rect: slab.rect,
      within: [slab.island],
    })
  }
  const islandOfSlab = new Map(placement.slabs.map(slab => [slab.representationId, slab.island]))
  for (const building of placement.buildings) {
    const island = islandOfSlab.get(building.surface) ?? building.surface
    endpoints.set(building.representationId, {
      key: building.representationId,
      kind: 'building',
      rect: building.rect,
      within: island === building.surface ? [island] : [building.surface, island],
      roof: building.floors,
      centrePorts: building.shape.kind === 'round',
    })
  }
  return { ...placement, routes: routeAll(placement.sheet, endpoints, world.relationships) }
}
