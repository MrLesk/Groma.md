import { Group } from 'three'
import type { ArchitectureWorld } from '../../../types.ts'
import { addPrism, addSlab } from '../molecules/block.ts'
import type { CityPick } from '../molecules/block.ts'
import { addRoute } from '../molecules/route.ts'
import type { CityRouteLabel } from '../molecules/route.ts'
import { addZone } from '../molecules/zone.ts'
import { buildScene } from '../scene.ts'

export type { CityPick, CityRouteLabel }

export function buildCity(world: ArchitectureWorld): {
  city: Group
  pickables: CityPick[]
  routeLabels: CityRouteLabel[]
} {
  const city = new Group()
  const pickables: CityPick[] = []
  const routeLabels: CityRouteLabel[] = []
  for (const item of buildScene(world)) {
    switch (item.kind) {
      case 'slab':
        pickables.push(addSlab(city, item.element, item.bottom, item.top))
        break
      case 'prism':
        pickables.push(addPrism(city, item.element, item.bottom, item.top))
        break
      case 'zone':
        addZone(city, item.group, item.z)
        break
      case 'route': {
        const label = addRoute(city, item.relationship, item.z)
        if (label) routeLabels.push(label)
      }
    }
  }
  return { city, pickables, routeLabels }
}
