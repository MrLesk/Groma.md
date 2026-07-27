import assert from 'node:assert/strict'
import test from 'node:test'

import { nextFocusPath } from '../src/viewer/focus.mjs'

test('selecting a sibling container replaces the current container focus', () => {
  assert.deepEqual(
    nextFocusPath(['groma', 'viewer'], 'scanner', 'container'),
    ['groma', 'scanner'],
  )
})

test('system and container expansion preserve the three-level focus contract', () => {
  assert.deepEqual(nextFocusPath([], 'groma', 'system'), ['groma'])
  assert.deepEqual(
    nextFocusPath(['groma'], 'viewer', 'container'),
    ['groma', 'viewer'],
  )
})

test('non-expandable element kinds leave focus unchanged', () => {
  const current = ['groma', 'viewer']

  assert.deepEqual(nextFocusPath(current, 'canvas', 'component'), current)
  assert.notEqual(nextFocusPath(current, 'canvas', 'component'), current)
})
