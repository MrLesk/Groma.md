import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { createTestRenderer } from '@opentui/core/testing'

import { initialState, reduceViewer } from '../src/viewers/tui/navigation.ts'
import { projectWorld } from '../src/viewers/tui/projection.ts'
import { mountTerminalViewer } from '../src/viewers/tui/terminal-viewer.ts'
import {
  navigationWorld,
  mapRegion,
  paneLayout,
  press,
  terminalModel,
  viewerFixtureRoot,
} from './helpers.ts'

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
  app.setView({ level: 'components', currentId: 'orders' })
  await setup.renderOnce()

  const layout = paneLayout(120, 36)
  const details = setup.captureCharFrame().split('\n')
    .map(line => [...line].slice(layout.details.x).join(''))
    .join('\n')
  assert.match(details, /Orders/)
  app.destroy()
})

test.concurrent('leaving Work focus restores the saved map camera', async () => {
  const base = navigationWorld()
  const model = {
    ...base,
    work: {
      statuses: ['To Do', 'In Progress', 'Done'],
      defaultStatus: 'To Do',
      items: [{
        id: 'TASK-1',
        title: 'Change external system',
        status: 'In Progress',
        assignees: [],
        references: ['ext'],
        modifiedFiles: [],
        acceptanceCriteriaCompleted: 0,
        acceptanceCriteriaCount: 0,
        updatedAt: '2026-08-30T12:00:00Z',
      }],
    },
  }
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const app = mountTerminalViewer(setup.renderer, model, { currentId: 'observed:alpha' })
  await setup.renderOnce()
  const before = mapRegion(setup.captureCharFrame(), 120)

  const focused = mapRegion(await press(setup, 'w'), 120)
  assert.notEqual(focused, before)
  const restored = mapRegion(await press(setup, 'w'), 120)
  assert.equal(restored, before)
  app.destroy()
})
