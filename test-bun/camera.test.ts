import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { projectBounds } from '../src/viewers/tui/projection-camera.ts'

test.concurrent('camera projection does not change world geometry', () => {
  const viewport = { x: 26, y: 3, width: 60, height: 30 }
  const bounds = { x: 40, y: 20, width: 12, height: 6 }
  const before = structuredClone(bounds)
  assert.deepEqual(projectBounds(bounds, { x: 20, y: 10 }, viewport), { x: 46, y: 13, width: 12, height: 6 })
  assert.deepEqual(bounds, before)
})
