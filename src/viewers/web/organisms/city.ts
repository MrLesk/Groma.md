import { Group } from 'three'
import type { ArchitectureWorld } from '../../../types.ts'
import { addPrism, addSlab } from '../molecules/block.ts'
import type { CityPick } from '../molecules/block.ts'
import { addRoute } from '../molecules/route.ts'
import type { CityRoute } from '../molecules/route.ts'
import { addZone } from '../molecules/zone.ts'
import { buildScene } from '../scene.ts'

export type { CityPick, CityRoute }

export function buildCity(world: ArchitectureWorld): {
  city: Group
  pickables: CityPick[]
  routes: CityRoute[]
} {
  const city = new Group()
  const pickables: CityPick[] = []
  const routes: CityRoute[] = []
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
      case 'route':
        routes.push(addRoute(city, item.relationship, item.z))
    }
  }
  return { city, pickables, routes }
}
