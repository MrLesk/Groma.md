import assert from 'node:assert/strict'

import { test } from 'bun:test'

import { openWorkSelection, toggleWorkSelection } from '../src/viewers/web/work/selection.ts'

test.concurrent('opening a task twice keeps it selected without duplicating or losing active work', () => {
  const active = ['TASK-1']
  const opened = openWorkSelection(active, 'TASK-2')
  assert.deepEqual(openWorkSelection(opened.active, 'TASK-2'), opened)
  assert.deepEqual(openWorkSelection(opened.active, 'TASK-1'), {
    active: ['TASK-1', 'TASK-2'], selected: 'TASK-1',
  })
  assert.deepEqual(active, ['TASK-1'])
})

test.concurrent('an inactive task becomes active and selected', () => {
  assert.deepEqual(toggleWorkSelection(['TASK-1'], 'TASK-1', 'TASK-2'), {
    active: ['TASK-1', 'TASK-2'],
    selected: 'TASK-2',
  })
})

test.concurrent('an active task becomes selected without losing any highlight', () => {
  assert.deepEqual(toggleWorkSelection(['TASK-1', 'TASK-2'], 'TASK-2', 'TASK-1'), {
    active: ['TASK-1', 'TASK-2'],
    selected: 'TASK-1',
  })
})

test.concurrent('the selected task deactivates and falls back to the latest remaining task', () => {
  assert.deepEqual(toggleWorkSelection(['TASK-1', 'TASK-2'], 'TASK-2', 'TASK-2'), {
    active: ['TASK-1'],
    selected: 'TASK-1',
  })
  assert.deepEqual(toggleWorkSelection(['TASK-1'], 'TASK-1', 'TASK-1'), {
    active: [],
    selected: undefined,
  })
})
