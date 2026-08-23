import assert from 'node:assert/strict'

import { test } from 'bun:test'

import type { ActiveWorkItem } from '../src/types.ts'
import { PIN_COLOURS, monogram, pinsOf, touchedElements } from '../src/work-pins.ts'
import { box, worldOf } from './helpers.ts'

const unit = { x: 0, y: 0, width: 1, height: 1 }

const world = worldOf([
  box('shop', 'system', unit),
  box('api', 'container', unit, { parent: 'observed:shop', code: [{ scanner: 'ts', file: 'src/api.ts' }] }),
  box('vault', 'container', unit, { parent: 'observed:shop', code: [{ scanner: 'ts', file: 'src/vault.ts' }] }),
])

function item(id: string, extra: Partial<ActiveWorkItem> = {}): ActiveWorkItem {
  return {
    id,
    title: `Work ${id}`,
    status: 'In Progress',
    assignees: ['@codex'],
    description: '',
    references: ['api'],
    modifiedFiles: [],
    criteria: [{ text: 'a', checked: true }, { text: 'b', checked: false }, { text: 'c', checked: false }],
    ...extra,
  }
}

test.concurrent('a pin stands on the element holding the last modified file, else on the first referenced element', () => {
  const pins = pinsOf([
    item('TASK-2', { references: ['api'], modifiedFiles: ['src/api.ts', 'README.md', 'src/vault.ts'] }),
    item('TASK-3', { references: ['not-an-id', 'vault'] }),
    item('TASK-4', { references: ['nothing'], modifiedFiles: ['docs/x.md'] }),
  ], world)
  assert.deepEqual(pins.map(pin => [pin.taskId, pin.elementId]), [
    ['TASK-2', 'observed:vault'],
    ['TASK-3', 'observed:vault'],
  ])
})

test.concurrent('a task touches the elements of its modified files, newest first, then the ones it references, each once', () => {
  const touched = touchedElements(item('TASK-5', { references: ['api', 'not-an-id'], modifiedFiles: ['src/api.ts', 'README.md', 'src/vault.ts'] }), world)
  assert.deepEqual(touched, ['observed:vault', 'observed:api'])
})

test.concurrent('every assignee and task pair gets its own colour in task order, with its progress from the criteria and its monogram', () => {
  const pins = pinsOf([
    item('TASK-10', { assignees: ['@luna'], status: 'Done', criteria: Array.from({ length: 4 }, () => ({ text: 'x', checked: true })) }),
    item('TASK-9', { assignees: ['@codex', '@claude'] }),
  ], world)
  assert.deepEqual(pins.map(pin => pin.key), ['@codex TASK-9', '@claude TASK-9', '@luna TASK-10'])
  assert.deepEqual(pins.map(pin => pin.colour), PIN_COLOURS.slice(0, 3))
  assert.deepEqual(pins.map(pin => [pin.done, pin.total, pin.status]), [[1, 3, 'In Progress'], [1, 3, 'In Progress'], [4, 4, 'Done']])
  assert.deepEqual(pins.map(pin => monogram(pin.assignee)), ['CO', 'CL', 'LU'])
})
