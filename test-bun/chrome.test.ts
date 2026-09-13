import assert from 'node:assert/strict'
import { detailsScrollOffset } from '../src/viewers/tui/panes/screen.ts'
import { test } from 'bun:test'

import { detailsContentWidth, fitPanes, panesForWidth, terminalLayout } from '../src/viewers/tui/layout.ts'
import type { Bounds } from '../src/types.ts'
import { initialState, reduceViewer } from '../src/viewers/tui/navigation.ts'
import { projectWorld } from '../src/viewers/tui/projection.ts'
import { navigationWorld, paneLayout } from './helpers.ts'

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
