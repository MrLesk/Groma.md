import { expect, test } from 'bun:test'
import path from 'node:path'

import { loadAnnotatedArchitecture } from '../src/core.ts'
import { contains, overlaps } from '../src/sheet/grid.ts'
import { sheetScene } from '../src/sheet/scene.ts'
import { islandsSvg } from '../src/viewers/web/iso/paint-ground.ts'
import { projectScene } from '../src/viewers/web/iso/project.ts'
import { inspectSelection } from '../src/viewers/web/organisms/details.ts'
import { initialState } from '../src/viewers/tui/navigation.ts'
import { leaveView } from '../src/viewers/tui/navigation-spatial.ts'
import { projectWorld } from '../src/viewers/tui/projection.ts'

const fixture = path.resolve(import.meta.dir, '../test/fixtures/unidentified-container')

test.concurrent('unknown placement is visible beside a real container without changing stored architecture', async () => {
  const world = await loadAnnotatedArchitecture(fixture)
  const before = JSON.stringify(world)
  const scene = sheetScene(world)
  const group = scene.zones.find(zone => zone.unidentifiedContainer)!
  const system = scene.islands.find(island => island.key === group.parent)!
  const container = scene.slabs[0]!
  expect(scene.zones.filter(zone => zone.unidentifiedContainer)).toHaveLength(1)
  expect(world.elements.filter(element => element.kind === 'container').map(element => element.id)).toEqual(['browser'])
  expect(new Set(scene.buildings.map(building => building.id))).toEqual(new Set(['view', 'reader', 'formatter']))
  expect(group.members).toHaveLength(2)
  expect(contains(system.rect, group.rect)).toBe(true)
  expect(overlaps(container.rect, group.rect)).toBe(false)
  for (const member of group.members) {
    const building = scene.buildings.find(item => item.representationId === member)!
    expect(contains(group.rect, building.rect)).toBe(true)
    expect(world.elements.find(element => element.representationId === member)?.parent).toBe(system.key)
  }
  expect(JSON.stringify(world)).toBe(before)
})

test.concurrent('the group is selectable and explains missing placement with links to its components', async () => {
  const world = await loadAnnotatedArchitecture(fixture)
  const scene = sheetScene(world)
  const group = scene.zones.find(zone => zone.unidentifiedContainer)!
  expect(islandsSvg(projectScene(scene))).toContain(`data-id="${group.key}"`)
  const inspected = inspectSelection(group.key, world, scene.zones)!
  expect(inspected.overview).toContain('could not determine')
  expect(new Set(inspected.children.map(child => child.id))).toEqual(new Set(group.members))
  expect(inspected.removable).toBe(false)
  expect(inspected.movable).toBe(false)
})

test.concurrent('terminal inspection opens unplaced components on their system surface and returns to the system', async () => {
  const world = await loadAnnotatedArchitecture(fixture)
  const model = { ...world, sheet: sheetScene(world) }
  const viewport = { x: 0, y: 0, width: 100, height: 40 }
  expect(projectWorld(model, { viewport }).items.some(item => item.kind === 'group')).toBe(true)
  const reader = world.elements.find(element => element.id === 'reader')!
  const projection = projectWorld(model, { viewport, level: 'components', currentId: reader.representationId })
  expect(projection.scope).toBe(reader.parent)
  expect(new Set(projection.items.filter(item => item.kind === 'component').map(item => item.id)))
    .toEqual(new Set(['reader', 'formatter']))
  expect(leaveView(model, { ...initialState(model), level: 'components' }, reader))
    .toEqual({ level: 'context', currentId: reader.parent! })
})
