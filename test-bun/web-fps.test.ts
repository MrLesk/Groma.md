import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { framesPerSecond } from '../src/viewers/web/chrome/fps.ts'

test.concurrent('FPS samples round the frame rate across their elapsed window', () => {
  assert.equal(framesPerSecond(30, 500), 60)
  assert.equal(framesPerSecond(37, 625), 59)
})
