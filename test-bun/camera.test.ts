import assert from 'node:assert/strict'
import { test } from 'bun:test'

import {
  centeredCamera,
  clampCamera,
  projectBounds,
  reveal,
} from '../src/viewers/tui/projection-camera.ts'

const world = { x: 0, y: 0, width: 100, height: 60 }
const viewport = { x: 26, y: 3, width: 60, height: 30 }

test.concurrent('the first camera centers the selected item within the fixed world', () => {
  assert.deepEqual(
    centeredCamera(world, { x: 45, y: 25, width: 10, height: 6 }, viewport),
    { x: 20, y: 13 },
  )
  assert.deepEqual(
    centeredCamera(world, { x: 0, y: 0, width: 10, height: 6 }, viewport),
    { x: 0, y: 0 },
  )
})

test.concurrent('selection moves only the camera needed to reveal it', () => {
  const camera = { x: 20, y: 10 }
  assert.deepEqual(
    reveal(camera, { x: 30, y: 15, width: 8, height: 5 }, world, viewport),
    camera,
  )
  assert.deepEqual(
    reveal(camera, { x: 85, y: 15, width: 8, height: 5 }, world, viewport),
    { x: 34, y: 10 },
  )
})

test.concurrent('camera projection does not change world geometry', () => {
  const bounds = { x: 40, y: 20, width: 12, height: 6 }
  const before = structuredClone(bounds)
  assert.deepEqual(projectBounds(bounds, { x: 20, y: 10 }, viewport), {
    x: 46,
    y: 13,
    width: 12,
    height: 6,
  })
  assert.deepEqual(bounds, before)
  assert.deepEqual(clampCamera({ x: 90, y: 50 }, world, viewport), { x: 40, y: 30 })
  assert.deepEqual(
    clampCamera({ x: 0, y: 0 }, { x: 10, y: 10, width: 20, height: 10 }, viewport),
    { x: -10, y: 0 },
  )
})
