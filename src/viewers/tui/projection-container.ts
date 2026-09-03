import type { AnnotatedElement } from '../../types.ts'
import type { TerminalViewModel } from './model.ts'
import type { WorldItem } from './projection.ts'
import {
  buildingItem,
  byPlacement,
  floorRows,
  slabItem,
  zoneItem,
} from './projection-sheet.ts'

export { floorRows }

function containerBuildings(model: TerminalViewModel, container: AnnotatedElement) {
  return byPlacement(model.sheet.buildings.filter(building => {
    return building.surface === container.representationId && building.kind === 'component'
  }))
}

/** The selected container's fixed sheet geometry: its slab, groups and components only. */
export function containerLayout(model: TerminalViewModel, container: AnnotatedElement): WorldItem[] {
  const byId = new Map(model.elements.map(element => [element.representationId, element]))
  const slab = model.sheet.slabs.find(item => item.representationId === container.representationId)
  if (slab === undefined) return []
  const zones = byPlacement(model.sheet.zones.filter(zone => zone.parent === container.representationId)).map(zoneItem)
  const buildings = containerBuildings(model, container).flatMap(building => {
    const element = byId.get(building.representationId)
    return element === undefined ? [] : [buildingItem(building, element)]
  })
  return [slabItem(slab), ...zones, ...buildings]
}

/** The first component on the shared sheet. */
export function firstBuilding(model: TerminalViewModel, container: AnnotatedElement): string | undefined {
  return containerBuildings(model, container)[0]?.representationId
}
