import assert from 'node:assert/strict'
import { test } from 'bun:test'

import type { WorkItem, WorkSnapshot } from '../src/types.ts'
import { initialState, reduceViewer, type ViewerState } from '../src/viewers/tui/navigation.ts'
import { projectWorld } from '../src/viewers/tui/projection.ts'
import {
  toggleShownStatus,
  initialWorkFocus,
  moveWorkFocus,
  projectWork,
  reconcileWorkFocus,
  selectedWorkId,
  workView,
  workGroups,
} from '../src/viewers/tui/work/model.ts'
import { mapViewportOf, navigationWorld } from './helpers.ts'

const snapshot = (items: WorkItem[] = []): WorkSnapshot => ({
  statuses: ['To Do', 'In Progress', 'Done'],
  defaultStatus: 'To Do',
  items,
})

const item = (id: string, extra: Partial<WorkItem> = {}): WorkItem => ({
  id,
  title: id,
  status: 'In Progress',
  assignees: [],
  references: [],
  modifiedFiles: [],
  acceptanceCriteriaCompleted: 0,
  acceptanceCriteriaCount: 0,
  updatedAt: '2026-08-30T12:00:00Z',
  ...extra,
})

const beforeWork = () => ({
  focus: 'architecture' as const,
  panes: { hierarchy: true, details: true },
  detailsScroll: 0,
})

test.concurrent('Work orders default, active and terminal groups while selecting an expanded active task', () => {
  const work = snapshot([
    item('TASK-TODO', { title: 'Todo', status: 'To Do' }),
    item('TASK-DONE', { title: 'Done', status: 'Done' }),
    item('TASK-ACTIVE', { title: 'Active' }),
  ])

  assert.deepEqual(workGroups(work).map(group => group.status), ['To Do', 'In Progress', 'Done'])
  const model = { ...navigationWorld(), work }
  const first = initialWorkFocus(work, beforeWork())
  assert.equal(selectedWorkId(first), 'TASK-ACTIVE')
  // Down reaches Done, whose tasks start folded.
  const header = moveWorkFocus(model, first, 1)
  assert.deepEqual(header.selection, { state: 'status', status: 'Done' })
  assert.deepEqual(moveWorkFocus(model, header, 1).selection, header.selection)
})

test.concurrent('Work projection shares modified-file and reference touch meaning with the web', () => {
  const base = navigationWorld()
  const model = {
    ...base,
    elements: base.elements.map(element => element.id === 'cleft'
      ? { ...element, code: [{ file: 'src/cleft.ts', scanner: 'fixture' }] }
      : element),
    work: snapshot([item('TASK-1', {
      title: 'Change two containers',
      assignees: ['@codex'],
      references: ['cright'],
      modifiedFiles: ['src/cleft.ts'],
    })]),
  }
  const projection = projectWorld(model, {
    viewport: mapViewportOf({ width: 120, height: 36 }),
    currentId: 'observed:alpha',
  })
  const geometry = {
    items: projection.items.map(item => [item.key, item.cellBounds]),
    routes: projection.relationships.map(route => route.cellRoute),
  }
  const work = projectWork(model, projection, {
    selection: { state: 'selected', taskId: 'TASK-1' },
    before: beforeWork(),
    shown: ['In Progress'],
  })

  const corner = (elementId: string, selected: boolean) => ({ elementId, taskId: 'TASK-1', others: 0, stage: 'progress', selected })
  assert.deepEqual(projectWork(model, projection, undefined), {
    corners: [corner('observed:cleft', false), corner('observed:cright', false)],
    touched: new Set(),
  })
  assert.deepEqual([...work.touched].sort(), ['observed:cleft', 'observed:cright'])
  assert.deepEqual(work.corners, [corner('observed:cleft', true), corner('observed:cright', true)])
  assert.deepEqual({
    items: projection.items.map(item => [item.key, item.cellBounds]),
    routes: projection.relationships.map(route => route.cellRoute),
  }, geometry)
})

test.concurrent('Work chooses component scope for one container and root for several', () => {
  const base = navigationWorld()
  const model = {
    ...base,
    work: snapshot([
      item('TASK-LOCAL', { title: 'Local', references: ['pleft', 'pmid'] }),
      item('TASK-CROSS', { title: 'Cross', references: ['pleft', 'pright'] }),
    ]),
  }
  const focus = (taskId: string) => ({
    selection: { state: 'selected' as const, taskId },
    before: beforeWork(),
    shown: [] as string[],
  })

  assert.deepEqual(workView(model, focus('TASK-LOCAL')), {
    level: 'components',
    currentId: 'observed:pleft',
    attentionIds: ['observed:pleft', 'observed:pmid'],
  })
  assert.deepEqual(workView(model, focus('TASK-CROSS')), {
    level: 'context',
    currentId: 'observed:pleft',
    attentionIds: ['observed:pleft', 'observed:pright'],
  })
})

test.concurrent('Work refresh preserves a valid task, initializes delayed work, and clears a removed task', () => {
  const work = snapshot([item('TASK-1', { title: 'Live' })])

  const waiting = initialWorkFocus(undefined, beforeWork())
  const selected = reconcileWorkFocus(work, waiting)!
  assert.equal(selectedWorkId(selected), 'TASK-1')
  assert.equal(reconcileWorkFocus(work, selected), selected)

  const cleared = reconcileWorkFocus(snapshot(), selected)!
  assert.equal(cleared.selection.state, 'cleared')
  assert.equal(reconcileWorkFocus(snapshot(), cleared), cleared)
})

test.concurrent('at root a component task stands on its container row and never on the island', () => {
  const model = { ...navigationWorld(), work: snapshot([item('TASK-DEEP', { title: 'Deep', references: ['pleft'] })]) }
  const corners = projectWork(model, projectWorld(model, { viewport: mapViewportOf({ width: 120, height: 36 }), currentId: 'observed:alpha' }), undefined).corners
  assert.deepEqual(corners.map(corner => corner.elementId), ['observed:cleft'])
})

test.concurrent('status toggles start without the default and final statuses and flip one status without moving the map', () => {
  const work = snapshot([
    item('TASK-ACTIVE', { title: 'Active', references: ['cleft'] }),
    item('TASK-DONE', { title: 'Done', status: 'Done', references: ['cright'] }),
  ])
  const model = { ...navigationWorld(), work }
  const first = initialWorkFocus(work, beforeWork())
  assert.deepEqual(first.shown, ['In Progress'])
  assert.deepEqual(toggleShownStatus(first, 'Done').shown, ['In Progress', 'Done'])
  assert.deepEqual(toggleShownStatus(toggleShownStatus(first, 'Done'), 'Done').shown, ['In Progress'])

  let state = reduceViewer(model, initialState(model), 'toggle-work')
  state = reduceViewer(model, state, 'down')
  assert.deepEqual(state.work?.selection, { state: 'status', status: 'Done' })
  const folded = reduceViewer(model, state, 'enter')
  assert.deepEqual(folded.work?.shown, ['In Progress'])
  assert.ok(folded.work?.expanded?.includes('Done'))
  const toggled = reduceViewer(model, folded, 'toggle-selection')
  assert.deepEqual(toggled.work?.shown, ['In Progress', 'Done'])
  assert.deepEqual([toggled.level, toggled.currentId, toggled.work?.selection], [state.level, state.currentId, state.work?.selection])
})

test.concurrent('the component Tasks tab walks related tasks and Enter opens the record', () => {
  const model = { ...navigationWorld(), work: snapshot([item('TASK-HERE', { title: 'Here', references: ['pmid'], acceptanceCriteriaCompleted: 1, acceptanceCriteriaCount: 3 })]) }
  let state: ViewerState = { ...initialState(model), currentId: 'observed:pmid', level: 'components', focus: 'details', detailsTab: 'tasks' }
  state = reduceViewer(model, state, 'down')
  state = reduceViewer(model, state, 'down')
  assert.equal(state.actionCursor, 'TASK-HERE')
  state = reduceViewer(model, state, 'enter')
  assert.deepEqual(state.taskRecord, { id: 'TASK-HERE', row: 0 })
  assert.equal(reduceViewer(model, state, 'dismiss').taskRecord, undefined)
})
