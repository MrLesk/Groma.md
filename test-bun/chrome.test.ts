import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { createTestRenderer } from '@opentui/core/testing'

import { panesForWidth } from '../src/viewers/tui/layout.ts'
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

test.concurrent('details changes pane width without changing world geometry', () => {
  const model = navigationWorld()
  let state = initialState(model)
  state = reduceViewer(model, state, 'toggle-details')
  assert.equal(state.panes.details, false)
  assert.equal(reduceViewer(model, state, 'tab').focus, 'hierarchy')

  const narrow = paneLayout(120, 36).mapViewport
  const wide = paneLayout(120, 36, { hierarchy: true, details: false }).mapViewport
  const narrowProjection = projectWorld(model, { viewport: narrow, currentId: 'observed:alpha' })
  const wideProjection = projectWorld(model, { viewport: wide, currentId: 'observed:alpha' })
  assert.deepEqual(wideProjection.worldBounds, narrowProjection.worldBounds)
  assert.deepEqual(
    wideProjection.items.map(item => [item.key, item.worldBounds]),
    narrowProjection.items.map(item => [item.key, item.worldBounds]),
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

test.concurrent('panes start folded by the width table', () => {
  assert.deepEqual(panesForWidth(80), { hierarchy: false, details: false })
  assert.deepEqual(panesForWidth(90), { hierarchy: true, details: false })
  assert.deepEqual(panesForWidth(119), { hierarchy: true, details: false })
  assert.deepEqual(panesForWidth(120), { hierarchy: true, details: true })
})

test.concurrent('an 80-column terminal starts map-only and names the selection in the footer', async () => {
  const model = await terminalModel(viewerFixtureRoot)
  const setup = await createTestRenderer({ width: 80, height: 30 })
  const app = mountTerminalViewer(setup.renderer, model)
  await setup.renderOnce()
  const rows = setup.captureCharFrame().split('\n')
  const selected = model.elements.find(element => element.representationId === initialState(model).currentId)!
  assert.equal([...rows[2]!].filter(cell => cell === '╭').length, 1)
  assert.ok(rows[28]!.includes(selected.title))
  app.destroy()
})

test.concurrent('Work focus and a folded details pane end the profile', () => {
  const model = { ...navigationWorld(), project: { title: 'Shop', overview: 'A shop.', overviewBlocks: [] } }
  const shown = reduceViewer(model, initialState(model), 'toggle-profile')
  assert.equal(shown.profile, true)
  assert.equal(reduceViewer(model, shown, 'toggle-details').profile, false)
  assert.equal(reduceViewer(model, shown, 'toggle-work').profile, false)
  assert.equal(reduceViewer(model, shown, 'toggle-hierarchy').profile, true)
})

test.concurrent('[ folds the hierarchy and Tab reopens it', () => {
  const model = navigationWorld()
  let state = reduceViewer(model, initialState(model), 'tab')
  assert.equal(state.focus, 'hierarchy')
  state = reduceViewer(model, state, 'toggle-hierarchy')
  assert.equal(state.panes.hierarchy, false)
  assert.equal(state.focus, 'architecture')
  state = reduceViewer(model, state, 'tab')
  assert.equal(state.panes.hierarchy, true)
  assert.equal(state.focus, 'hierarchy')
})

function detailsTitle(frame: string, width: number): string {
  return [...frame.split('\n')[2]!].slice(paneLayout(width, 36).details.x).join('')
}

test.concurrent('a folded hierarchy gives its columns to the same fixed map', async () => {
  const model = await terminalModel(viewerFixtureRoot)
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const app = mountTerminalViewer(setup.renderer, model)
  await setup.renderOnce()
  const selectedId = initialState(model).currentId!
  const layout = paneLayout(120, 36)
  const folded = paneLayout(120, 36, { hierarchy: false, details: true })
  const before = projectWorld(model, { viewport: layout.mapViewport, currentId: selectedId })
  const after = projectWorld(model, { viewport: folded.mapViewport, currentId: selectedId })
  assert.ok(folded.mapViewport.width > layout.mapViewport.width)
  assert.deepEqual(
    after.items.map(item => [item.key, item.worldBounds]),
    before.items.map(item => [item.key, item.worldBounds]),
  )
  const frame = await press(setup, '[')
  assert.ok(detailsTitle(frame, 120).includes(model.elements.find(element => element.representationId === selectedId)!.title))
  app.destroy()
})

test.concurrent('p shows the project profile until Escape', async () => {
  const model = await terminalModel(viewerFixtureRoot)
  assert.ok(model.project)
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const app = mountTerminalViewer(setup.renderer, model)
  await setup.renderOnce()
  const selection = detailsTitle(setup.captureCharFrame(), 120)
  const profile = detailsTitle(await press(setup, 'p'), 120)
  assert.ok(profile.includes(model.project.title))
  assert.notEqual(profile, selection)
  assert.equal(detailsTitle(await press(setup, 'escape'), 120), selection)
  app.destroy()
})

test.concurrent('a click on a hierarchy row selects it', async () => {
  const model = await terminalModel(viewerFixtureRoot)
  const actor = model.elements.find(element => element.kind === 'actor')!
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const app = mountTerminalViewer(setup.renderer, model)
  await setup.renderOnce()
  const layout = paneLayout(120, 36)
  const y = setup.captureCharFrame().split('\n')
    .findIndex(row => [...row].slice(0, layout.hierarchy.width).join('').includes(actor.title))
  assert.ok(y > 0)
  const before = detailsTitle(setup.captureCharFrame(), 120)
  await setup.mockMouse.click(4, y)
  await setup.renderOnce()
  const after = detailsTitle(setup.captureCharFrame(), 120)
  assert.notEqual(after, before)
  assert.ok(after.includes(actor.title))
  app.destroy()
})

test.concurrent('a click on a building selects it', async () => {
  const model = await terminalModel(viewerFixtureRoot)
  const container = model.elements.find(element => element.kind === 'container')!
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const app = mountTerminalViewer(setup.renderer, model)
  await setup.renderOnce()
  const layout = paneLayout(120, 36)
  // The card's title sits inside its cells, so clicking the title clicks the building.
  const rows = setup.captureCharFrame().split('\n')
  const y = rows.findIndex((row, index) => index > layout.map.y && row.slice(layout.map.x, layout.details.x).includes(container.title))
  assert.ok(y > 0)
  const x = rows[y]!.indexOf(container.title, layout.map.x)
  const before = detailsTitle(setup.captureCharFrame(), 120)
  await setup.mockMouse.click(x, y)
  await setup.renderOnce()
  const after = detailsTitle(setup.captureCharFrame(), 120)
  assert.notEqual(after, before)
  assert.ok(after.includes(container.title))
  app.destroy()
})
