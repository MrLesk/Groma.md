import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'

import { createTestRenderer } from '@opentui/core/testing'
import { EMPTY_WORK_SNAPSHOT } from '@groma/work-source'
import type { WorkSource } from '@groma/work-source'
import {
  createBacklogPlugin,
  createBacklogSource,
  type BacklogCommand,
} from '@groma/work-source-backlog'

import type { WorkItem, WorkSnapshot } from '../src/types.ts'
import { startTerminalViewer } from '../src/view-host.ts'
import { initialState, reduceViewer, type ViewerState } from '../src/viewers/tui/navigation.ts'
import { projectWorld } from '../src/viewers/tui/projection.ts'
import { mountTerminalViewer } from '../src/viewers/tui/terminal-viewer.ts'
import {
  toggleShownStatus,
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

const item = (id: string, extra: Partial<WorkItem> = {}): WorkItem => ({
  id,
  title: id,
  status: 'In Progress',
  assignees: [],
  references: [],
  modifiedFiles: [],
  acceptanceCriteriaCompleted: 0,
  acceptanceCriteriaCount: 0,
  updatedAt: '2026-08-30T12:00:00Z',
  ...extra,
})

const beforeWork = () => ({
  focus: 'architecture' as const,
  panes: { hierarchy: true, details: true },
  detailsScroll: 0,
})

test.concurrent('Work orders default, active and terminal groups while selecting an expanded active task', () => {
  const work = snapshot([
    item('TASK-TODO', { title: 'Todo', status: 'To Do' }),
    item('TASK-DONE', { title: 'Done', status: 'Done' }),
    item('TASK-ACTIVE', { title: 'Active' }),
  ])

  assert.deepEqual(workGroups(work).map(group => group.status), ['To Do', 'In Progress', 'Done'])
  const model = { ...navigationWorld(), work }
  const first = initialWorkFocus(work, beforeWork())
  assert.equal(selectedWorkId(first), 'TASK-ACTIVE')
  // Down reaches Done, whose tasks start folded.
  const header = moveWorkFocus(model, first, 1)
  assert.deepEqual(header.selection, { state: 'status', status: 'Done' })
  assert.deepEqual(moveWorkFocus(model, header, 1).selection, header.selection)
})

test.concurrent('Work projection shares modified-file and reference touch meaning with the web', () => {
  const base = navigationWorld()
  const model = {
    ...base,
    elements: base.elements.map(element => element.id === 'cleft'
      ? { ...element, code: [{ file: 'src/cleft.ts', scanner: 'fixture' }] }
      : element),
    work: snapshot([item('TASK-1', {
      title: 'Change two containers',
      assignees: ['@codex'],
      references: ['cright'],
      modifiedFiles: ['src/cleft.ts'],
    })]),
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
    before: beforeWork(),
    shown: ['In Progress'],
  })

  const corner = (elementId: string, selected: boolean) => ({ elementId, taskId: 'TASK-1', others: 0, stage: 'progress', selected })
  assert.deepEqual(projectWork(model, projection, undefined), {
    corners: [corner('observed:cleft', false), corner('observed:cright', false)],
    touched: new Set(),
  })
  assert.deepEqual([...work.touched].sort(), ['observed:cleft', 'observed:cright'])
  assert.deepEqual(work.corners, [corner('observed:cleft', true), corner('observed:cright', true)])
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
      item('TASK-LOCAL', { title: 'Local', references: ['pleft', 'pmid'] }),
      item('TASK-CROSS', { title: 'Cross', references: ['pleft', 'pright'] }),
    ]),
  }
  const focus = (taskId: string) => ({
    selection: { state: 'selected' as const, taskId },
    before: beforeWork(),
    shown: [] as string[],
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
  const work = snapshot([item('TASK-1', { title: 'Live' })])

  const waiting = initialWorkFocus(undefined, beforeWork())
  const selected = reconcileWorkFocus(work, waiting)!
  assert.equal(selectedWorkId(selected), 'TASK-1')
  assert.equal(reconcileWorkFocus(work, selected), selected)

  const cleared = reconcileWorkFocus(snapshot(), selected)!
  assert.equal(cleared.selection.state, 'cleared')
  assert.equal(reconcileWorkFocus(snapshot(), cleared), cleared)
})

test.concurrent('Backlog plugin reads CLI summaries once and selected details on demand', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-backlog-read-'))
  const tasks = path.join(root, 'backlog', 'tasks')
  await mkdir(tasks, { recursive: true })
  const calls: string[][] = []
  const summaries = ['In Progress', 'Done', 'To Do', 'Review'].map((status, index) => item(`TASK-${index + 1}`, {
    status, references: ['shop'], modifiedFiles: ['src/shop.ts'],
    acceptanceCriteriaCompleted: 1, acceptanceCriteriaCount: 2,
  }))
  const run: BacklogCommand = async (arguments_, repositoryRoot) => {
    assert.equal(repositoryRoot, root)
    calls.push(arguments_)
    if (arguments_.join(' ') === 'task list --json') {
      return JSON.stringify({ schemaVersion: 1, kind: 'task-list', tasks: summaries })
    }
    if (arguments_.join(' ') === 'config get statuses') return 'To Do, In Progress, Review, Done\n'
    if (arguments_.join(' ') === 'config get defaultStatus') return 'To Do\n'
    assert.deepEqual(arguments_, ['task', 'view', 'TASK-1', '--json'])
    return JSON.stringify({ schemaVersion: 1, kind: 'task-view', task: {
      id: 'TASK-1', description: 'Why it matters',
      acceptanceCriteria: [{ index: 1, text: 'one', checked: true }, { index: 2, text: 'two', checked: false }],
      definitionOfDone: [{ index: 1, text: 'verified', checked: false }],
      implementationPlan: 'First plan', implementationNotes: 'First note',
      comments: [
        { index: 1, body: 'Review this', createdAt: '2026-08-23T11:00:00Z', author: '@alex' },
        { index: 2, body: 'Recorded without an author', createdAt: '2026-08-23T12:00:00Z', author: null },
      ],
    } })
  }
  try {
    // This is explanatory Markdown, not a task. Task identity comes only from the CLI.
    await writeFile(path.join(tasks, 'README.md'), '# Task storage\n')
    const source = createBacklogSource(root, run)
    const work = await source.read()
    assert.deepEqual(calls, [
      ['task', 'list', '--json'],
      ['config', 'get', 'statuses'],
      ['config', 'get', 'defaultStatus'],
    ])
    assert.deepEqual(work.statuses, ['To Do', 'In Progress', 'Review', 'Done'])
    assert.equal(work.defaultStatus, 'To Do')
    assert.deepEqual(work.items, summaries)
    const details = await source.readItem('TASK-1')
    assert.equal(calls.length, 4)
    assert.deepEqual(details, {
      id: 'TASK-1', description: 'Why it matters',
      acceptanceCriteria: [{ text: 'one', checked: true }, { text: 'two', checked: false }],
      definitionOfDone: [{ text: 'verified', checked: false }],
      implementationPlan: 'First plan', implementationNotes: 'First note',
      comments: [
        { body: 'Review this', createdAt: '2026-08-23T11:00:00Z', author: '@alex' },
        { body: 'Recorded without an author', createdAt: '2026-08-23T12:00:00Z', author: '' },
      ],
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('Backlog nullable JSON fields keep the string-based work contract', async () => {
  const source = createBacklogSource('/repo', async args => {
    if (args[0] === 'config') return args[2] === 'statuses' ? 'To Do, Done' : 'To Do'
    if (args[1] === 'list') return JSON.stringify({ tasks: [{ ...item('TASK-1'), updatedAt: null }] })
    assert.deepEqual(args, ['task', 'view', 'TASK-1', '--json'])
    return JSON.stringify({ task: {
      id: 'TASK-1', description: null, implementationPlan: null, implementationNotes: null,
      acceptanceCriteria: [], definitionOfDone: [],
      comments: [{ body: 'Note', author: null, createdAt: null }],
    } })
  })
  assert.equal((await source.read()).items[0]!.updatedAt, '')
  assert.deepEqual(await source.readItem('TASK-1'), {
    id: 'TASK-1', description: '', implementationPlan: '', implementationNotes: '',
    acceptanceCriteria: [], definitionOfDone: [], comments: [{ body: 'Note', author: '', createdAt: '' }],
  })
})

test.concurrent('Backlog plugin signals a task-directory change', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-backlog-watch-'))
  const tasks = path.join(root, 'backlog', 'tasks')
  await mkdir(tasks, { recursive: true })
  const plugin = createBacklogSource(root, async () => JSON.stringify({ tasks: [] }))
  let signal!: () => void
  const changed = new Promise<void>(resolve => {
    signal = resolve
  })
  const watcher = plugin.watch(signal)
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    await new Promise(resolve => setTimeout(resolve, 50))
    await writeFile(path.join(tasks, 'task-1.md'), 'changed')
    await Promise.race([
      changed,
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('timed out')), 3000) }),
    ])
  } finally {
    clearTimeout(timeout)
    watcher.close()
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('Backlog plugin needs no watcher when the project has no Backlog tasks', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-no-backlog-'))
  try {
    createBacklogPlugin(() => null).create(root)
      .watch(() => assert.fail('unexpected work change')).close()
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('a missing Backlog command reports readiness and supplies empty work', async () => {
  const missing = createBacklogPlugin(() => null)
  const found = createBacklogPlugin(() => '/usr/local/bin/backlog')

  assert.equal(missing.readiness().status, 'missing')
  assert.deepEqual(found.readiness(), { status: 'found' })
  assert.deepEqual(await missing.create('/repo').read(), EMPTY_WORK_SNAPSHOT)

  const setup = await createTestRenderer({ width: 120, height: 36 })
  try {
    const viewer = await startTerminalViewer(viewerFixtureRoot, {
      renderer: setup.renderer,
      workSource: missing.create(viewerFixtureRoot),
    })
    viewer.destroy()
  } finally {
    if (!setup.renderer.isDestroyed) setup.renderer.destroy()
  }
})

test.concurrent('host opens the viewer without waiting for a Backlog read', async () => {
  let readStarted = false
  const workSource: WorkSource = {
    read: () => {
      readStarted = true
      return new Promise(() => {})
    },
    readItem: async () => assert.fail('unexpected task detail read'),
    watch() {
      return { close() {} }
    },
  }
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const viewer = await startTerminalViewer(viewerFixtureRoot, {
    renderer: setup.renderer,
    workSource,
  })
  try {
    viewer.setView({ level: 'context', currentId: 'shop' })
    await setup.renderOnce()
    assert.match(setup.captureCharFrame(), /Shop/)
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
    readItem: async () => assert.fail('unexpected task detail read'),
    watch() {
      return { close() {} }
    },
  }
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const viewer = await startTerminalViewer(viewerFixtureRoot, {
    renderer: setup.renderer,
    workSource,
  })
  try {
    viewer.setView({ level: 'context', currentId: 'shop' })
    await setup.renderOnce()
    assert.match(setup.captureCharFrame(), /Shop/)
    const afterOpen = reads
    await viewer.refresh()
    await setup.renderOnce()
    assert.equal(reads, afterOpen)
    assert.equal(afterOpen, 1)
    assert.match(setup.captureCharFrame(), /Shop/)
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
    readItem: async () => assert.fail('unexpected task detail read'),
    watch(onChange) {
      changed = onChange
      return { close() {} }
    },
  }
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const viewer = await startTerminalViewer(viewerFixtureRoot, {
    renderer: setup.renderer,
    workSource,
  })
  try {
    viewer.setView({ level: 'context', currentId: 'shop' })
    await setup.renderOnce()
    assert.doesNotMatch(setup.captureCharFrame(), /TASK-LIVE/)

    items = [item('TASK-LIVE', {
      title: 'Change Shop',
      assignees: ['@codex'],
      references: ['shop'],
      acceptanceCriteriaCount: 1,
    })]
    changed()
    await press(setup, 'w')
    const deadline = Date.now() + 3000
    while (!setup.captureCharFrame().includes('TASK-LIVE') && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 25))
      await setup.renderOnce()
    }
    const frame = setup.captureCharFrame()
    assert.match(frame, /TASK-LIVE/)
  } finally {
    viewer.destroy()
    if (!setup.renderer.isDestroyed) setup.renderer.destroy()
  }
})

test.concurrent('corners follow the shown statuses and name the selected task first', () => {
  const base = navigationWorld()
  const model = {
    ...base,
    work: snapshot([
      item('TASK-ACTIVE', { title: 'Active', references: ['cleft'] }),
      item('TASK-TODO', { title: 'Todo', status: 'To Do', references: ['cleft'] }),
      item('TASK-DONE', { title: 'Done', status: 'Done', references: ['cright'] }),
    ]),
  }
  const projection = projectWorld(model, { viewport: mapViewportOf({ width: 120, height: 36 }), currentId: 'observed:alpha' })
  const focus = (taskId: string, shown: string[]) => ({ selection: { state: 'selected' as const, taskId }, before: beforeWork(), shown })

  // At first only the active status shows: the to-do task counts nowhere and the done one has no corner.
  assert.deepEqual(projectWork(model, projection, undefined).corners, [{ elementId: 'observed:cleft', taskId: 'TASK-ACTIVE', others: 0, stage: 'progress', selected: false }])
  const all = projectWork(model, projection, focus('TASK-TODO', ['In Progress', 'To Do', 'Done'])).corners
  assert.deepEqual(all.find(corner => corner.elementId === 'observed:cleft'), { elementId: 'observed:cleft', taskId: 'TASK-TODO', others: 1, stage: 'todo', selected: true })
  assert.deepEqual(all.find(corner => corner.elementId === 'observed:cright'), { elementId: 'observed:cright', taskId: 'TASK-DONE', others: 0, stage: 'done', selected: false })
})

test.concurrent('at root a component task stands on its container row and never on the island', () => {
  const model = { ...navigationWorld(), work: snapshot([item('TASK-DEEP', { title: 'Deep', references: ['pleft'] })]) }
  const corners = projectWork(model, projectWorld(model, { viewport: mapViewportOf({ width: 120, height: 36 }), currentId: 'observed:alpha' }), undefined).corners
  assert.deepEqual(corners.map(corner => corner.elementId), ['observed:cleft'])
})

test.concurrent('status toggles start without the default and final statuses and flip one status without moving the map', () => {
  const work = snapshot([
    item('TASK-ACTIVE', { title: 'Active', references: ['cleft'] }),
    item('TASK-DONE', { title: 'Done', status: 'Done', references: ['cright'] }),
  ])
  const model = { ...navigationWorld(), work }
  const first = initialWorkFocus(work, beforeWork())
  assert.deepEqual(first.shown, ['In Progress'])
  assert.deepEqual(toggleShownStatus(first, 'Done').shown, ['In Progress', 'Done'])
  assert.deepEqual(toggleShownStatus(toggleShownStatus(first, 'Done'), 'Done').shown, ['In Progress'])

  let state = reduceViewer(model, initialState(model), 'toggle-work')
  state = reduceViewer(model, state, 'down')
  assert.deepEqual(state.work?.selection, { state: 'status', status: 'Done' })
  const folded = reduceViewer(model, state, 'enter')
  assert.deepEqual(folded.work?.shown, ['In Progress'])
  assert.ok(folded.work?.expanded?.includes('Done'))
  const toggled = reduceViewer(model, folded, 'toggle-selection')
  assert.deepEqual(toggled.work?.shown, ['In Progress', 'Done'])
  assert.deepEqual([toggled.level, toggled.currentId, toggled.work?.selection], [state.level, state.currentId, state.work?.selection])
})

test.concurrent('the component Tasks tab walks related tasks and Enter opens the record', () => {
  const model = { ...navigationWorld(), work: snapshot([item('TASK-HERE', { title: 'Here', references: ['pmid'], acceptanceCriteriaCompleted: 1, acceptanceCriteriaCount: 3 })]) }
  let state: ViewerState = { ...initialState(model), currentId: 'observed:pmid', level: 'components', focus: 'details', detailsTab: 'tasks' }
  state = reduceViewer(model, state, 'down')
  state = reduceViewer(model, state, 'down')
  assert.equal(state.actionCursor, 'TASK-HERE')
  state = reduceViewer(model, state, 'enter')
  assert.deepEqual(state.taskRecord, { id: 'TASK-HERE', row: 0 })
  assert.equal(reduceViewer(model, state, 'dismiss').taskRecord, undefined)
})

test.concurrent('the viewer reads the opened record through the host', async () => {
  const model = { ...navigationWorld(), work: snapshot([item('TASK-READ', { title: 'Read me', references: ['ann'] })]) }
  const setup = await createTestRenderer({ width: 120, height: 36 })
  try {
    const read: string[] = []
    const app = mountTerminalViewer(setup.renderer, model, {
      currentId: 'observed:ann',
      readTask: async id => {
        read.push(id)
        return { id, description: 'A record body.', acceptanceCriteria: [{ text: 'Criterion', checked: true }], definitionOfDone: [], implementationPlan: '', implementationNotes: '', comments: [] }
      },
    })
    await setup.renderOnce()
    // Work selects the task; Enter opens the same full record used by a component Tasks tab.
    await press(setup, 'w')
    const opened = await press(setup, 'enter')
    assert.deepEqual(read, ['TASK-READ'])
    assert.ok(opened.includes('TASK-READ'))
    await setup.renderOnce()
    assert.ok(setup.captureCharFrame().includes('A record body.'))
    app.destroy()
  } finally {
    if (!setup.renderer.isDestroyed) setup.renderer.destroy()
  }
})
