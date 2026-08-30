import type { ArchitectureGraph } from '../types.ts'
import { placeWorld } from './place.ts'
import { routeAll, type Endpoint } from './route.ts'
import type { SheetScene } from './types.ts'

export interface SheetSceneTimings {
  placementMilliseconds: number
  routingMilliseconds: number
}

export interface MeasuredSheetScene {
  scene: SheetScene
  timings: SheetSceneTimings
}

/**
 * Composes the merged world into one shared sheet: flat islands for
 * actors, external systems and each internal system, container slabs level
 * with the system islands, buildings on the slabs and islands, group zones,
 * and one
 * orthogonal ground route per authored relationship. Pure: the same world gives the same
 * sheet and the world is never touched.
 */
export function measuredSheetScene(world: ArchitectureGraph): MeasuredSheetScene {
  const started = performance.now()
  const placement = placeWorld(world)
  const placed = performance.now()
  const endpoints = new Map<string, Endpoint>()
  for (const island of placement.islands) {
    endpoints.set(island.key, { key: island.key, kind: 'island', rect: island.rect })
  }
  for (const slab of placement.slabs) {
    endpoints.set(slab.representationId, {
      key: slab.representationId,
      kind: 'slab',
      rect: slab.rect,
      owner: slab.island,
    })
  }
  for (const building of placement.buildings) {
    endpoints.set(building.representationId, {
      key: building.representationId,
      kind: 'building',
      rect: building.rect,
      owner: building.surface,
      roof: building.heightUnits,
      centrePorts: building.shape.kind === 'round',
    })
  }
  const routes = routeAll(endpoints, world.relationships)
  const routed = performance.now()
  return {
    scene: { ...placement, routes },
    timings: {
      placementMilliseconds: placed - started,
      routingMilliseconds: routed - placed,
    },
  }
}

export function sheetScene(world: ArchitectureGraph): SheetScene {
  return measuredSheetScene(world).scene
}
