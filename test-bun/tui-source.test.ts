import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'bun:test'
import { createTestRenderer } from '@opentui/core/testing'

import type { WorkSnapshot } from '../src/types.ts'
import type { TaskFileDiff } from '../src/viewers/source/diff-lines.ts'
import { readSource } from '../src/viewers/source/read.ts'
import { readCodeStructure } from '../src/viewers/source/structure.ts'
import { declarationStops } from '../src/viewers/tui/navigation-details.ts'
import { detailsCommands, initialState, reduceViewer, type ViewerState } from '../src/viewers/tui/navigation.ts'
import { mountTerminalViewer } from '../src/viewers/tui/terminal-viewer.ts'
import { navigationWorld, press, repositoryRoot, terminalModel } from './helpers.ts'

const sourceFixtureRoot = path.join(repositoryRoot, 'test', 'fixtures', 'source-view')

function workWithModifiedFile(): WorkSnapshot {
  return {
    statuses: ['To Do', 'In Progress', 'Done'],
    defaultStatus: 'To Do',
    items: [{
      id: 'TASK-1',
      title: 'Change orders',
      status: 'In Progress',
      assignees: [],
      references: ['ann'],
      modifiedFiles: ['src/orders.ts'],
      acceptanceCriteriaCompleted: 0,
      acceptanceCriteriaCount: 1,
      updatedAt: '2026-09-03T12:00:00Z',
    }],
  }
}

async function waitFor(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 2000
  while (!condition() && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  assert.equal(condition(), true)
}

test.concurrent('shared readers return the selected component structure and source', async () => {
  const model = await terminalModel(sourceFixtureRoot)
  const structure = await readCodeStructure(sourceFixtureRoot, model, null, 'orders')
  assert.deepEqual(structure, [{
    file: 'src/orders.ts',
    declarations: [
      { kind: 'function', name: 'placeOrder', line: 1, scope: 'export', entry: true },
      {
        kind: 'class',
        name: 'OrderBook',
        line: 5,
        scope: 'export',
        entry: false,
        members: [{ name: 'total', line: 6, scope: 'public', entry: false }],
      },
    ],
  }])
  const source = await readSource(sourceFixtureRoot, model, null, 'orders', 'src/orders.ts')
  assert.match(source?.source ?? '', /export function placeOrder/)
  assert.equal(await readSource(sourceFixtureRoot, model, null, 'missing', 'src/orders.ts'), undefined)
})

test.concurrent('details declarations open source at their exact line and Escape returns', () => {
  const model = navigationWorld()
  let state: ViewerState = {
    ...initialState(model),
    currentId: 'observed:pleft',
    focus: 'details',
    detailsTab: 'how',
    codeStructure: {
      elementId: 'observed:pleft',
      files: [{
        file: 'src/orders.ts',
        declarations: [{
          kind: 'class',
          name: 'OrderBook',
          line: 5,
          scope: 'export',
          entry: true,
          members: [{ name: 'total', line: 6, scope: 'public', entry: false }],
        }],
      }],
    },
  }

  assert.deepEqual(declarationStops(state), ['src/orders.ts:5', 'src/orders.ts:6'])
  state = reduceViewer(model, state, 'down')
  assert.equal(state.actionCursor, 'src/orders.ts:5')
  state = reduceViewer(model, state, 'enter')
  assert.deepEqual(state.sourceView, { file: 'src/orders.ts', line: 5 })
  assert.equal(state.detailsScroll, 2)
  state = reduceViewer(model, state, 'dismiss')
  assert.equal(state.sourceView, undefined)
  assert.equal(state.actionCursor, 'src/orders.ts:5')
})

test.concurrent('a task modified file opens its diff and Escape returns to the record', () => {
  const work = workWithModifiedFile()
  const model = { ...navigationWorld(), work }
  let state: ViewerState = {
    ...initialState(model),
    currentId: 'observed:ann',
    focus: 'details',
    taskRecord: { id: 'TASK-1' },
  }

  state = reduceViewer(model, state, 'down')
  assert.equal(state.actionCursor, 'src/orders.ts')
  state = reduceViewer(model, state, 'enter')
  assert.deepEqual(state.diffView, { taskId: 'TASK-1', file: 'src/orders.ts' })
  state = reduceViewer(model, state, 'dismiss')
  assert.equal(state.diffView, undefined)
  assert.deepEqual(state.taskRecord, { id: 'TASK-1' })
})

test.concurrent('the terminal loads structure and source only when their details open', async () => {
  const model = await terminalModel(sourceFixtureRoot)
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const reads: string[] = []
  let structureLoaded = false
  let sourceLoaded = false
  const app = mountTerminalViewer(setup.renderer, model, {
    level: 'components',
    currentId: 'orders',
    readStructure: async elementId => {
      reads.push(`structure:${elementId}`)
      const structure = await readCodeStructure(sourceFixtureRoot, model, null, elementId)
      structureLoaded = true
      return structure
    },
    readSource: async (elementId, file) => {
      reads.push(`source:${elementId}:${file}`)
      const source = await readSource(sourceFixtureRoot, model, null, elementId, file)
      sourceLoaded = true
      return source
    },
  })
  try {
    await setup.renderOnce()
    await press(setup, 'enter', 't')
    await waitFor(() => structureLoaded)
    await setup.renderOnce()
    assert.match(setup.captureCharFrame(), /10 lines/)
    const commands = detailsCommands(model, { currentId: 'orders', detailsTab: 'how' }).length
    await press(setup, ...Array.from({ length: commands + 1 }, () => 'down'), 'enter')
    await waitFor(() => sourceLoaded)
    await setup.renderOnce()

    assert.deepEqual(reads, ['structure:orders', 'source:orders:src/orders.ts'])
    assert.match(setup.captureCharFrame(), /src\/orders\.ts:1/)
    assert.match(await press(setup, 'escape'), /Code/)
  } finally {
    app.destroy()
  }
})

test.concurrent('the terminal loads a selected task file diff on demand', async () => {
  const fileDiff: TaskFileDiff = {
    file: 'src/orders.ts',
    status: 'modified',
    shared: false,
    additions: 1,
    deletions: 0,
    hunks: [{
      header: '@@ -1,1 +1,2 @@',
      lines: [{ kind: 'added', newLine: 2, text: 'return order' }],
    }],
  }
  const work = workWithModifiedFile()
  const model = { ...navigationWorld(), work }
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const reads: string[] = []
  const app = mountTerminalViewer(setup.renderer, model, {
    currentId: 'observed:ann',
    readTask: async id => ({
      id,
      description: '',
      acceptanceCriteria: [],
      definitionOfDone: [],
      implementationPlan: '',
      implementationNotes: '',
      comments: [],
    }),
    readDiff: async (taskId, file) => {
      reads.push(`${taskId}:${file}`)
      return fileDiff
    },
  })
  try {
    await setup.renderOnce()
    await press(setup, 'enter', 'down', 'enter')
    await waitFor(() => setup.captureCharFrame().includes('src/orders.ts'))
    await press(setup, 'down', 'enter')
    await waitFor(() => reads.length === 1)
    await setup.renderOnce()

    assert.deepEqual(reads, ['TASK-1:src/orders.ts'])
    assert.match(setup.captureCharFrame(), /return order/)
    assert.match(await press(setup, 'escape'), /TASK-1/)
  } finally {
    app.destroy()
  }
})
