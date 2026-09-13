import { createMapMotion } from '../src/viewers/web/iso/presentation.ts'
import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { fitArchitecture, fitCamera, pan, zoomAbout } from '../src/viewers/web/iso/camera.ts'
import { boundsOf } from '../src/viewers/web/iso/project.ts'
import { presentScene } from '../src/viewers/web/iso/presentation.ts'
import { NESTED_POSE, OVERHEAD_POSE, PLAN_DURATION_MS } from '../src/viewers/web/layers/orbit.ts'
import { box, uses, worldOf } from './helpers.ts'

function fixture() {
  const unit = { x: 0, y: 0, width: 1, height: 1 }
  return worldOf([
    box('person', 'actor', unit),
    box('system', 'system', unit, { children: ['observed:container'] }),
    box('container', 'container', unit, { parent: 'observed:system', children: ['observed:part', 'observed:small', 'draft:next'] }),
    box('part', 'component', unit, {
      parent: 'observed:container',
      code: Array.from({ length: 7 }, (_, index) => ({
        scanner: 'fixture', file: `src/part-${index}.ts`, lines: 100 * index,
        dependencies: index, dependents: 6 - index,
      })),
    }),
    box('small', 'component', unit, { parent: 'observed:container', code: [{ scanner: 'fixture', file: 'src/small.ts' }] }),
    box('next', 'component', unit, { representationId: 'draft:next', origin: 'draft', parent: 'observed:container' }),
    box('external', 'system', unit, { external: true }),
  ], [uses('request', 'person', 'part'), uses('send', 'part', 'external')])
}

test.concurrent('overhead flattens floors into one footprint without changing architecture or evidence', () => {
  const world = fixture()
  const before = structuredClone(world)
  const iso = presentScene(world.sheet, undefined, NESTED_POSE)
  const plan = presentScene(world.sheet, undefined, OVERHEAD_POSE)
  const source = world.sheet.buildings.find(item => item.id === 'part')!
  const flat = plan.buildings.find(item => item.building.id === 'part')!
  assert.ok(source.floors.length > 1)
  assert.equal(flat.floors.length, 1)
  assert.equal(flat.floors[0]!.length, 1)
  assert.deepEqual(flat.building.floors.flatMap(floor => floor.files), source.floors.flatMap(floor => floor.files))
  const footprint = boundsOf(flat.floors[0]![0]!.points)
  assert.ok(Math.abs(footprint.width / footprint.height - source.rect.w / source.rect.d) < 1e-10)
  assert.deepEqual(plan.buildings.map(item => [item.building.representationId, item.building.origin]).sort(),
    iso.buildings.map(item => [item.building.representationId, item.building.origin]).sort())
  assert.deepEqual(plan.routes.map(item => item.route), iso.routes.map(item => item.route))
  assert.deepEqual(plan.slabs.map(item => item.slab), iso.slabs.map(item => item.slab))
  assert.deepEqual(world, before)
  assert.deepEqual(presentScene(world.sheet, undefined, NESTED_POSE), iso)
})

test.concurrent('view switches keep projected geometry usable by shared fitting, zoom and pan', () => {
  const world = fixture()
  const motion = createMapMotion()
  const viewport = { width: 800, height: 600 }
  for (const view of ['iso', '2d', 'layers', '2d', 'iso'] as const) {
    motion.choose(view, 0, false)
    const scene = presentScene(world.sheet, undefined, motion.pose)
    const fit = fitCamera(scene.bounds, viewport)
    const selected = fitArchitecture(scene, world, ['observed:part', 'draft:next'], viewport)!
    assert.ok(selected.k >= fit.k)
    const centre = { x: viewport.width / 2, y: viewport.height / 2 }
    const zoom = zoomAbout(fit, 1.25, centre, fit)
    assert.ok(zoom.k > fit.k)
    const moved = pan(zoom, 20, -10)
    assert.ok(Object.values(moved).every(Number.isFinite))
    for (const route of scene.routes) assert.deepEqual(route.arrow.at, route.points.at(-1))
  }
})


test.concurrent('intermediate plan geometry settles continuously without changing identities or evidence', () => {
  const world = fixture(), before = structuredClone(world)
  const motion = createMapMotion()
  const spatial = presentScene(world.sheet, undefined, motion.pose)
  motion.choose('2d', 0, true)
  assert.deepEqual(presentScene(world.sheet, undefined, motion.pose), spatial)
  motion.step(PLAN_DURATION_MS / 2)
  const midway = presentScene(world.sheet, undefined, motion.pose)
  const source = world.sheet.buildings.find(item => item.id === 'part')!
  const middle = midway.buildings.find(item => item.building.id === 'part')!
  assert.ok(middle.building.heightUnits > 0 && middle.building.heightUnits < source.heightUnits)
  assert.equal(middle.floors.length, source.floors.length)
  assert.deepEqual(middle.building.floors.flatMap(floor => floor.files), source.floors.flatMap(floor => floor.files))
  motion.step(PLAN_DURATION_MS - 1)
  const almost = presentScene(world.sheet, undefined, motion.pose)
  motion.step(PLAN_DURATION_MS)
  const plan = presentScene(world.sheet, undefined, motion.pose)
  const lastRoof = almost.buildings.find(item => item.building.id === 'part')!.floors.at(-1)!.find(face => face.side === 'top')!
  const planRoof = plan.buildings.find(item => item.building.id === 'part')!.floors[0]![0]!
  lastRoof.points.forEach((point, index) => {
    assert.ok(Math.hypot(point.x - planRoof.points[index]!.x, point.y - planRoof.points[index]!.y) < 0.01)
  })
  assert.deepEqual(midway.routes.map(route => route.route), spatial.routes.map(route => route.route))
  motion.choose('iso', PLAN_DURATION_MS, true)
  assert.deepEqual(presentScene(world.sheet, undefined, motion.pose), plan)
  motion.step(PLAN_DURATION_MS * 2)
  assert.deepEqual(presentScene(world.sheet, undefined, motion.pose), spatial)
  assert.deepEqual(world, before)
})
