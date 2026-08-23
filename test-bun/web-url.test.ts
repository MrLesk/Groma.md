import assert from 'node:assert/strict'

import { test } from 'bun:test'

import type { ArchitectureWorld, WorkItem } from '../src/types.ts'
import { noSelection, selectTask } from '../src/viewers/web/selection.ts'
import { readView, writeView } from '../src/viewers/web/url.ts'
import type { ViewState } from '../src/viewers/web/url.ts'
import { box, uses } from './helpers.ts'

const unit = { x: 0, y: 0, width: 1, height: 1 }

const world: ArchitectureWorld = {
  bounds: unit,
  groups: [],
  elements: [
    box('dev', 'actor', unit),
    box('tool', 'system', unit),
    box('cli', 'container', unit, { parent: 'observed:tool' }),
    box('commands', 'component', unit, { parent: 'observed:cli' }),
    box('scan', 'component', unit, { parent: 'observed:cli' }),
  ],
  relationships: [uses('relationship:0', 'dev', 'commands'), uses('relationship:1', 'commands', 'scan')],
}

const full: ViewState = {
  selection: { kind: 'architecture', ids: ['observed:tool', 'relationship:1', 'observed:scan'] },
  action: { id: 'relationship:1', actorId: 'observed:dev' },
  tab: 'how',
  dark: true,
}

test.concurrent('a view round-trips through the query string with authored ids', () => {
  const query = writeView(full, world, [])
  assert.equal(query, '?system=tool&relationship=commands/scan&component=scan&flow=commands/scan&by=dev&tab=how&theme=dark')
  assert.deepEqual(readView(query, world, []), full)
})

test.concurrent('defaults write nothing and read back as the default view', () => {
  const rest: ViewState = { selection: noSelection, action: {}, tab: 'what', dark: false }
  assert.equal(writeView(rest, world, []), '')
  assert.deepEqual(readView('', world, []), rest)
  assert.equal(writeView({ ...rest, action: { id: 'relationship:1' } }, world, []), '?flow=commands/scan')
  assert.equal(writeView({ ...rest, action: { id: 'relationship:1', actorId: 'observed:tool' } }, world, []), '?flow=commands/scan')
  assert.equal(writeView({ ...rest, selection: { kind: 'architecture', ids: ['observed:dev'] } }, world, []), '?actor=dev')
})

test.concurrent('a selected relationship is carried as its source and target ids', () => {
  const state: ViewState = { selection: { kind: 'architecture', ids: ['relationship:1'] }, action: {}, tab: 'what', dark: false }
  assert.equal(writeView(state, world, []), '?relationship=commands/scan')
  assert.deepEqual(readView('?relationship=commands/scan', world, []), state)
  assert.deepEqual(readView('?relationship=dev/scan', world, []).selection, noSelection)
})

test.concurrent('a selected task is carried by its id while the work knows it', () => {
  const work: WorkItem[] = [{
    id: 'TASK-7', title: 'Change', status: 'In Progress', assignees: [], description: '', references: [], modifiedFiles: [], criteria: [],
  }]
  const state: ViewState = { selection: selectTask('TASK-7'), action: {}, tab: 'what', dark: false }
  assert.equal(writeView(state, world, work), '?task=TASK-7')
  assert.deepEqual(readView('?task=TASK-7', world, work), state)
  assert.deepEqual(readView('?task=TASK-7', world, []).selection, noSelection)
})

test.concurrent('unknown ids, kinds and values are ignored', () => {
  assert.deepEqual(readView('?person=dev', world, []).selection, noSelection)
  assert.deepEqual(readView('?actor=scan', world, []).selection, noSelection)
  assert.deepEqual(readView('?component=nope&flow=dev/scan&by=zed&tab=weird&theme=light', world, []), {
    selection: noSelection,
    action: {},
    tab: 'what',
    dark: false,
  })
  assert.deepEqual(readView('?flow=commands/scan&by=nobody', world, []).action, { id: 'relationship:1', actorId: undefined })
  assert.deepEqual(readView('?flow=commands/scan&by=tool', world, []).action, { id: 'relationship:1', actorId: undefined })
})

test.concurrent('repeated architecture parameters restore one ordered selection and ignore unknown entries', () => {
  const state = readView(
    '?component=commands&relationship=dev/commands&system=nope&actor=dev&component=commands',
    world,
    [],
  )

  assert.deepEqual(state.selection, {
    kind: 'architecture',
    ids: ['observed:commands', 'relationship:0', 'observed:dev'],
  })
})
