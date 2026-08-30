import assert from 'node:assert/strict'

import { test } from 'bun:test'

import type { WorkItem, WorkSnapshot } from '../src/types.ts'
import { elementWorkGroups, PIN_COLOURS, monogram, pinsOf, touchedElements } from '../src/work/pins.ts'
import { box, worldOf } from './helpers.ts'

const unit = { x: 0, y: 0, width: 1, height: 1 }

const world = worldOf([
  box('shop', 'system', unit),
  box('api', 'container', unit, { parent: 'observed:shop', code: [{ scanner: 'ts', file: 'src/api.ts' }] }),
  box('vault', 'container', unit, { parent: 'observed:shop', code: [{ scanner: 'ts', file: 'src/vault.ts' }] }),
])

function item(id: string, extra: Partial<WorkItem> = {}): WorkItem {
  return {
    id,
    title: `Work ${id}`,
    status: 'In Progress',
    assignees: ['@codex'],
    references: ['api'],
    modifiedFiles: [],
    acceptanceCriteriaCompleted: 1,
    acceptanceCriteriaCount: 3,
    updatedAt: '2026-08-30T12:00:00Z',
    ...extra,
  }
}

test.concurrent('a pin stands on the element holding the last modified file, else on the first referenced element', () => {
  const pins = pinsOf([
    item('TASK-2', { references: ['api'], modifiedFiles: ['src/api.ts', 'README.md', 'src/vault.ts'] }),
    item('TASK-3', { references: ['not-an-id', 'vault'] }),
    item('TASK-4', { references: ['nothing'], modifiedFiles: ['docs/x.md'] }),
  ], world, 'Done')
  assert.deepEqual(pins.map(pin => [pin.taskId, pin.elementId]), [
    ['TASK-2', 'observed:vault'],
    ['TASK-3', 'observed:vault'],
  ])
})

test.concurrent('a task touches the elements of its modified files, newest first, then the ones it references, each once', () => {
  const touched = touchedElements(item('TASK-5', { references: ['api', 'not-an-id'], modifiedFiles: ['src/api.ts', 'README.md', 'src/vault.ts'] }), world)
  assert.deepEqual(touched, ['observed:vault', 'observed:api'])
})

test.concurrent('one modified file links every component that maps it', () => {
  const shared = worldOf([
    box('first', 'component', unit, { code: [{ scanner: 'ts', file: 'src/shared.ts' }] }),
    box('second', 'component', unit, { code: [{ scanner: 'ts', file: 'src/shared.ts' }] }),
  ])
  const task = item('TASK-6', { references: [], modifiedFiles: ['src/shared.ts'] })

  assert.deepEqual(touchedElements(task, shared), ['observed:first', 'observed:second'])
  assert.equal(elementWorkGroups({ statuses: ['To Do', 'In Progress', 'Done'], defaultStatus: 'To Do', items: [task] }, 'observed:first', shared).length, 1)
  assert.equal(elementWorkGroups({ statuses: ['To Do', 'In Progress', 'Done'], defaultStatus: 'To Do', items: [task] }, 'observed:second', shared).length, 1)
})

test.concurrent('an element receives default, intermediate, and terminal work groups only when tasks touch it', () => {
  const work: WorkSnapshot = {
    statuses: ['Ready', 'Building', 'Review', 'Shipped'],
    defaultStatus: 'Ready',
    items: [
      item('TASK-1', { status: 'Ready', references: ['api'] }),
      item('TASK-2', { status: 'Review', modifiedFiles: ['src/api.ts'], references: [] }),
      item('TASK-3', { status: 'Shipped', references: ['api'] }),
      item('TASK-4', { status: 'Building', references: ['vault'] }),
    ],
  }

  assert.deepEqual(elementWorkGroups(work, 'observed:api', world).map(group => [
    group.stage,
    group.items.map(task => task.id),
  ]), [
    ['todo', ['TASK-1']],
    ['progress', ['TASK-2']],
    ['done', ['TASK-3']],
  ])
  assert.deepEqual(elementWorkGroups(work, 'observed:shop', world), [])
})

test.concurrent('every assignee and task pair gets its own colour in task order, with its progress from the criteria and its monogram', () => {
  const pins = pinsOf([
    item('TASK-10', { assignees: ['@luna'], status: 'Done', acceptanceCriteriaCompleted: 4, acceptanceCriteriaCount: 4 }),
    item('TASK-9', { assignees: ['@codex', '@claude'] }),
  ], world, 'Done')
  assert.deepEqual(pins.map(pin => pin.key), ['@codex TASK-9', '@claude TASK-9', '@luna TASK-10'])
  assert.deepEqual(pins.map(pin => pin.colour), PIN_COLOURS.slice(0, 3))
  assert.deepEqual(pins.map(pin => [pin.done, pin.total, pin.status, pin.terminal]), [
    [1, 3, 'In Progress', false],
    [1, 3, 'In Progress', false],
    [4, 4, 'Done', true],
  ])
  assert.deepEqual(pins.map(pin => monogram(pin.assignee!)), ['CO', 'CL', 'LU'])
})

test.concurrent('an unassigned mapped task gets one generic task pin', () => {
  const pins = pinsOf([item('TASK-11', { assignees: [] })], world, 'Done')
  assert.deepEqual(pins.map(pin => [pin.key, pin.assignee, pin.taskId]), [['task TASK-11', null, 'TASK-11']])
})
