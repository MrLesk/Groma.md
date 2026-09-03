import assert from 'node:assert/strict'

import { test } from 'bun:test'

import {
  preservedWorkStatuses,
  toggleWorkStatus,
  workStatusFilters,
} from '../src/work/status-filter.ts'

const statuses = ['To Do', 'In Progress', 'Done']

test.concurrent('only statuses with pins become filters while the default selection follows the workflow', () => {
  const empty = workStatusFilters(statuses, 'To Do', [])
  assert.deepEqual(empty, { available: [], enabled: ['In Progress'] })

  const arrived = workStatusFilters(statuses, 'To Do', ['Done', 'In Progress', 'To Do'], empty.enabled)
  assert.deepEqual(arrived, {
    available: ['To Do', 'In Progress', 'Done'],
    enabled: ['In Progress'],
  })
})

test.concurrent('an unconfigured cold start cannot become an empty user filter choice', () => {
  const boot = workStatusFilters([], '', [])
  const arrived = workStatusFilters(
    statuses,
    'To Do',
    ['In Progress'],
    preservedWorkStatuses([], boot.enabled),
  )

  assert.deepEqual(arrived, { available: ['In Progress'], enabled: ['In Progress'] })
})

test.concurrent('custom intermediate statuses start enabled when their first pin arrives', () => {
  const configured = ['To Do', 'In Progress', 'Review', 'Done']
  const empty = workStatusFilters(configured, 'To Do', [])
  const arrived = workStatusFilters(configured, 'To Do', ['Review'], empty.enabled)

  assert.deepEqual(arrived, {
    available: ['Review'],
    enabled: ['In Progress', 'Review'],
  })
})

test.concurrent('a filter choice survives an empty snapshot and a later pin', () => {
  const initial = workStatusFilters(statuses, 'To Do', ['In Progress'])
  const disabled = toggleWorkStatus(initial, 'In Progress')
  const empty = workStatusFilters(statuses, 'To Do', [], disabled.enabled)
  const returned = workStatusFilters(statuses, 'To Do', ['In Progress'], empty.enabled)

  assert.deepEqual(returned, { available: ['In Progress'], enabled: [] })
})
