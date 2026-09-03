import type { TerminalViewModel } from './model.ts'
import type { WorldItem } from './projection.ts'
import {
  buildingItem,
  byPlacement,
  islandItem,
  slabItem,
  zoneItem,
} from './projection-sheet.ts'

/**
 * The shared sheet at root depth: islands, containers, collapsed groups, actors and
 * external systems. Component buildings stay hidden until their container opens.
 */
export function rootLayout(model: TerminalViewModel): WorldItem[] {
  const byId = new Map(model.elements.map(element => [element.representationId, element]))
  const islands = byPlacement(model.sheet.islands).map(islandItem)
  const slabs = byPlacement(model.sheet.slabs).map(slabItem)
  const zones = byPlacement(model.sheet.zones).map(zoneItem)
  const roots = byPlacement(model.sheet.buildings).flatMap(building => {
    if (building.kind === 'component') return []
    const element = byId.get(building.representationId)
    return element === undefined ? [] : [buildingItem(building, element)]
  })
  return [...islands, ...slabs, ...zones, ...roots]
}
