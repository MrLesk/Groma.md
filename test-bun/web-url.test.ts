import assert from 'node:assert/strict'

import { test } from 'bun:test'

import type { ActiveWorkItem, ArchitectureWorld } from '../src/types.ts'
import { readView, writeView } from '../src/viewers/web/url.ts'
import type { ViewState } from '../src/viewers/web/url.ts'
import { box, uses } from './helpers.ts'

const unit = { x: 0, y: 0, width: 1, height: 1 }

const world: ArchitectureWorld = {
  bounds: unit,
  groups: [],
  elements: [
    box('dev', 'person', unit),
    box('tool', 'system', unit),
    box('cli', 'container', unit, { parent: 'observed:tool' }),
    box('commands', 'component', unit, { parent: 'observed:cli' }),
    box('scan', 'component', unit, { parent: 'observed:cli' }),
  ],
  relationships: [uses('relationship:0', 'dev', 'commands'), uses('relationship:1', 'commands', 'scan')],
}

const full: ViewState = {
  selectedId: 'observed:scan',
  action: { id: 'relationship:1', personId: 'observed:dev' },
  tab: 'how',
  dark: true,
}

test.concurrent('a view round-trips through the query string with authored ids', () => {
  const query = writeView(full, world, [])
  assert.equal(query, '?component=scan&flow=commands/scan&by=dev&tab=how&theme=dark')
  assert.deepEqual(readView(query, world, []), full)
})

test.concurrent('defaults write nothing and read back as the default view', () => {
  const rest: ViewState = { selectedId: undefined, action: {}, tab: 'what', dark: false }
  assert.equal(writeView(rest, world, []), '')
  assert.deepEqual(readView('', world, []), rest)
  assert.equal(writeView({ ...rest, action: { id: 'relationship:1' } }, world, []), '?flow=commands/scan')
  assert.equal(writeView({ ...rest, selectedId: 'observed:dev' }, world, []), '?person=dev')
})

test.concurrent('a selected relationship is carried as its source and target ids', () => {
  const state: ViewState = { selectedId: 'relationship:1', action: {}, tab: 'what', dark: false }
  assert.equal(writeView(state, world, []), '?relationship=commands/scan')
  assert.deepEqual(readView('?relationship=commands/scan', world, []), state)
  assert.equal(readView('?relationship=dev/scan', world, []).selectedId, undefined)
})

test.concurrent('a selected task is carried by its id while the work knows it', () => {
  const work: ActiveWorkItem[] = [{
    id: 'TASK-7', title: 'Change', status: 'In Progress', assignees: [], description: '', references: [], modifiedFiles: [], criteria: [],
  }]
  const state: ViewState = { selectedId: 'TASK-7', action: {}, tab: 'what', dark: false }
  assert.equal(writeView(state, world, work), '?task=TASK-7')
  assert.deepEqual(readView('?task=TASK-7', world, work), state)
  assert.equal(readView('?task=TASK-7', world, []).selectedId, undefined)
})

test.concurrent('unknown ids, kinds and values are ignored', () => {
  assert.equal(readView('?person=scan', world, []).selectedId, undefined)
  assert.deepEqual(readView('?component=nope&flow=dev/scan&by=zed&tab=weird&theme=light', world, []), {
    selectedId: undefined,
    action: {},
    tab: 'what',
    dark: false,
  })
  assert.deepEqual(readView('?flow=commands/scan&by=nobody', world, []).action, { id: 'relationship:1', personId: undefined })
})
