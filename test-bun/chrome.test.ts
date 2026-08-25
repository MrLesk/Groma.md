import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { createTestRenderer } from '@opentui/core/testing'

import { paneLayout } from '../src/viewers/tui/layout.ts'
import { initialState, reduceViewer } from '../src/viewers/tui/navigation.ts'
import { projectWorld } from '../src/viewers/tui/projection.ts'
import { mountTerminalViewer } from '../src/viewers/tui/terminal-viewer.ts'
import {
  navigationWorld,
  press,
  terminalModel,
  viewerFixtureRoot,
} from './helpers.ts'

test.concurrent('fixed chrome reserves one header, body, and footer band', () => {
  const layout = paneLayout(120, 36)
  assert.equal(layout.header.y, 1)
  assert.equal(layout.footer.y, 34)
  assert.equal(layout.hierarchy.y, 2)
  assert.equal(layout.map.y, 2)
  assert.equal(layout.details.y, 2)
  assert.equal(layout.map.x, layout.hierarchy.width)
  assert.equal(layout.map.x + layout.map.width, layout.details.x)
})

test.concurrent('details changes pane width without changing camera or world cells', () => {
  const model = navigationWorld()
  let state = initialState(model)
  state = reduceViewer(model, state, 'toggle-details')
  assert.equal(state.panes.details, false)
  assert.equal(reduceViewer(model, state, 'tab').focus, 'hierarchy')

  const narrow = paneLayout(120, 36)
  const wide = paneLayout(120, 36, { details: false })
  const first = projectWorld(model, {
    viewport: narrow.mapViewport,
    currentId: 'observed:alpha',
  })
  const second = projectWorld(model, {
    viewport: wide.mapViewport,
    currentId: 'observed:alpha',
    camera: first.camera,
  })
  assert.deepEqual(second.camera, first.camera)
  assert.deepEqual(
    second.items.map(item => [item.key, item.cellBounds.x, item.cellBounds.y]),
    first.items.map(item => [item.key, item.cellBounds.x, item.cellBounds.y]),
  )
})

test.concurrent('details always follows the current selection', async () => {
  const model = await terminalModel(viewerFixtureRoot)
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const app = mountTerminalViewer(setup.renderer, model)
  app.setView({ level: 'components', currentId: 'observed:orders' })
  await setup.renderOnce()

  const layout = paneLayout(120, 36)
  const details = setup.captureCharFrame().split('\n')
    .map(line => [...line].slice(layout.details.x).join(''))
    .join('\n')
  assert.match(details, /Orders/)
  assert.match(await press(setup, 't'), /src\/orders\.ts/)
  app.destroy()
})
