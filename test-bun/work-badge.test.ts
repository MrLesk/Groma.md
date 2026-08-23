import assert from 'node:assert/strict'

import { test } from 'bun:test'

import type { WorkPin } from '../src/work/pins.ts'
import { finishingWorkKeys } from '../src/viewers/web/work/badge.ts'

const pin = (key: string, terminal: boolean): WorkPin => ({
  key,
  assignee: null,
  taskId: key,
  title: key,
  status: terminal ? 'Done' : 'In Progress',
  terminal,
  done: terminal ? 1 : 0,
  total: 1,
  elementId: 'render',
  colour: '#000',
})

test.concurrent('an existing running badge finishes once when it becomes Done', () => {
  assert.deepEqual(finishingWorkKeys([pin('TASK-1', false)], [pin('TASK-1', true)]), new Set(['TASK-1']))
})

test.concurrent('initial and unchanged Done badges do not finish again', () => {
  assert.deepEqual(finishingWorkKeys([], [pin('TASK-1', true)]), new Set())
  assert.deepEqual(finishingWorkKeys([pin('TASK-1', true)], [pin('TASK-1', true)]), new Set())
})

test.concurrent('an update that stays outside Done does not finish a badge', () => {
  assert.deepEqual(finishingWorkKeys([pin('TASK-1', false)], [pin('TASK-1', false)]), new Set())
})
