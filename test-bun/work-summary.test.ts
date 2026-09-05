import assert from 'node:assert/strict'
import { test } from 'bun:test'
import type { WorkItem, WorkSnapshot } from '../src/types.ts'
import { pinsOf } from '../src/work/pins.ts'
import { latestWorkChange, summarizeWork } from '../src/viewers/web/work/summary.ts'
import { box, worldOf } from './helpers.ts'

function task(id: string, extra: Partial<WorkItem> = {}): WorkItem {
  return {
    id, title: id, status: 'In Progress', assignees: ['@one', '@two'], references: ['api'],
    modifiedFiles: [], acceptanceCriteriaCompleted: 0, acceptanceCriteriaCount: 2,
    updatedAt: '2026-09-05T12:00:00Z', ...extra,
  }
}

function summary(items: WorkItem[], enabled = ['In Progress']) {
  const work: WorkSnapshot = { items, statuses: ['To Do', 'In Progress', 'Done'], defaultStatus: 'To Do' }
  const world = worldOf([box('api', 'container', { x: 0, y: 0, width: 1, height: 1 })])
  return summarizeWork(pinsOf(items, world, 'Done'), work, enabled)
}

test.concurrent('the filtered count deduplicates assignee pins and excludes unmapped tasks', () => {
  const items = [task('1'), task('2', { assignees: [] }), task('3', { status: 'To Do' }), task('4', { references: [] })]
  assert.equal(summary(items).count, 2)
  assert.equal(summary(items, ['To Do']).count, 1)
  assert.equal(summary(items, ['In Progress', 'To Do']).count, 3)
  assert.equal(summary(items, []).count, 0)
  assert.deepEqual(summary(items).counts.map(row => row.count), [1, 2, 0])
})

test.concurrent('initial snapshots, unchanged repaints and filter changes do not invent task activity', () => {
  const initial = summary([task('1'), task('2', { status: 'Done' })])
  assert.equal(latestWorkChange(undefined, initial), undefined)
  assert.equal(latestWorkChange(initial, summary([task('1'), task('2', { status: 'Done' })])), undefined)
  assert.equal(latestWorkChange(initial, summary(initial.items, ['Done'])), undefined)
})

test.concurrent('progress and record updates announce once even when the count stays the same', () => {
  const initial = summary([task('1')])
  const progress = summary([task('1', { acceptanceCriteriaCompleted: 1 })])
  assert.equal(progress.count, initial.count)
  assert.equal(latestWorkChange(initial, progress)?.kind, 'updated')
  assert.equal(latestWorkChange(progress, progress), undefined)
  const notes = summary([task('1', { acceptanceCriteriaCompleted: 1, updatedAt: '2026-09-05T12:01:00Z' })])
  assert.equal(latestWorkChange(progress, notes)?.kind, 'updated')
})

test.concurrent('completion of shown work is announced before its count disappears under the filter', () => {
  const before = summary([task('1')])
  const after = summary([task('1', { status: 'Done' })])
  assert.equal(after.count, 0)
  assert.equal(latestWorkChange(before, after)?.kind, 'completed')
  assert.equal(latestWorkChange(after, after), undefined)
  assert.equal(latestWorkChange(summary([task('1', { status: 'To Do' })]), after), undefined)
})

test.concurrent('mapped arrivals and departures update the summary while hidden work stays quiet', () => {
  assert.equal(latestWorkChange(summary([]), summary([task('1')]))?.kind, 'added')
  assert.equal(latestWorkChange(summary([task('1')]), summary([]))?.kind, 'removed')
  const hidden = task('2', { status: 'To Do' })
  assert.equal(latestWorkChange(summary([]), summary([hidden])), undefined)
  assert.equal(latestWorkChange(summary([hidden]), summary([{ ...hidden, title: 'Changed' }])), undefined)
})

test.concurrent('a batch prioritizes completion and otherwise exposes its most recent task change', () => {
  const before = summary([task('1'), task('2')])
  const after = summary([task('1', { status: 'Done' }), task('2', { updatedAt: '2026-09-05T12:02:00Z' })])
  assert.equal(latestWorkChange(before, after)?.item.id, '1')
  const updates = summary([task('1', { title: 'Renamed' }), task('2', { updatedAt: '2026-09-05T12:02:00Z' })])
  assert.equal(latestWorkChange(before, updates)?.item.id, '2')
})
