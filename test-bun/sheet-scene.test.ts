import assert from 'node:assert/strict'

import { test } from 'bun:test'

import { loadAnnotatedArchitecture, loadArchitectureViewModel } from '../src/core.ts'
import { GAP, ISLAND_GAP, NESTED_CONTENT_PAD } from '../src/sheet/forces.ts'
import { EMPTY, MARGIN, PAD, ROOF_SHADOW, contains, overlaps, shadeOf } from '../src/sheet/grid.ts'
import {
  ISLAND_FONT,
  ISLAND_SPACING,
  PLANE,
  ROOF_PAD,
  SURFACE_FONT,
  floorsOf,
  footprintOf,
  roofLines,
  shapeOf,
  textWidth,
} from '../src/sheet/measure.ts'
import { sheetScene } from '../src/sheet/scene.ts'
import type { CellRect, SheetScene } from '../src/sheet/types.ts'
import type { ArchitectureWorld, WorldElement } from '../src/types.ts'
import { box, openclawFixtureRoot, uses, viewerFixtureRoot, worldOf } from './helpers.ts'

const unit = { x: 0, y: 0, width: 1, height: 1 }

/** One actor, one system with three containers (0, 2 and 5 components), one external system. */
function shopWorld(): ArchitectureWorld {
  const components = (container: string, names: string[]): WorldElement[] => names.map(name =>
    box(name, 'component', unit, { parent: `observed:${container}` }))
  return worldOf([
    box('buyer', 'actor', unit),
    box('shop', 'system', unit, { children: ['observed:api', 'observed:web', 'observed:jobs'] }),
    box('api', 'container', unit, { parent: 'observed:shop' }),
    box('web', 'container', unit, { parent: 'observed:shop' }),
    box('jobs', 'container', unit, { parent: 'observed:shop' }),
    ...components('web', ['cart', 'checkout']),
    ...components('jobs', ['mailer', 'pricing sync', 'stock', 'invoices', 'audit']),
    box('vault', 'system', unit, { external: true }),
  ])
}

function footprints(scene: SheetScene): CellRect[] {
  return [
    ...scene.islands.map(island => island.rect),
    ...scene.slabs.map(slab => slab.rect),
    ...scene.buildings.map(building => building.rect),
    ...scene.zones.map(zone => zone.rect),
  ]
}

function apart(a: CellRect, b: CellRect, gap: number): boolean {
  return a.gx + a.w + gap <= b.gx || b.gx + b.w + gap <= a.gx
    || a.gy + a.d + gap <= b.gy || b.gy + b.d + gap <= a.gy
}

function siblings(scene: SheetScene): CellRect[][] {
  const groups = new Map<string, CellRect[]>()
  const add = (key: string, rect: CellRect): void => {
    groups.set(key, [...(groups.get(key) ?? []), rect])
  }
  for (const building of scene.buildings) add(building.surface, building.rect)
  for (const slab of scene.slabs) add(slab.island, slab.rect)
  for (const zone of scene.zones) add(zone.parent, zone.rect)
  return [...groups.values()]
}

test.concurrent('every footprint is a whole-cell rectangle at least two cells a side', () => {
  for (const rect of footprints(sheetScene(shopWorld()))) {
    for (const value of [rect.gx, rect.gy, rect.w, rect.d]) assert.equal(Number.isInteger(value), true)
    assert.ok(rect.w >= 2 && rect.d >= 2)
  }
})

test.concurrent('siblings never overlap and keep the gap on one axis', () => {
  const scene = sheetScene(shopWorld())
  for (const rects of [...siblings(scene), scene.islands.map(island => island.rect)]) {
    for (const [index, a] of rects.entries()) {
      for (const b of rects.slice(index + 1)) {
        assert.equal(overlaps(a, b), false)
        assert.equal(apart(a, b, GAP), true)
      }
    }
  }
})

test.concurrent('a building keeps the ground its roof hides clear of its north and west neighbours', () => {
  const scene = sheetScene(worldOf([
    box('shop', 'system', unit),
    box('api', 'container', unit, { parent: 'observed:shop' }),
    { ...box('tall', 'component', unit, { parent: 'observed:api' }), codeLines: 4000 },
    { ...box('short', 'component', unit, { parent: 'observed:api' }), codeLines: 0 },
    { ...box('middling', 'component', unit, { parent: 'observed:api' }), codeLines: 1200 },
  ], [uses('relationship:0', 'tall', 'short'), uses('relationship:1', 'middling', 'tall')]))
  assert.ok(shadeOf(scene.buildings.find(building => building.id === 'tall')!.floors) > 0)
  let pairs = 0
  for (const near of scene.buildings) {
    /** The ground the roof hides, plus the one cell an arrow needs to run out of one building and into the next. */
    const room = near.floors * ROOF_SHADOW + 1
    for (const far of scene.buildings) {
      if (far === near || far.surface !== near.surface) continue
      const alongX = near.rect.gx < far.rect.gx + far.rect.w && far.rect.gx < near.rect.gx + near.rect.w
      const alongY = near.rect.gy < far.rect.gy + far.rect.d && far.rect.gy < near.rect.gy + near.rect.d
      /** Only a building whose roof outgrows the plain gap makes this rule bite. */
      const shaded = shadeOf(near.floors) > 0 ? 1 : 0
      if (alongX && far.rect.gy + far.rect.d <= near.rect.gy) {
        pairs += shaded
        assert.ok(near.rect.gy - (far.rect.gy + far.rect.d) >= room, `${far.id} stands in ${near.id}'s roof shadow`)
      }
      if (alongY && far.rect.gx + far.rect.w <= near.rect.gx) {
        pairs += shaded
        assert.ok(near.rect.gx - (far.rect.gx + far.rect.w) >= room, `${far.id} stands in ${near.id}'s roof shadow`)
      }
    }
  }
  assert.ok(pairs > 0)
})

test.concurrent('system islands and slabs give their children two cells on every edge', () => {
  assert.ok(NESTED_CONTENT_PAD > PAD)
  const scene = sheetScene(shopWorld())
  const rectOf = new Map<string, CellRect>([
    ...scene.islands.map(island => [island.key, island.rect] as const),
    ...scene.slabs.map(slab => [slab.representationId, slab.rect] as const),
  ])
  const nested = new Set([
    ...scene.islands.filter(island => island.kind === 'system').map(island => island.key),
    ...scene.slabs.map(slab => slab.representationId),
  ])
  const inside = (child: CellRect, parentKey: string): void => {
    const parent = rectOf.get(parentKey)
    assert.ok(parent)
    const padding = nested.has(parentKey) ? NESTED_CONTENT_PAD : PAD
    assert.equal(contains(parent, child), true)
    assert.ok(child.gx >= parent.gx + padding && child.gy >= parent.gy + padding)
    assert.ok(child.gx + child.w <= parent.gx + parent.w - padding)
    assert.ok(child.gy + child.d <= parent.gy + parent.d - padding)
  }
  for (const building of scene.buildings) inside(building.rect, building.surface)
  for (const slab of scene.slabs) inside(slab.rect, slab.island)
  assert.equal(scene.buildings.length, 9)
  assert.equal(scene.slabs.length, 3)
})

test.concurrent('islands form one row along gx: actors at the west end, externals at the east end', () => {
  const scene = sheetScene(worldOf([
    box('ann', 'actor', unit),
    box('bob', 'actor', unit),
    box('shop', 'system', unit),
    box('warehouse', 'system', unit),
    box('bank', 'system', unit, { external: true }),
    box('carrier', 'system', unit, { external: true }),
    box('tax', 'system', unit, { external: true }),
  ]))
  assert.deepEqual(scene.islands.map(island => island.kind), ['actors', 'system', 'system', 'external'])
  const rects = scene.islands.map(island => island.rect)
  const centre = (rect: CellRect): number => rect.gy + rect.d / 2
  for (let index = 1; index < rects.length; index += 1) {
    assert.ok(rects[index]!.gx - (rects[index - 1]!.gx + rects[index - 1]!.w) >= ISLAND_GAP)
    assert.ok(Math.abs(centre(rects[index]!) - centre(rects[0]!)) <= 0.5)
  }
  for (const [index, island] of scene.islands.entries()) {
    for (const other of scene.islands.slice(index + 1)) assert.equal(overlaps(island.rect, other.rect), false)
  }
})

test.concurrent('actors and external islands are squares with their buildings centred', () => {
  const scene = sheetScene(worldOf([
    box('ann', 'actor', unit),
    box('bob', 'actor', unit),
    box('shop', 'system', unit),
    box('bank', 'system', unit, { external: true }),
  ]))
  for (const kind of ['actors', 'external'] as const) {
    const island = scene.islands.find(item => item.kind === kind)!
    assert.equal(island.rect.w, island.rect.d)
    const rects = scene.buildings.filter(building => building.surface === island.key).map(building => building.rect)
    const west = Math.min(...rects.map(rect => rect.gx)) - island.rect.gx
    const east = island.rect.gx + island.rect.w - Math.max(...rects.map(rect => rect.gx + rect.w))
    const north = Math.min(...rects.map(rect => rect.gy)) - island.rect.gy
    const south = island.rect.gy + island.rect.d - Math.max(...rects.map(rect => rect.gy + rect.d))
    assert.equal(west, east)
    assert.ok(Math.abs(north - south) <= 1)
    assert.ok(west >= PAD && north >= PAD && south >= PAD)
  }
})

test.concurrent('a group becomes a zone around its members on the parent surface', () => {
  const scene = sheetScene(worldOf([
    box('shop', 'system', unit),
    box('api', 'container', unit, { parent: 'observed:shop' }),
    ...['orders', 'pricing', 'stock', 'mailer', 'audit'].map(name => ({
      ...box(name, 'component', unit, { parent: 'observed:api' }),
      ...(name === 'orders' || name === 'pricing' ? { group: 'Commerce' } : {}),
    })),
  ]))
  assert.equal(scene.zones.length, 1)
  const zone = scene.zones[0]!
  assert.equal(zone.parent, 'observed:api')
  assert.deepEqual([...zone.members].sort(), ['observed:orders', 'observed:pricing'])
  for (const building of scene.buildings) {
    const member = zone.members.includes(building.representationId)
    assert.equal(contains(zone.rect, building.rect), member)
    if (member) {
      assert.ok(building.rect.gx >= zone.rect.gx + NESTED_CONTENT_PAD)
      assert.ok(building.rect.gy >= zone.rect.gy + NESTED_CONTENT_PAD)
      assert.ok(building.rect.gx + building.rect.w <= zone.rect.gx + zone.rect.w - NESTED_CONTENT_PAD)
      assert.ok(building.rect.gy + building.rect.d <= zone.rect.gy + zone.rect.d - NESTED_CONTENT_PAD)
    } else {
      assert.equal(apart(zone.rect, building.rect, GAP), true)
    }
  }
})

test.concurrent('the same world gives the same sheet and the world is untouched', async () => {
  const fixture = await loadAnnotatedArchitecture(viewerFixtureRoot)
  const before = structuredClone(fixture)
  const first = sheetScene(fixture)
  const second = sheetScene({
    elements: [...fixture.elements].reverse().map((element, index) => ({
      ...element,
      bounds: { x: 10_000 - index, y: -10_000 + index, width: 1, height: 1 },
    })),
    relationships: fixture.relationships,
  })
  assert.deepEqual(second, first)
  assert.deepEqual(fixture, before)
  assert.ok(first.buildings.length > 0 && first.routes.length === fixture.relationships.length)
})

test.concurrent('adding a sibling that sorts last keeps the earlier buildings in place', () => {
  const base = [
    box('shop', 'system', unit),
    box('api', 'container', unit, { parent: 'observed:shop' }),
    ...['a', 'b', 'c'].map(name => box(name, 'component', unit, { parent: 'observed:api' })),
  ]
  const offsets = (scene: SheetScene): Map<string, [number, number]> => {
    const slab = scene.slabs[0]!.rect
    return new Map(scene.buildings.map(building =>
      [building.id, [building.rect.gx - slab.gx, building.rect.gy - slab.gy]]))
  }
  const before = offsets(sheetScene(worldOf(base)))
  const after = offsets(sheetScene(worldOf([...base, box('d', 'component', unit, { parent: 'observed:api' })])))
  for (const [id, offset] of before) assert.deepEqual(after.get(id), offset)
})

test.concurrent('roof text, code files and code lines size a building', () => {
  assert.deepEqual(roofLines('Ab'), ['Ab'])
  assert.deepEqual(roofLines('Architecture model'), ['Architecture', 'model'])
  assert.deepEqual(roofLines('A very long component name indeed'), ['A very long component', 'name indeed'])
  assert.deepEqual(shapeOf(0), { kind: 'block', levels: 1 })
  assert.deepEqual(shapeOf(2), { kind: 'stack', levels: 2 })
  assert.deepEqual(shapeOf(4), { kind: 'tower', levels: 1 })
  assert.deepEqual(footprintOf(['Ab'], shapeOf(0), 0), { w: 2, d: 2 })
  assert.deepEqual(footprintOf(['Architecture', 'model'], shapeOf(2), 0), { w: 5, d: 3 })
  assert.deepEqual(footprintOf(['A very long component', 'name indeed'], shapeOf(4), 0), { w: 7, d: 2 })
  assert.deepEqual(footprintOf(['Ab'], shapeOf(3), 0), { w: 3, d: 3 })
  assert.deepEqual(footprintOf(['Ab'], shapeOf(0), 8), { w: 2, d: 3 })
  assert.deepEqual(footprintOf(['Ab'], { kind: 'round', levels: 1 }, 0), { w: 2, d: 2 })
  assert.deepEqual(footprintOf(['Ann the architect'], { kind: 'round', levels: 1 }, 0), { w: 6, d: 6 })
  assert.deepEqual(footprintOf(['Git'], { kind: 'pill', levels: 1 }, 0), { w: 4, d: 2 })
  const range = { min: 0, max: 2000 }
  assert.equal(floorsOf('observed', 0, range), 1)
  assert.equal(floorsOf('observed', 450, range), 1.5)
  assert.equal(floorsOf('observed', 2000, range), 4)
  assert.equal(floorsOf('observed', 700, { min: 700, max: 700 }), 1)
  assert.equal(floorsOf('planned', 2000, range), 1)

  const scene = sheetScene(worldOf([
    box('ann', 'actor', unit, { name: 'Ann the architect' }),
    { ...box('bank', 'system', unit, { external: true }), codeLines: 900 },
  ]))
  for (const building of scene.buildings) assert.equal(building.floors, 1)
  const ann = scene.buildings.find(building => building.id === 'ann')!
  assert.equal(ann.shape.kind, 'round')
  assert.ok(ann.rect.w === ann.rect.d && ann.rect.w > 2 && ann.lines.length === 2)
  const bank = scene.buildings.find(building => building.id === 'bank')!
  assert.equal(bank.shape.kind, 'pill')
  assert.ok(bank.rect.d === 2 && bank.lines.length === 1)
})

test.concurrent('a surface is at least as wide as its own name', () => {
  const scene = sheetScene(worldOf([
    box('bank', 'system', unit, { external: true, name: 'Ab' }),
    box('shop', 'system', unit, { name: 'A shop with a remarkably long name' }),
    box('api', 'container', unit, { parent: 'observed:shop', name: 'An application programming interface' }),
  ]))
  const external = scene.islands.find(island => island.kind === 'external')!
  assert.ok(external.rect.w * PLANE >= textWidth('EXTERNAL SYSTEMS', ISLAND_FONT, ISLAND_SPACING) + 2 * ROOF_PAD)
  const shop = scene.islands.find(island => island.kind === 'system')!
  assert.ok(shop.rect.w * PLANE >= textWidth(shop.name.toUpperCase(), ISLAND_FONT, ISLAND_SPACING) + 2 * ROOF_PAD)
  const api = scene.slabs[0]!
  assert.ok(api.rect.w * PLANE >= textWidth(api.name, SURFACE_FONT) + 2 * ROOF_PAD)
})

test.concurrent('the sheet is the islands plus the margin, starting at the margin', () => {
  const scene = sheetScene(shopWorld())
  const minX = Math.min(...scene.islands.map(island => island.rect.gx))
  const minY = Math.min(...scene.islands.map(island => island.rect.gy))
  const maxX = Math.max(...scene.islands.map(island => island.rect.gx + island.rect.w))
  const maxY = Math.max(...scene.islands.map(island => island.rect.gy + island.rect.d))
  assert.equal(minX, MARGIN)
  assert.equal(minY, MARGIN)
  assert.deepEqual(scene.sheet, { gx: 0, gy: 0, w: maxX + MARGIN, d: maxY + MARGIN })
})

test.concurrent('empty containers keep the nested-surface padding around their empty core', async () => {
  const { world: fixture } = await loadArchitectureViewModel(openclawFixtureRoot)
  const scene = sheetScene(fixture)
  assert.equal(scene.slabs.length, 6)
  for (const slab of scene.slabs) {
    const side = EMPTY + 2 * (NESTED_CONTENT_PAD - PAD)
    assert.equal(slab.rect.d, side)
    assert.ok(slab.rect.w >= side)
  }
})

test.concurrent('children no relationship touches keep the square-ish shelf', () => {
  const scene = sheetScene(worldOf([
    box('shop', 'system', unit),
    ...['a', 'b', 'c', 'd', 'e', 'f'].map(name => box(name, 'container', unit, { parent: 'observed:shop' })),
  ]))
  const rows = new Map<number, number>()
  for (const slab of scene.slabs) rows.set(slab.rect.gy, (rows.get(slab.rect.gy) ?? 0) + 1)
  assert.deepEqual([...rows.values()], [3, 3])
})
