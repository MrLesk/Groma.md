import assert from 'node:assert/strict'
import { test } from 'bun:test'

import type { WorkSnapshot } from '../src/types.ts'
import { declarationStops } from '../src/viewers/tui/navigation-details.ts'
import { taskRecordView } from '../src/viewers/tui/panes/details.ts'
import { viewerTheme } from '../src/viewers/tui/atoms/theme.ts'
import { detailsContentWidth } from '../src/viewers/tui/layout.ts'

import { initialState, reduceViewer, type ViewerState } from '../src/viewers/tui/navigation.ts'
import { navigationWorld } from './helpers.ts'

const emptyRecord = { id: 'TASK-1', description: '', acceptanceCriteria: [], definitionOfDone: [], implementationPlan: '', implementationNotes: '', comments: [] }

function workWithModifiedFile(): WorkSnapshot {
  return {
    statuses: ['To Do', 'In Progress', 'Done'],
    defaultStatus: 'To Do',
    items: [{
      id: 'TASK-1',
      title: 'Change orders',
      status: 'In Progress',
      assignees: [],
      references: ['ann'],
      modifiedFiles: ['src/orders.ts'],
      acceptanceCriteriaCompleted: 0,
      acceptanceCriteriaCount: 1,
      updatedAt: '2026-09-03T12:00:00Z',
    }],
  }
}

test.concurrent('details declarations open source at their exact line and Escape returns', () => {
  const model = navigationWorld()
  let state: ViewerState = {
    ...initialState(model),
    currentId: 'observed:pleft',
    focus: 'details',
    detailsTab: 'how',
    codeStructure: {
      elementId: 'observed:pleft',
      files: [{
        file: 'src/orders.ts',
        declarations: [{
          kind: 'class',
          name: 'OrderBook',
          line: 5,
          scope: 'export',
          entry: true,
          members: [{ name: 'total', line: 6, scope: 'public', entry: false }],
        }],
      }],
    },
  }

  assert.deepEqual(declarationStops(state), ['src/orders.ts:5', 'src/orders.ts:6'])
  state = reduceViewer(model, state, 'down')
  assert.equal(state.actionCursor, 'src/orders.ts:5')
  state = reduceViewer(model, state, 'enter')
  assert.deepEqual(state.sourceView, { file: 'src/orders.ts', line: 5, returnScroll: 0 })
  assert.equal(state.detailsScroll, 2)
  state = reduceViewer(model, state, 'dismiss')
  assert.equal(state.sourceView, undefined)
  assert.equal(state.actionCursor, 'src/orders.ts:5')
  state = reduceViewer(model, state, 'down')
  for (let step = 0; step < 5; step++) state = reduceViewer(model, state, 'down')
  const before = state
  state = reduceViewer(model, state, 'enter')
  state = reduceViewer(model, state, 'down')
  state = reduceViewer(model, state, 'dismiss')
  assert.equal(state.detailsScroll, before.detailsScroll)
  assert.equal(state.actionCursor, before.actionCursor)
  assert.equal(detailsContentWidth(state), detailsContentWidth(before))
})

test.concurrent('a task modified file opens its diff and Escape returns to the record', () => {
  const work = workWithModifiedFile()
  const model = { ...navigationWorld(), work }
  let state: ViewerState = {
    ...initialState(model),
    currentId: 'observed:ann',
    focus: 'details',
    taskRecord: { id: 'TASK-1', row: 0, details: emptyRecord },
  }

  const fileRow = taskRecordView(viewerTheme(), work.items[0]!, emptyRecord, detailsContentWidth(state), undefined).ids!.indexOf('src/orders.ts')
  for (let count = 0; count < fileRow; count++) state = reduceViewer(model, state, 'down')
  const readingRow = state.taskRecord!.row
  state = reduceViewer(model, state, 'enter')
  assert.deepEqual(state.diffView, { file: 'src/orders.ts' })
  state = reduceViewer(model, state, 'dismiss')
  assert.equal(state.diffView, undefined)
  assert.deepEqual(state.taskRecord, { id: 'TASK-1', row: readingRow, details: emptyRecord })
})
