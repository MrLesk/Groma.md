import assert from 'node:assert/strict'

import { test } from 'bun:test'

import { toggleWorkSelection } from '../src/viewers/web/work/selection.ts'

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
