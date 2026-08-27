import assert from 'node:assert/strict'

import { test } from 'bun:test'

import { projectScene } from '../src/viewers/web/iso/project.ts'
import { sceneAtSeparation } from '../src/viewers/web/layers/separation.ts'
import {
  EXPLODED_POSE,
  NESTED_POSE,
  ORBIT_DURATION_MS,
  createLayerMotion,
  interpolatePose,
  orbitPose,
} from '../src/viewers/web/layers/orbit.ts'
import { box, uses, worldOf } from './helpers.ts'

function sourceScene() {
  const bounds = { x: 0, y: 0, width: 1, height: 1 }
  const world = worldOf([
    box('person', 'actor', bounds),
    box('product', 'system', bounds, { children: ['observed:service'] }),
    box('service', 'container', bounds, {
      parent: 'observed:product',
      children: ['observed:part'],
    }),
    box('part', 'component', bounds, { parent: 'observed:service' }),
  ], [uses('starts', 'person', 'part')])
  return projectScene(world.sheet)
}

test.concurrent('F2 motion reaches both mode poses and drives the displayed separation', () => {
  const motion = createLayerMotion()
  assert.equal(motion.active, false)
  assert.deepEqual(motion.pose, NESTED_POSE)
  assert.equal(motion.toggle(0, true), true)
  assert.equal(motion.active, true)
  assert.equal(motion.step(ORBIT_DURATION_MS / 2), true)
  assert.ok(motion.pose.separation > 0 && motion.pose.separation < 1)
  assert.equal(motion.step(ORBIT_DURATION_MS), false)
  assert.deepEqual(motion.pose, EXPLODED_POSE)
  assert.deepEqual(sceneAtSeparation(sourceScene(), motion.pose.separation).layerPlanes.map(plane => plane.layer), [
    'system',
    'container',
    'component',
  ])

  motion.toggle(ORBIT_DURATION_MS, false)
  assert.equal(motion.active, false)
  assert.deepEqual(motion.pose, NESTED_POSE)
  assert.equal(sceneAtSeparation(sourceScene(), motion.pose.separation).layerPlanes.length, 0)
})

test.concurrent('exploded projection separates the three levels without changing the source scene', () => {
  const source = sourceScene()
  const snapshot = structuredClone(source)
  const exploded = sceneAtSeparation(source, 1)
  const sourceIsland = source.islands.find(item => item.island.kind === 'system')!
  const liftedIsland = exploded.islands.find(item => item.island.kind === 'system')!
  const sourceSlab = source.slabs[0]!
  const liftedSlab = exploded.slabs[0]!
  const sourceComponent = source.buildings.find(item => item.building.kind === 'component')!
  const liftedComponent = exploded.buildings.find(item => item.building.kind === 'component')!
  const slabPoint = sourceSlab.faces[0]!.points[0]!
  const liftedSlabPoint = liftedSlab.faces[0]!.points[0]!
  const componentPoint = sourceComponent.floors[0]![0]!.points[0]!
  const liftedComponentPoint = liftedComponent.floors[0]![0]!.points[0]!

  assert.deepEqual(liftedIsland.polygon, sourceIsland.polygon)
  assert.equal(liftedSlabPoint.x, slabPoint.x)
  assert.equal(liftedComponentPoint.x, componentPoint.x)
  assert.ok(liftedSlabPoint.y < slabPoint.y)
  assert.ok(componentPoint.y - liftedComponentPoint.y > slabPoint.y - liftedSlabPoint.y)
  const visible = [
    { x: source.bounds.x, y: source.bounds.y },
    { x: source.bounds.x + source.bounds.width, y: source.bounds.y + source.bounds.height },
    ...exploded.layerPlanes.flatMap(plane => [...plane.polygon, plane.label.at]),
  ]
  for (const point of visible) {
    assert.ok(point.x >= exploded.bounds.x && point.x <= exploded.bounds.x + exploded.bounds.width)
    assert.ok(point.y >= exploded.bounds.y && point.y <= exploded.bounds.y + exploded.bounds.height)
  }
  assert.deepEqual(source, snapshot)
})

test.concurrent('a relationship joins endpoints that live on different planes', () => {
  const source = sourceScene()
  const exploded = sceneAtSeparation(source, 1)
  const sourceRoute = source.routes[0]!
  const route = exploded.routes[0]!

  assert.equal(route.lifts.length, 1)
  assert.deepEqual(route.lifts[0]!.from, sourceRoute.points[0])
  assert.deepEqual(route.lifts[0]!.to, route.points[0])
  assert.equal(route.lifts[0]!.from.x, route.lifts[0]!.to.x)
  assert.ok(route.lifts[0]!.to.y < route.lifts[0]!.from.y)
})

test.concurrent('orbit wraps yaw, clamps pitch, and interpolates across the yaw seam', () => {
  const turned = orbitPose({ ...EXPLODED_POSE, yaw: 359 }, 10, -10_000)
  assert.ok(turned.yaw >= 0 && turned.yaw < 360)
  assert.equal(turned.pitch, 58)
  assert.equal(orbitPose(turned, 0, 10_000).pitch, 18)

  const halfway = interpolatePose(
    { ...EXPLODED_POSE, yaw: 350 },
    { ...EXPLODED_POSE, yaw: 10 },
    0.5,
  )
  assert.ok(halfway.yaw < 10 || halfway.yaw > 350)
})
