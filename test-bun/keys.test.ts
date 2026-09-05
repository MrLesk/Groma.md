import assert from 'node:assert/strict'
import { test } from 'bun:test'


import { initialState, reduceViewer } from '../src/viewers/tui/navigation.ts'
import { projectWorld } from '../src/viewers/tui/projection.ts'
import { navigationWorld, paneLayout } from './helpers.ts'


test.concurrent('? opens the keys box in the details pane and Escape brings the previous details back without touching the map', () => {
  const model = navigationWorld()
  const folded = reduceViewer(model, initialState(model), 'toggle-details')
  const shown = reduceViewer(model, folded, 'toggle-keys')
  assert.equal(shown.keys, true)
  assert.equal(shown.panes.details, true)
  const viewport = paneLayout(120, 36).mapViewport
  const before = projectWorld(model, { viewport, level: folded.level, currentId: folded.currentId })
  const after = projectWorld(model, { viewport, level: shown.level, currentId: shown.currentId })
  assert.deepEqual([after.currentId, after.camera, after.items.map(item => item.cellBounds)], [before.currentId, before.camera, before.items.map(item => item.cellBounds)])
  const closed = reduceViewer(model, shown, 'dismiss')
  assert.equal(closed.keys, false)
  assert.equal(closed.panes.details, true)
  assert.equal(reduceViewer(model, shown, 'toggle-keys').keys, false)
})
