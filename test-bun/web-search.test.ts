import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { opensArchitectureSearch } from '../src/viewers/web/search/control.ts'

function key(
  value: string,
  modifiers: Partial<{ altKey: boolean, ctrlKey: boolean, metaKey: boolean }> = {},
) {
  return {
    key: value,
    altKey: modifiers.altKey ?? false,
    ctrlKey: modifiers.ctrlKey ?? false,
    metaKey: modifiers.metaKey ?? false,
  }
}

test.concurrent('web search opens from slash only outside editable controls', () => {
  assert.equal(opensArchitectureSearch(key('/'), false, false), true)
  assert.equal(opensArchitectureSearch(key('/'), true, false), false)
  assert.equal(opensArchitectureSearch(key('/', { ctrlKey: true }), false, false), false)
})

test.concurrent('web search opens from the platform command shortcut', () => {
  assert.equal(opensArchitectureSearch(key('k', { metaKey: true }), true, true), true)
  assert.equal(opensArchitectureSearch(key('k', { ctrlKey: true }), true, true), false)
  assert.equal(opensArchitectureSearch(key('K', { ctrlKey: true }), true, false), true)
  assert.equal(opensArchitectureSearch(key('K', { metaKey: true }), true, false), false)
  assert.equal(opensArchitectureSearch(key('k', { altKey: true, ctrlKey: true }), false, false), false)
})
