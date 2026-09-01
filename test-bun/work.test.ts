import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'

import { normalizeTerminalPalette } from '@opentui/core'
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

const beforeWork = {
  focus: 'architecture' as const,
  details: true,
  detailsScroll: 0,
}

test.concurrent('Work focus follows active, default, then terminal workflow groups', () => {
  const work = snapshot([
    item('TASK-TODO', { title: 'Todo', status: 'To Do' }),
    item('TASK-DONE', { title: 'Done', status: 'Done' }),
    item('TASK-ACTIVE', { title: 'Active' }),
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
      item('TASK-LOCAL', { title: 'Local', references: ['pleft', 'pmid'] }),
      item('TASK-CROSS', { title: 'Cross', references: ['pleft', 'pright'] }),
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
  const work = snapshot([item('TASK-1', { title: 'Live' })])

  const waiting = initialWorkFocus(undefined, beforeWork)
  const selected = reconcileWorkFocus(work, waiting)!
  assert.equal(selectedWorkId(selected), 'TASK-1')
  assert.equal(reconcileWorkFocus(work, selected), selected)

  const cleared = reconcileWorkFocus(snapshot(), selected)!
  assert.equal(cleared.selection.state, 'cleared')
  assert.equal(reconcileWorkFocus(snapshot(), cleared), cleared)
})

test.concurrent('Backlog plugin reads every task summary once and selected detail on demand', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-backlog-read-'))
  const tasks = path.join(root, 'backlog', 'tasks')
  await mkdir(tasks, { recursive: true })
  const calls: string[][] = []
  const run: BacklogCommand = async arguments_ => {
    calls.push(arguments_)
    return arguments_[2] === 'statuses' ? 'To Do, In Progress, Review, Done\n' : 'To Do\n'
  }
  const taskSource = (id: string, status: string, details = '') => `---
id: ${id}
title: Change ${id}
status: ${status}
assignee: ['@codex']
updated_date: '2026-08-23T11:00:00Z'
references: [shop, 'https://example.com']
modified_files: [src/shop.ts]
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 one
- [ ] #2 two
<!-- AC:END -->
${details}`.replaceAll('\n', '\r\n')
  const detailSections = `
## Description
<!-- SECTION:DESCRIPTION:BEGIN -->
Why it matters
<!-- SECTION:DESCRIPTION:END -->
## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 verified
<!-- DOD:END -->
## Implementation Plan
<!-- SECTION:PLAN:BEGIN -->
First plan
<!-- SECTION:PLAN:END -->
## Implementation Notes
<!-- SECTION:NOTES:BEGIN -->
First note
<!-- SECTION:NOTES:END -->
## Comments
<!-- COMMENTS:BEGIN -->
author: @alex
created: 2026-08-23T11:00:00Z
---
Review this
---

created: 2026-08-23T12:00:00Z
---
Recorded without an author
---
<!-- COMMENTS:END -->`
  try {
    await Promise.all([
      writeFile(path.join(tasks, 'task-1 - Change.md'), taskSource('TASK-1', 'In Progress', detailSections)),
      writeFile(path.join(tasks, 'task-2 - Change.md'), taskSource('TASK-2', 'Done')),
      writeFile(path.join(tasks, 'task-3 - Change.md'), taskSource('TASK-3', 'Done')),
      writeFile(path.join(tasks, 'task-4 - Change.md'), taskSource('TASK-4', 'To Do')),
      writeFile(path.join(tasks, 'task-5 - Change.md'), taskSource('TASK-5', 'Review')),
    ])
    const source = createBacklogSource(root, run)
    const work = await source.read()
    assert.deepEqual(calls, [
      ['config', 'get', 'statuses'],
      ['config', 'get', 'defaultStatus'],
    ])
    assert.deepEqual(work.statuses, ['To Do', 'In Progress', 'Review', 'Done'])
    assert.equal(work.defaultStatus, 'To Do')
    assert.deepEqual(work.items.map(item => [item.id, item.status, item.acceptanceCriteriaCompleted, item.acceptanceCriteriaCount]), [
      ['TASK-1', 'In Progress', 1, 2],
      ['TASK-2', 'Done', 1, 2],
      ['TASK-3', 'Done', 1, 2],
      ['TASK-4', 'To Do', 1, 2],
      ['TASK-5', 'Review', 1, 2],
    ])
    assert.deepEqual(work.items[0]!.references, ['shop', 'https://example.com'])
    const details = await source.readItem('TASK-1')
    assert.equal(calls.length, 2)
    assert.deepEqual(details.acceptanceCriteria, [{ text: 'one', checked: true }, { text: 'two', checked: false }])
    assert.deepEqual(details.definitionOfDone, [{ text: 'verified', checked: false }])
    assert.equal(details.implementationPlan, 'First plan')
    assert.equal(details.implementationNotes, 'First note')
    assert.deepEqual(details.comments, [{
      body: 'Review this', createdAt: '2026-08-23T11:00:00Z', author: '@alex',
    }, {
      body: 'Recorded without an author', createdAt: '2026-08-23T12:00:00Z', author: '',
    }])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
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

test.concurrent('Backlog plugin needs no watcher when the project has no Backlog tasks', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-no-backlog-'))
  try {
    createBacklogPlugin(() => null).create(root)
      .watch(() => assert.fail('unexpected work change')).close()
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('a missing Backlog command reports install help and supplies empty work', async () => {
  const missing = createBacklogPlugin(() => null)
  const found = createBacklogPlugin(() => '/usr/local/bin/backlog')

  assert.deepEqual(missing.readiness(), {
    status: 'missing',
    install: 'bun i -g backlog.md',
  })
  assert.deepEqual(found.readiness(), { status: 'found' })
  assert.deepEqual(await missing.create('/repo').read(), EMPTY_WORK_SNAPSHOT)

  const setup = await createTestRenderer({ width: 120, height: 36 })
  const viewer = await startTerminalViewer(viewerFixtureRoot, {
    renderer: setup.renderer,
    palette: normalizeTerminalPalette(),
    workSource: missing.create(viewerFixtureRoot),
  })
  viewer.destroy()
  if (!setup.renderer.isDestroyed) setup.renderer.destroy()
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
    readItem: async () => assert.fail('unexpected task detail read'),
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
    readItem: async () => assert.fail('unexpected task detail read'),
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
    assert.match(frame, /Acceptance criteria/)
  } finally {
    viewer.destroy()
    if (!setup.renderer.isDestroyed) setup.renderer.destroy()
  }
})
