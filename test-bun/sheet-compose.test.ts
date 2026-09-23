import assert from 'node:assert/strict'

import { test } from 'bun:test'

import { containerFlow } from '../src/sheet/compose.ts'
import { MARGIN, contains, unionRects } from '../src/sheet/grid.ts'
import { ISLAND_FONT, labelBand } from '../src/sheet/measure.ts'
import { placeWorld } from '../src/sheet/place.ts'
import { sheetScene } from '../src/sheet/scene.ts'
import { ROUTE_SPACING, ROUTE_UNIT, routeReach } from '../src/sheet/route/space.ts'
import type { ArchitectureWorld } from '../src/types.ts'
import { box, uses } from './helpers.ts'

const unit = { x: 0, y: 0, width: 1, height: 1 }
const containerIds = ['entry-a', 'entry-b', 'mid-a', 'mid-b', 'core']

function flowWorld(): ArchitectureWorld {
  const relationships = [
    uses('relationship:0', 'architect', 'entry-a-leaf'),
    uses('relationship:1', 'architect', 'entry-b-leaf'),
    uses('relationship:2', 'entry-a-leaf', 'core-leaf'),
    uses('relationship:3', 'entry-a-second', 'core-leaf'),
    uses('relationship:4', 'entry-a-third', 'core-leaf'),
    uses('relationship:5', 'entry-b-leaf', 'core-leaf'),
    uses('relationship:6', 'entry-a-leaf', 'mid-a-leaf'),
    uses('relationship:7', 'mid-a-leaf', 'mid-b-leaf'),
    uses('relationship:8', 'mid-b-leaf', 'core-leaf'),
    uses('relationship:9', 'core-leaf', 'git'),
  ]
  return {
    flows: [],
    bounds: unit,
    groups: [],
    relationships,
    elements: [
      box('architect', 'actor', unit),
      box('service', 'system', unit),
      ...containerIds.map(id => box(id, 'container', unit, { parent: 'observed:service' })),
      ...containerIds.map(id => box(`${id}-leaf`, 'component', unit, {
        parent: `observed:${id}`,
        ...(id === 'mid-a' ? { group: 'Work' } : {}),
      })),
      ...['entry-a-second', 'entry-a-third'].map(id => box(id, 'component', unit, { parent: 'observed:entry-a' })),
      box('git', 'system', unit, { external: true }),
    ],
  }
}

test.concurrent('leaf relationships derive weighted entry, mediator, and core roles', () => {
  const world = flowWorld()
  const placement = placeWorld(world)
  const flow = containerFlow(placement, 'observed:service', world.relationships)

  assert.ok(flow)
  assert.deepEqual(flow.entries, ['observed:entry-a', 'observed:entry-b'])
  assert.deepEqual(flow.mediators, ['observed:mid-a', 'observed:mid-b'])
  assert.equal(flow.core, 'observed:core')
  assert.equal(flow.ownerByElement.get('observed:entry-a-leaf'), 'observed:entry-a')
  assert.equal(flow.connections.find(connection =>
    connection.source === 'observed:entry-a' && connection.target === 'observed:core')?.weight, 3)
})

test.concurrent('the composed system reads west to east while complete subtrees remain together', () => {
  const placement = placeWorld(flowWorld())
  const slabs = new Map(placement.slabs.map(slab => [slab.id, slab]))
  const right = (id: string): number => slabs.get(id)!.rect.gx + slabs.get(id)!.rect.w

  for (const entry of ['entry-a', 'entry-b']) {
    assert.ok(right(entry) < slabs.get('mid-a')!.rect.gx)
  }
  assert.ok(right('mid-a') < slabs.get('core')!.rect.gx)
  assert.ok(right('mid-b') < slabs.get('core')!.rect.gx)
  assert.ok(slabs.get('mid-b')!.rect.gy > slabs.get('mid-a')!.rect.gy)
  assert.ok(slabs.get('mid-b')!.rect.gy > slabs.get('core')!.rect.gy)

  for (const building of placement.buildings.filter(item => item.kind === 'component')) {
    const slab = placement.slabs.find(item => item.representationId === building.surface)
      ?? placement.slabs.find(item => placement.zones.some(zone =>
        zone.key === building.surface && zone.parent === item.representationId))
    assert.ok(slab)
    assert.equal(contains(slab.rect, building.rect), true, `${building.id} left ${slab.id}`)
  }
  for (const zone of placement.zones) {
    const slab = placement.slabs.find(item => item.representationId === zone.parent)
    assert.ok(slab)
    assert.equal(contains(slab.rect, zone.rect), true, `${zone.name} left ${slab.id}`)
  }
})

test.concurrent('final container positions determine the system and sheet bounds', () => {
  const world = flowWorld()
  const original = structuredClone(world)
  const placement = placeWorld(world)
  const island = placement.islands.find(item => item.kind === 'system')!
  const occupied = unionRects(placement.slabs.filter(slab => slab.island === island.key).map(slab => slab.rect))!

  assert.ok(Math.abs(occupied.gx - island.rect.gx - 2) < 0.001)
  assert.ok(Math.abs(occupied.gy - island.rect.gy - 2) < 0.001)
  assert.ok(Math.abs(island.rect.w - occupied.w - 4) < 0.001)
  assert.ok(Math.abs(island.rect.d - occupied.d - 4 - labelBand(ISLAND_FONT)) < 0.001)
  const islands = unionRects(placement.islands.map(item => item.rect))!
  assert.equal(placement.sheet.w, islands.gx + islands.w + MARGIN)
  assert.equal(placement.sheet.d, islands.gy + islands.d + MARGIN)
  assert.deepEqual(placeWorld(world), placement)
  assert.deepEqual(world, original)
})


test.concurrent('mediator composition preserves connection space as the same flow becomes busier', () => {
  const world = flowWorld()
  world.relationships = world.relationships.flatMap(relationship =>
    Array.from({ length: 8 }, (_, index) => ({ ...relationship, id: `${relationship.id}:${index}` })))
  const before = structuredClone(world)
  const scene = sheetScene(world)
  const flow = containerFlow(scene, 'observed:service', world.relationships)!
  const slabs = new Map(scene.slabs.map(slab => [slab.representationId, slab]))
  const reach = routeReach(flow.connections.reduce((count, connection) => count + connection.weight, 0))
  const right = (id: string) => slabs.get(id)!.rect.gx + slabs.get(id)!.rect.w
  const mediatorLeft = Math.min(...flow.mediators.map(id => slabs.get(id)!.rect.gx))
  const mediatorRight = Math.max(...flow.mediators.map(right))
  assert.ok(mediatorLeft - Math.max(...flow.entries.map(right)) >= 2 * reach)
  assert.ok(slabs.get(flow.core)!.rect.gx - mediatorRight >= 2 * reach)
  assert.equal(scene.routes.length, world.relationships.length)
  assert.deepEqual(world, before)
})

test.concurrent('container composition retains the enclosing system port capacity', () => {
  const world = flowWorld()
  world.relationships.push(...Array.from({ length: 96 }, (_, index) => uses(`system:${index}`, 'architect', 'service')))
  const scene = sheetScene(world)
  const island = scene.islands.find(item => item.kind === 'system')!
  assert.ok(Math.min(island.rect.w, island.rect.d) * ROUTE_UNIT / 2 >= 2 * 95 * ROUTE_SPACING)
  assert.equal(scene.routes.length, world.relationships.length)
})
