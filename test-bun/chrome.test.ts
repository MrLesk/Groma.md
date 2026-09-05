import assert from 'node:assert/strict'
import { detailsScrollOffset } from '../src/viewers/tui/panes/screen.ts'
import { test } from 'bun:test'

import { createTestRenderer } from '@opentui/core/testing'

import { detailsContentWidth, fitPanes, panesForWidth, terminalLayout } from '../src/viewers/tui/layout.ts'
import type { Bounds } from '../src/types.ts'
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

test.concurrent('details changes pane width and the selection stays centred in either map width', () => {
  const model = navigationWorld()
  let state = initialState(model)
  state = reduceViewer(model, state, 'toggle-details')
  assert.equal(state.focus, 'details')
  assert.equal(state.panes.details, true)
  state = reduceViewer(model, state, 'toggle-details')
  assert.equal(state.panes.details, false)
  assert.equal(reduceViewer(model, state, 'toggle-hierarchy').focus, 'hierarchy')

  const centre = (viewport: Bounds) => {
    const projection = projectWorld(model, { viewport, currentId: 'observed:alpha' })
    const subject = projection.worldBounds.width <= viewport.width
      ? projection.worldBounds
      : projection.items.find(item => item.representationId === 'observed:alpha')!.worldBounds
    return subject.x + subject.width / 2 - projection.camera.x
  }
  const narrow = paneLayout(120, 36).mapViewport
  const wide = paneLayout(120, 36, { hierarchy: true, details: false }).mapViewport
  assert.ok(Math.abs(centre(narrow) - narrow.width / 2) <= 1)
  assert.ok(Math.abs(centre(wide) - wide.width / 2) <= 1)
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

test.concurrent('reading reserves 80 text columns when possible without changing saved pane choices', () => {
  const model = navigationWorld()
  for (const width of [80, 120, 200]) {
    const before = { ...initialState(model), terminalWidth: width, panes: panesForWidth(width) }
    const reading = { ...before, focus: 'details' as const, panes: { ...before.panes, details: true }, taskRecord: { id: 'TASK-1', row: 0 } }
    const saved = { ...reading.panes }
    const layout = terminalLayout(reading)
    assert.equal(detailsContentWidth(reading), Math.min(80, width - 4))
    assert.equal(layout.map, width === 200)
    if (layout.map) assert.ok(layout.mapWidth >= 40)
    assert.deepEqual(reading.panes, saved)
    assert.equal(terminalLayout(before).map, true)
    const hierarchyFocus = { ...reading, focus: 'hierarchy' as const }
    assert.equal(detailsContentWidth(hierarchyFocus), width === 200 ? 80 : 28)
    assert.equal(terminalLayout(hierarchyFocus).map, true)
  }
})

test.concurrent('details can scroll past their final link to the end of a record', () => {
  const pane = { lines: Array.from({ length: 80 }, () => []), cursor: 35 }
  const height = 20
  assert.equal(detailsScrollOffset(pane, 0, height), 16)
  assert.ok(detailsScrollOffset(pane, 40, height) > pane.cursor)
  assert.equal(detailsScrollOffset(pane, 100, height), pane.lines.length - height)
})

test.concurrent('shrinking to 80 columns retains map space and permits explicit details focus', () => {
  const model = navigationWorld()
  const state = { ...initialState(model), currentId: 'observed:pleft', level: 'components' as const }
  const panes = fitPanes(80, state.panes, state.focus)
  assert.equal(panes.details, false)
  const details = reduceViewer(model, { ...state, panes }, 'enter')
  const fitted = fitPanes(80, details.panes, details.focus)
  assert.equal(details.focus, 'details')
  assert.deepEqual(fitted, { hierarchy: false, details: true })
})

test.concurrent('Work focus and a folded details pane end the profile', () => {
  const model = { ...navigationWorld(), project: { title: 'Shop', overview: 'A shop.', overviewBlocks: [] } }
  const shown = reduceViewer(model, initialState(model), 'toggle-profile')
  assert.equal(shown.profile, true)
  assert.equal(reduceViewer(model, shown, 'toggle-details').profile, false)
  assert.equal(reduceViewer(model, shown, 'toggle-work').profile, false)
  assert.equal(reduceViewer(model, shown, 'toggle-hierarchy').profile, true)
  assert.equal(reduceViewer(model, shown, 'dismiss').focus, 'architecture')
  for (const state of [initialState(model), reduceViewer(model, initialState(model), 'toggle-work')]) {
    const help = reduceViewer(model, state, 'toggle-keys')
    assert.equal(reduceViewer(model, help, 'dismiss').focus, 'architecture')
  }
})

test.concurrent('pane keys focus, fold and reopen their pane while Tab stays inside details', () => {
  const model = navigationWorld()
  let state = reduceViewer(model, initialState(model), 'toggle-hierarchy')
  assert.equal(state.focus, 'hierarchy')
  state = reduceViewer(model, state, 'toggle-hierarchy')
  assert.equal(state.panes.hierarchy, false)
  assert.equal(state.focus, 'architecture')
  assert.equal(reduceViewer(model, state, 'tab').focus, 'architecture')
  state = reduceViewer(model, state, 'toggle-hierarchy')
  assert.equal(state.panes.hierarchy, true)
  assert.equal(state.focus, 'hierarchy')
  state = reduceViewer(model, state, 'toggle-details')
  state = reduceViewer(model, state, 'tab')
  assert.equal(state.detailsTab, 'how')
  assert.equal(state.focus, 'details')
})

function detailsTitle(frame: string, width: number): string {
  return [...frame.split('\n')[2]!].slice(paneLayout(width, 36).details.x).join('')
}

test.concurrent('a folded hierarchy gives its columns to the map and keeps the selected island centred', async () => {
  const model = await terminalModel(viewerFixtureRoot)
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const app = mountTerminalViewer(setup.renderer, model)
  await setup.renderOnce()
  const selectedId = initialState(model).currentId!
  const selected = model.elements.find(element => element.representationId === selectedId)!
  const layout = paneLayout(120, 36)
  const folded = paneLayout(120, 36, { hierarchy: false, details: true })
  const centre = (viewport: Bounds) => {
    const row = projectWorld(model, { viewport: { ...viewport, x: 0, y: 0 }, currentId: selectedId }).items
      .find(item => item.representationId === selectedId)!
    return row.cellBounds.x + row.cellBounds.width / 2
  }
  assert.ok(Math.abs(centre(layout.mapViewport) - layout.mapViewport.width / 2) <= 1)
  assert.ok(Math.abs(centre(folded.mapViewport) - folded.mapViewport.width / 2) <= 1)
  const frame = await press(setup, 't', 't')
  const titled = frame.split('\n').slice(layout.map.y).map(row => [...row].slice(0, layout.details.x).join('')).find(row => row.includes(selected.title))
  assert.ok(titled !== undefined)
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

test.concurrent('a click on a root row selects it', async () => {
  const model = await terminalModel(viewerFixtureRoot)
  const initialId = initialState(model).currentId
  const container = model.elements.find(element => element.kind === 'container' && element.representationId !== initialId)!
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const app = mountTerminalViewer(setup.renderer, model)
  await setup.renderOnce()
  const layout = paneLayout(120, 36)
  // The title sits inside the row's cells, so clicking it selects the row.
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
