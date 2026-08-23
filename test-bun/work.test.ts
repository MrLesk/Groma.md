import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'

import { normalizeTerminalPalette } from '@opentui/core'
import { createTestRenderer } from '@opentui/core/testing'

import {
  createBacklogPlugin,
  type BacklogCommand,
  type WorkSource,
} from '../src/backlog-plugin.ts'
import { loadArchitectureViewModel } from '../src/core.ts'
import type { ActiveWorkItem } from '../src/types.ts'
import { startTerminalViewer } from '../src/view-host.ts'
import { assigneesOnElement, projectActiveWork } from '../src/work-projection.ts'
import { viewerFixtureRoot } from './helpers.ts'

test.concurrent('active work projects only exact architecture ID references', async () => {
  const model = await loadArchitectureViewModel(viewerFixtureRoot)
  const done = { done: 0, total: 2 }
  const projected = projectActiveWork(model, [{
    id: 'TASK-1',
    title: 'Change Shop',
    status: 'In Progress',
    assignees: ['@codex'],
    references: ['shop', 'src/shop.ts', 'not-a-groma-id'],
    modifiedFiles: [],
    acceptance: done,
  }, {
    id: 'TASK-2',
    title: 'Finished',
    status: 'Done',
    assignees: ['@luna'],
    references: ['vault'],
    modifiedFiles: [],
    acceptance: done,
  }])

  assert.deepEqual(projected.work, [{
    elementId: 'shop',
    taskId: 'TASK-1',
    taskTitle: 'Change Shop',
    assignees: ['@codex'],
  }])
})

test.concurrent('two tasks on one element keep every unique assignee', () => {
  const names = assigneesOnElement(
    [
      {
        elementId: 'shop',
        taskId: 'TASK-1',
        taskTitle: 'Names',
        assignees: ['@grok', '@codex'],
      },
      {
        elementId: 'shop',
        taskId: 'TASK-2',
        taskTitle: 'Host',
        assignees: ['@codex', '@luna'],
      },
      {
        elementId: 'vault',
        taskId: 'TASK-3',
        taskTitle: 'Other',
        assignees: ['@scan'],
      },
    ],
    'shop',
  )
  assert.deepEqual(names, ['@grok', '@codex', '@luna'])
})

test.concurrent('Backlog plugin reads the tasks in progress and those done in the last day, with their progress and files', async () => {
  const calls: string[][] = []
  const now = Date.parse('2026-08-23T12:00:00Z')
  const run: BacklogCommand = async arguments_ => {
    calls.push(arguments_)
    if (arguments_[1] === 'list') {
      return JSON.stringify({ tasks: [
        { id: 'TASK-1', status: 'In Progress', updatedAt: '2026-08-20T12:00:00Z' },
        { id: 'TASK-2', status: 'Done', updatedAt: '2026-08-23T01:00:00Z' },
        { id: 'TASK-3', status: 'Done', updatedAt: '2026-08-21T12:00:00Z' },
        { id: 'TASK-4', status: 'To Do', updatedAt: '2026-08-23T11:00:00Z' },
      ] })
    }
    const id = arguments_[2]!
    return JSON.stringify({
      task: {
        id,
        title: `Change ${id}`,
        status: id === 'TASK-2' ? 'Done' : 'In Progress',
        assignees: ['@codex'],
        references: ['shop', 'https://example.com'],
        modifiedFiles: ['src/shop.ts'],
        acceptanceCriteria: [{ checked: true }, { checked: false }, { checked: true }],
      },
    })
  }

  const work = await createBacklogPlugin('/repo', run, () => now).read()

  assert.deepEqual(calls, [
    ['task', 'list', '--json'],
    ['task', 'view', 'TASK-1', '--json'],
    ['task', 'view', 'TASK-2', '--json'],
  ])
  assert.deepEqual(work.map(item => [item.id, item.status, item.acceptance, item.modifiedFiles]), [
    ['TASK-1', 'In Progress', { done: 2, total: 3 }, ['src/shop.ts']],
    ['TASK-2', 'Done', { done: 2, total: 3 }, ['src/shop.ts']],
  ])
  assert.deepEqual(work[0]!.references, ['shop', 'https://example.com'])
})

test.concurrent('Backlog plugin signals a task-directory change', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-backlog-watch-'))
  const tasks = path.join(root, 'backlog', 'tasks')
  await mkdir(tasks, { recursive: true })
  const plugin = createBacklogPlugin(root, async () => JSON.stringify({ tasks: [] }))
  let signal!: () => void
  const changed = new Promise<void>(resolve => {
    signal = resolve
  })
  const watcher = plugin.watch(signal)
  try {
    await writeFile(path.join(tasks, 'task-1.md'), 'changed')
    await Promise.race([
      changed,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timed out')), 3000)),
    ])
  } finally {
    watcher.close()
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('host opens the viewer without waiting for a Backlog read', async () => {
  let readStarted = false
  const workSource: WorkSource = {
    read: () => {
      readStarted = true
      return new Promise(() => {})
    },
    watch() {
      return { close() {} }
    },
  }
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const started = Date.now()
  const viewer = await startTerminalViewer(viewerFixtureRoot, {
    renderer: setup.renderer,
    palette: normalizeTerminalPalette(),
    workSource,
  })
  try {
    assert.ok(Date.now() - started < 2000)
    viewer.setView({ level: 'context', currentId: 'observed:shop' })
    await setup.renderOnce()
    assert.doesNotMatch(setup.captureCharFrame(), /TASK-HANG/)
    assert.equal(readStarted, true)
  } finally {
    viewer.destroy()
    if (!setup.renderer.isDestroyed) setup.renderer.destroy()
  }
})

test.concurrent('a failed Backlog read leaves architecture refresh working', async () => {
  let reads = 0
  const workSource: WorkSource = {
    read: async () => {
      reads += 1
      throw new Error('backlog unavailable')
    },
    watch() {
      return { close() {} }
    },
  }
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const viewer = await startTerminalViewer(viewerFixtureRoot, {
    renderer: setup.renderer,
    palette: normalizeTerminalPalette(),
    workSource,
  })
  try {
    viewer.setView({ level: 'context', currentId: 'observed:shop' })
    await setup.renderOnce()
    await new Promise(resolve => setTimeout(resolve, 20))
    const afterOpen = reads
    await viewer.refresh()
    await setup.renderOnce()
    assert.equal(reads, afterOpen)
    assert.doesNotMatch(setup.captureCharFrame(), /TASK-/)
  } finally {
    viewer.destroy()
    if (!setup.renderer.isDestroyed) setup.renderer.destroy()
  }
})

test.concurrent('host refreshes the viewer from a changed work snapshot', async () => {
  let items: ActiveWorkItem[] = []
  let changed = () => {}
  const workSource: WorkSource = {
    read: async () => items,
    watch(onChange) {
      changed = onChange
      return { close() {} }
    },
  }
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const viewer = await startTerminalViewer(viewerFixtureRoot, {
    renderer: setup.renderer,
    palette: normalizeTerminalPalette(),
    workSource,
  })
  try {
    viewer.setView({ level: 'context', currentId: 'observed:shop' })
    await setup.renderOnce()
    assert.doesNotMatch(setup.captureCharFrame(), /TASK-LIVE/)

    items = [{
      id: 'TASK-LIVE',
      title: 'Change Shop',
      status: 'In Progress',
        assignees: ['@codex'],
      references: ['shop'],
      modifiedFiles: [],
      acceptance: { done: 0, total: 1 },
    }]
    changed()
    const deadline = Date.now() + 3000
    while (!setup.captureCharFrame().includes('TASK-LIVE') && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 25))
      await setup.renderOnce()
    }
    assert.match(setup.captureCharFrame(), /TASK-LIVE/)
  } finally {
    viewer.destroy()
    if (!setup.renderer.isDestroyed) setup.renderer.destroy()
  }
})
