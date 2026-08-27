import assert from 'node:assert/strict'

import { test } from 'bun:test'

import {
  LEVELS,
  depthOf,
  emphasis,
  facadeDetailsVisible,
  gridVisible,
  minorGridVisible,
  buildingNamesVisible,
  strokeAt,
  tintAt,
  weightAt,
} from '../src/viewers/web/iso/scale.ts'

test.concurrent('each level down is thinner and darker, with buildings at one pixel', () => {
  const depths = LEVELS.map(depthOf)
  for (let index = 1; index < depths.length; index += 1) {
    assert.ok(strokeAt(depths[index]!) < strokeAt(depths[index - 1]!))
    assert.ok(tintAt(depths[index]!) > tintAt(depths[index - 1]!))
  }
  assert.equal(strokeAt(depthOf('building')), 1)
  assert.ok(emphasis(1) > emphasis(0.5) && emphasis(0.5) > 1)
})

test.concurrent('zoom keeps strokes bounded and removes details below readable size', () => {
  assert.equal(weightAt(1), 1)
  assert.ok(weightAt(4) > 1 && weightAt(4) <= 2)
  assert.equal(weightAt(100), 2)
  assert.equal(weightAt(0.01), 0.75)
  assert.equal(buildingNamesVisible(0.54), false)
  assert.equal(buildingNamesVisible(0.55), true)
  assert.equal(facadeDetailsVisible(0.9), false)
  assert.equal(facadeDetailsVisible(1), true)
  assert.equal(minorGridVisible(0.12), false)
  assert.equal(minorGridVisible(0.13), true)
  assert.equal(gridVisible(0.049), false)
  assert.equal(gridVisible(0.05), true)
})
