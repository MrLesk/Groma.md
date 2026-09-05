import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { test } from 'bun:test'
import type { WorkItem } from '@groma/work-source'

import { loadAnnotatedArchitecture } from '../src/core.ts'
import { createArchitectureSearch } from '../src/search.ts'
import { opensWebSearch } from '../src/viewers/web/search/control.ts'
import { createWebSearch } from '../src/viewers/web/search/model.ts'

const fixtureRoot = fileURLToPath(new URL('../test/fixtures/validate/', import.meta.url))

function task(id: string, title: string, status = 'In Progress'): WorkItem {
  return {
    id, title, status, assignees: [], references: [], modifiedFiles: [],
    acceptanceCriteriaCount: 0, acceptanceCriteriaCompleted: 0, updatedAt: '',
  }
}

function key(
  value: string,
  modifiers: Partial<{ altKey: boolean, ctrlKey: boolean, metaKey: boolean }> = {},
) {
  return {
    key: value,
    altKey: modifiers.altKey ?? false,
    ctrlKey: modifiers.ctrlKey ?? false,
    metaKey: modifiers.metaKey ?? false,
  }
}

test.concurrent('web search opens from slash only outside editable controls', () => {
  assert.equal(opensWebSearch(key('/'), false, false), true)
  assert.equal(opensWebSearch(key('/'), true, false), false)
  assert.equal(opensWebSearch(key('/', { ctrlKey: true }), false, false), false)
})

test.concurrent('web search opens from the platform command shortcut', () => {
  assert.equal(opensWebSearch(key('k', { metaKey: true }), true, true), true)
  assert.equal(opensWebSearch(key('k', { ctrlKey: true }), true, true), false)
  assert.equal(opensWebSearch(key('K', { ctrlKey: true }), true, false), true)
  assert.equal(opensWebSearch(key('K', { metaKey: true }), true, false), false)
  assert.equal(opensWebSearch(key('k', { altKey: true, ctrlKey: true }), false, false), false)
})

test.concurrent('web search merges architecture and plugin tasks by match relevance', async () => {
  const world = await loadAnnotatedArchitecture(fixtureRoot)
  const element = world.elements.find(item => item.kind === 'component')!
  const search = createWebSearch(world.elements, [
    task('OPS-17', `${element.title} dispatch`),
    task('OPS-170', 'Archive completed work'),
  ])
  const exact = search.find('OPS-17')[0]!
  assert.equal(exact.kind, 'task')
  if (exact.kind === 'task') assert.equal(exact.task.id, 'OPS-17')
  const mixed = search.find(element.title)
  assert.equal(mixed[0]?.kind, 'architecture')
  assert.ok(mixed.some(result => result.kind === 'task' && result.task.id === 'OPS-17'))
  assert.ok(mixed.every((result, index) => index === 0 || mixed[index - 1]!.score <= result.score))
})

test.concurrent('task matches include unmapped work in every plugin status', () => {
  const items = ['Queued', 'Doing', 'Finished'].map((status, index) => task(`OPS-${index}`, 'Shipping', status))
  const search = createWebSearch([], items)
  const matches = search.find('shiping')
  assert.deepEqual(matches.map(result => result.kind === 'task' && result.task.status), ['Queued', 'Doing', 'Finished'])
  assert.deepEqual(search.find('   '), [])
})

test.concurrent('missing optional work leaves core architecture results unchanged', async () => {
  const world = await loadAnnotatedArchitecture(fixtureRoot)
  const query = world.elements.find(element => element.kind === 'component')!.title
  const expected = createArchitectureSearch(world.elements).find(query)
  const actual = createWebSearch(world.elements, []).find(query)
  assert.deepEqual(actual, expected.map(result => ({ kind: 'architecture', ...result })))
})

test.concurrent('work updates replace task matches without changing architecture results', async () => {
  const world = await loadAnnotatedArchitecture(fixtureRoot)
  const query = world.elements.find(element => element.kind === 'component')!.title
  const search = createWebSearch(world.elements, [task('OPS-1', 'Shipping')])
  const architecture = search.find(query).filter(result => result.kind === 'architecture')
  search.updateTasks([task('OPS-2', 'Shipping')])
  assert.deepEqual(search.find('Shipping').map(result => result.kind === 'task' && result.task.id), ['OPS-2'])
  search.updateTasks([])
  assert.deepEqual(search.find('Shipping'), [])
  assert.deepEqual(search.find(query), architecture)
})
