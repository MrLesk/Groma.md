import assert from 'node:assert/strict'

import { test } from 'bun:test'

import {
  noSelection,
  primarySelection,
  retainSelection,
  selectArchitecture,
  selectedArchitecture,
  selectTask,
} from '../src/viewers/web/selection.ts'

test.concurrent('a plain architecture pick replaces the current selection', () => {
  const several = selectArchitecture(
    selectArchitecture(noSelection, 'observed:a', false),
    'relationship:0',
    true,
  )

  const selected = selectArchitecture(several, 'observed:b', false)

  assert.deepEqual(selected, { kind: 'architecture', ids: ['observed:b'] })
  assert.equal(primarySelection(selected), 'observed:b')
})

test.concurrent('additive architecture picks append and toggle in selection order', () => {
  let selected = selectArchitecture(noSelection, 'observed:a', true)
  selected = selectArchitecture(selected, 'relationship:0', true)
  selected = selectArchitecture(selected, 'observed:b', true)

  assert.deepEqual(selected, {
    kind: 'architecture',
    ids: ['observed:a', 'relationship:0', 'observed:b'],
  })
  assert.equal(primarySelection(selected), 'observed:b')

  selected = selectArchitecture(selected, 'observed:b', true)
  assert.equal(primarySelection(selected), 'relationship:0')
  selected = selectArchitecture(selected, 'observed:a', true)
  selected = selectArchitecture(selected, 'relationship:0', true)
  assert.deepEqual(selected, noSelection)
})

test.concurrent('task selection is separate from architecture selection', () => {
  const task = selectTask('TASK-7')
  assert.equal(primarySelection(task), 'TASK-7')
  assert.deepEqual(selectedArchitecture(task), [])

  const architecture = selectArchitecture(task, 'observed:a', true)
  assert.deepEqual(architecture, { kind: 'architecture', ids: ['observed:a'] })
  assert.deepEqual(selectedArchitecture(architecture), ['observed:a'])
  assert.equal(primarySelection(noSelection), undefined)
})

test.concurrent('live selection keeps known targets in their original order', () => {
  const selected = {
    kind: 'architecture' as const,
    ids: ['observed:a', 'relationship:0', 'observed:b'],
  }

  assert.deepEqual(retainSelection(selected, id => id !== 'relationship:0'), {
    kind: 'architecture',
    ids: ['observed:a', 'observed:b'],
  })
  assert.deepEqual(retainSelection(selected, () => false), noSelection)
  assert.deepEqual(retainSelection(selectTask('TASK-7'), () => false), noSelection)
})
