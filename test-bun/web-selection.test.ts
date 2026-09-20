import assert from 'node:assert/strict'
import path from 'node:path'
import { loadAnnotatedArchitecture } from '../src/core.ts'

import { test } from 'bun:test'

import {
  noSelection,
  ownsDetails,
  primarySelection,
  retainSelection,
  selectArchitecture,
  selectMapArchitecture,
  selectedArchitecture,
  selectTask,
} from '../src/viewers/web/selection.ts'

test.concurrent('a system map click clears a selected component before a second click selects the system', async () => {
  const world = await loadAnnotatedArchitecture(path.resolve(import.meta.dir, '../test/fixtures/relationship-pairs'))
  const component = world.elements.find(element => element.kind === 'component')!
  const system = world.elements.find(element => element.kind === 'system' && !element.external)!
  const selected = selectArchitecture(noSelection, component.representationId, false)

  const cleared = selectMapArchitecture(selected, system.representationId, false, world)
  assert.deepEqual(cleared, noSelection)
  assert.equal(ownsDetails(cleared), false)
  assert.deepEqual(selectMapArchitecture(cleared, system.representationId, false, world),
    { kind: 'architecture', ids: [system.representationId] })
  assert.deepEqual(selectMapArchitecture(selected, system.representationId, true, world),
    { kind: 'architecture', ids: [component.representationId, system.representationId] })
  assert.deepEqual(selectArchitecture(selected, system.representationId, false),
    { kind: 'architecture', ids: [system.representationId] })
})

test.concurrent('every concrete selection owns details and the empty selection does not', () => {
  assert.equal(ownsDetails(noSelection), false)
  assert.equal(ownsDetails(selectArchitecture(noSelection, 'observed:a', false)), true)
  assert.equal(ownsDetails(selectTask('TASK-7')), true)
})

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
