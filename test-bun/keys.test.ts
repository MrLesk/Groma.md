import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { createTestRenderer } from '@opentui/core/testing'

import { KEYS_BOX, MAP_KEYS } from '../src/viewers/tui/keys.ts'
import { initialState, reduceViewer } from '../src/viewers/tui/navigation.ts'
import { projectWorld } from '../src/viewers/tui/projection.ts'
import { mountTerminalViewer } from '../src/viewers/tui/terminal-viewer.ts'
import { navigationWorld, paneLayout, press, terminalModel, viewerFixtureRoot } from './helpers.ts'

test.concurrent('the keys box lists exactly the keys the viewer handles', () => {
  const listed = KEYS_BOX.flatMap(row => row.names)
  assert.deepEqual([...listed].sort(), MAP_KEYS.map(key => key.name).sort())
  assert.equal(new Set(listed).size, listed.length)
})

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

test.concurrent('the keys box shows over the selection and gives it back', async () => {
  const model = await terminalModel(viewerFixtureRoot)
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const app = mountTerminalViewer(setup.renderer, model)
  await setup.renderOnce()
  const title = (frame: string) => [...frame.split('\n')[2]!].slice(paneLayout(120, 36).details.x).join('')
  const selection = title(setup.captureCharFrame())
  const box = await press(setup, '?')
  assert.ok(title(box).includes('Keys'))
  assert.ok(box.includes(KEYS_BOX[0]!.label))
  assert.equal(title(await press(setup, 'escape')), selection)
  app.destroy()
})
