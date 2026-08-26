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
} from '../src/work/backlog.ts'
import type { WorkItem, WorkSnapshot } from '../src/types.ts'
import { startTerminalViewer } from '../src/view-host.ts'
import { projectWorld } from '../src/viewers/tui/projection.ts'
import {
  initialWorkFocus,
  moveWorkFocus,
  projectWork,
  reconcileWorkFocus,
  selectedWorkId,
  workView,
  workGroups,
} from '../src/viewers/tui/work/model.ts'
import { mapViewportOf, navigationWorld, press, viewerFixtureRoot } from './helpers.ts'

const snapshot = (items: WorkItem[] = []): WorkSnapshot => ({
  statuses: ['To Do', 'In Progress', 'Done'],
  defaultStatus: 'To Do',
  items,
})

const beforeWork = {
  focus: 'architecture' as const,
  details: true,
  detailsScroll: 0,
}

test.concurrent('Work focus follows active, default, then terminal workflow groups', () => {
  const work = snapshot([
    { id: 'TASK-TODO', title: 'Todo', status: 'To Do', assignees: [], description: '', references: [], modifiedFiles: [], criteria: [] },
    { id: 'TASK-DONE', title: 'Done', status: 'Done', assignees: [], description: '', references: [], modifiedFiles: [], criteria: [] },
    { id: 'TASK-ACTIVE', title: 'Active', status: 'In Progress', assignees: [], description: '', references: [], modifiedFiles: [], criteria: [] },
  ])

  assert.deepEqual(workGroups(work).map(group => group.status), ['In Progress', 'To Do', 'Done'])
  const first = initialWorkFocus(work, beforeWork)
  assert.equal(selectedWorkId(first), 'TASK-ACTIVE')
  assert.equal(selectedWorkId(moveWorkFocus(work, first, 1)), 'TASK-TODO')
})

test.concurrent('Work projection shares modified-file and reference touch meaning with the web', () => {
  const base = navigationWorld()
  const model = {
    ...base,
    elements: base.elements.map(element => element.id === 'cleft'
      ? { ...element, code: [{ file: 'src/cleft.ts', scanner: 'fixture' }] }
      : element),
    work: snapshot([{
      id: 'TASK-1',
      title: 'Change two containers',
      status: 'In Progress',
        assignees: ['@codex'],
      description: '',
      references: ['cright'],
      modifiedFiles: ['src/cleft.ts'],
      criteria: [],
    }]),
  }
  const projection = projectWorld(model, {
    viewport: mapViewportOf({ width: 120, height: 36 }),
    currentId: 'observed:alpha',
  })
  const geometry = {
    items: projection.items.map(item => [item.key, item.cellBounds]),
    routes: projection.relationships.map(route => route.cellRoute),
  }
  const work = projectWork(model, projection, {
    selection: { state: 'selected', taskId: 'TASK-1' },
    before: beforeWork,
  })

  assert.deepEqual(projectWork(model, projection, undefined), {
    anchors: [{ elementId: 'observed:cleft', count: 1, active: false }],
    touched: new Set(),
  })
  assert.deepEqual([...work.touched].sort(), ['observed:cleft', 'observed:cright'])
  assert.deepEqual(work.anchors, [{ elementId: 'observed:cleft', count: 1, active: true }])
  assert.deepEqual({
    items: projection.items.map(item => [item.key, item.cellBounds]),
    routes: projection.relationships.map(route => route.cellRoute),
  }, geometry)
})

test.concurrent('Work chooses component scope for one container and root for several', () => {
  const base = navigationWorld()
  const model = {
    ...base,
    work: snapshot([
      { id: 'TASK-LOCAL', title: 'Local', status: 'In Progress', assignees: [], description: '', references: ['pleft', 'pmid'], modifiedFiles: [], criteria: [] },
      { id: 'TASK-CROSS', title: 'Cross', status: 'In Progress', assignees: [], description: '', references: ['pleft', 'pright'], modifiedFiles: [], criteria: [] },
    ]),
  }
  const focus = (taskId: string) => ({
    selection: { state: 'selected' as const, taskId },
    before: beforeWork,
  })

  assert.deepEqual(workView(model, focus('TASK-LOCAL')), {
    level: 'components',
    currentId: 'observed:pleft',
    attentionIds: ['observed:pleft', 'observed:pmid'],
  })
  assert.deepEqual(workView(model, focus('TASK-CROSS')), {
    level: 'context',
    currentId: 'observed:pleft',
    attentionIds: ['observed:pleft', 'observed:pright'],
  })
})

test.concurrent('Work refresh preserves a valid task, initializes delayed work, and clears a removed task', () => {
  const work = snapshot([{
    id: 'TASK-1', title: 'Live', status: 'In Progress', assignees: [], description: '', references: [], modifiedFiles: [], criteria: [],
  }])

  const waiting = initialWorkFocus(undefined, beforeWork)
  const selected = reconcileWorkFocus(work, waiting)!
  assert.equal(selectedWorkId(selected), 'TASK-1')
  assert.equal(reconcileWorkFocus(work, selected), selected)

  const cleared = reconcileWorkFocus(snapshot(), selected)!
  assert.equal(cleared.selection.state, 'cleared')
  assert.equal(reconcileWorkFocus(snapshot(), cleared), cleared)
})

test.concurrent('Backlog plugin reads configured nonterminal work and only recent terminal work', async () => {
  const calls: string[][] = []
  const now = Date.parse('2026-08-23T12:00:00Z')
  const run: BacklogCommand = async arguments_ => {
    calls.push(arguments_)
    if (arguments_[0] === 'config') {
      return arguments_[2] === 'statuses' ? 'To Do, In Progress, Review, Done\n' : 'To Do\n'
    }
    if (arguments_[1] === 'list') {
      return JSON.stringify({ tasks: [
        { id: 'TASK-1', status: 'In Progress', updatedAt: '2026-08-20T12:00:00Z' },
        { id: 'TASK-2', status: 'Done', updatedAt: '2026-08-23T01:00:00Z' },
        { id: 'TASK-3', status: 'Done', updatedAt: '2026-08-21T12:00:00Z' },
        { id: 'TASK-4', status: 'To Do', updatedAt: '2026-08-23T11:00:00Z' },
        { id: 'TASK-5', status: 'Review', updatedAt: null },
      ] })
    }
    const id = arguments_[2]!
    const status = { 'TASK-2': 'Done', 'TASK-4': 'To Do', 'TASK-5': 'Review' }[id] ?? 'In Progress'
    return JSON.stringify({
      task: {
        id,
        title: `Change ${id}`,
        status,
        assignees: ['@codex'],
        description: id === 'TASK-2' ? null : 'Why it matters',
        references: ['shop', 'https://example.com'],
        modifiedFiles: ['src/shop.ts'],
        acceptanceCriteria: [{ index: 1, text: 'one', checked: true }, { index: 2, text: 'two', checked: false }],
      },
    })
  }

  const work = await createBacklogPlugin('/repo', run, () => now).read()

  assert.deepEqual(calls, [
    ['task', 'list', '--json'],
    ['config', 'get', 'statuses'],
    ['config', 'get', 'defaultStatus'],
    ['task', 'view', 'TASK-1', '--json'],
    ['task', 'view', 'TASK-2', '--json'],
    ['task', 'view', 'TASK-4', '--json'],
    ['task', 'view', 'TASK-5', '--json'],
  ])
  const criteria = [{ text: 'one', checked: true }, { text: 'two', checked: false }]
  assert.deepEqual(work.statuses, ['To Do', 'In Progress', 'Review', 'Done'])
  assert.equal(work.defaultStatus, 'To Do')
  assert.deepEqual(work.items.map(item => [item.id, item.status, item.description, item.criteria, item.modifiedFiles]), [
    ['TASK-1', 'In Progress', 'Why it matters', criteria, ['src/shop.ts']],
    ['TASK-2', 'Done', '', criteria, ['src/shop.ts']],
    ['TASK-4', 'To Do', 'Why it matters', criteria, ['src/shop.ts']],
    ['TASK-5', 'Review', 'Why it matters', criteria, ['src/shop.ts']],
  ])
  assert.deepEqual(work.items[0]!.references, ['shop', 'https://example.com'])
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
  let items: WorkItem[] = []
  let changed = () => {}
  const workSource: WorkSource = {
    read: async () => snapshot(items),
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
      description: '',
      references: ['shop'],
      modifiedFiles: [],
      criteria: [{ text: 'Shown', checked: false }],
    }]
    changed()
    await press(setup, 'w')
    const deadline = Date.now() + 3000
    while (!setup.captureCharFrame().includes('TASK-LIVE') && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 25))
      await setup.renderOnce()
    }
    const frame = setup.captureCharFrame()
    assert.match(frame, /TASK-LIVE/)
    assert.match(frame, /Acceptance criteria/)
  } finally {
    viewer.destroy()
    if (!setup.renderer.isDestroyed) setup.renderer.destroy()
  }
})
