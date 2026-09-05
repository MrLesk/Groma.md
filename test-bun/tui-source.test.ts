import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'bun:test'
import { ScrollBoxRenderable, type Renderable } from '@opentui/core'
import { createTestRenderer } from '@opentui/core/testing'

import type { WorkSnapshot } from '../src/types.ts'
import type { TaskFileDiff } from '../src/viewers/source/diff-lines.ts'
import { readSource } from '../src/viewers/source/read.ts'
import { readCodeStructure } from '../src/viewers/source/structure.ts'
import { declarationStops } from '../src/viewers/tui/navigation-details.ts'
import { taskRecordView } from '../src/viewers/tui/panes/details.ts'
import { viewerTheme } from '../src/viewers/tui/atoms/theme.ts'
import { detailsContentWidth, READING_CONTENT_WIDTH } from '../src/viewers/tui/layout.ts'
import { initialState, reduceViewer, type ViewerState } from '../src/viewers/tui/navigation.ts'
import { mountTerminalViewer } from '../src/viewers/tui/terminal-viewer.ts'
import { navigationWorld, press, repositoryRoot, terminalModel } from './helpers.ts'

const sourceFixtureRoot = path.join(repositoryRoot, 'test', 'fixtures', 'source-view')

const emptyRecord = { id: 'TASK-1', description: '', acceptanceCriteria: [], definitionOfDone: [], implementationPlan: '', implementationNotes: '', comments: [] }

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
  assert.deepEqual(state.sourceView, { file: 'src/orders.ts', line: 5, returnScroll: 0 })
  assert.equal(state.detailsScroll, 2)
  state = reduceViewer(model, state, 'dismiss')
  assert.equal(state.sourceView, undefined)
  assert.equal(state.actionCursor, 'src/orders.ts:5')
  state = reduceViewer(model, state, 'down')
  for (let step = 0; step < 5; step++) state = reduceViewer(model, state, 'down')
  const before = state
  state = reduceViewer(model, state, 'enter')
  state = reduceViewer(model, state, 'down')
  state = reduceViewer(model, state, 'dismiss')
  assert.equal(state.detailsScroll, before.detailsScroll)
  assert.equal(state.actionCursor, before.actionCursor)
  assert.equal(detailsContentWidth(state), detailsContentWidth(before))
})

test.concurrent('a task modified file opens its diff and Escape returns to the record', () => {
  const work = workWithModifiedFile()
  const model = { ...navigationWorld(), work }
  let state: ViewerState = {
    ...initialState(model),
    currentId: 'observed:ann',
    focus: 'details',
    taskRecord: { id: 'TASK-1', row: 0, details: emptyRecord },
  }

  const fileRow = taskRecordView(viewerTheme(), work.items[0]!, emptyRecord, detailsContentWidth(state), undefined).ids!.indexOf('src/orders.ts')
  for (let count = 0; count < fileRow; count++) state = reduceViewer(model, state, 'down')
  const readingRow = state.taskRecord!.row
  state = reduceViewer(model, state, 'enter')
  assert.deepEqual(state.diffView, { file: 'src/orders.ts' })
  state = reduceViewer(model, state, 'dismiss')
  assert.equal(state.diffView, undefined)
  assert.deepEqual(state.taskRecord, { id: 'TASK-1', row: readingRow, details: emptyRecord })
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
    assert.deepEqual(reads, [])
    await press(setup, 'enter', 'tab')
    await waitFor(() => structureLoaded)
    await setup.renderOnce()
    await press(setup, 'down', 'enter')
    await waitFor(() => sourceLoaded)
    await setup.renderOnce()

    assert.deepEqual(reads, ['structure:orders', 'source:orders:src/orders.ts'])
    assert.match(setup.captureCharFrame(), /src\/orders\.ts:1/)
    await press(setup, 'escape')
    assert.deepEqual(reads, ['structure:orders', 'source:orders:src/orders.ts'])
  } finally {
    app.destroy()
  }
})

test.concurrent('the task record and file reader share one diff load and preserve the reading row', async () => {
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
  const record = { ...emptyRecord, description: 'A paragraph in the task definition.\n'.repeat(40), implementationNotes: 'Following rows\n'.repeat(30) }
  const app = mountTerminalViewer(setup.renderer, model, {
    currentId: 'observed:ann',
    readTask: async id => ({ ...record, id }),
    readTaskDiff: async taskId => {
      reads.push(taskId)
      return { taskId, source: { kind: 'working-tree', base: 'HEAD', revision: 'HEAD' }, files: [fileDiff] }
    },
  })
  try {
    await setup.renderOnce()
    await press(setup, 'w', 'enter')
    await waitFor(() => setup.captureCharFrame().includes('A paragraph'))
    assert.deepEqual(reads, ['TASK-1'])
    const rows = taskRecordView(viewerTheme(), work.items[0]!, record, READING_CONTENT_WIDTH, undefined, [fileDiff])
    const fileRow = rows.ids!.indexOf(fileDiff.file)
    assert.ok(fileRow >= 0)
    for (let index = 0; index < fileRow; index++) await press(setup, 'down')
    for (let index = 0; index < 5; index++) await press(setup, 'j')
    for (let index = 0; index < 5; index++) await press(setup, 'up')
    const recordFrame = setup.captureCharFrame()
    await press(setup, 'enter')
    await setup.renderOnce()

    assert.deepEqual(reads, ['TASK-1'])
    assert.match(setup.captureCharFrame(), /return order/)
    await press(setup, 'escape')
    await setup.renderOnce()
    assert.equal(setup.captureCharFrame(), recordFrame)
  } finally {
    app.destroy()
  }
})

test.concurrent('mixed arrow and j/k reading preserves the viewport until the cursor crosses an edge', async () => {
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const work = workWithModifiedFile()
  const record = { ...emptyRecord, description: 'Reading row\n'.repeat(90) }
  const app = mountTerminalViewer(setup.renderer, { ...navigationWorld(), work }, {
    readTask: async () => record,
  })
  try {
    await setup.renderOnce()
    await press(setup, 'w', 'enter')
    await waitFor(() => setup.captureCharFrame().includes('Reading row'))
    const boxes: ScrollBoxRenderable[] = []
    const visit = (node: Renderable): void => {
      if (node instanceof ScrollBoxRenderable) boxes.push(node)
      for (const child of node.getChildren()) visit(child)
    }
    visit(setup.renderer.root)
    const pane = boxes.at(-1)!
    pane.focus()
    for (let row = 0; row < 45; row++) await press(setup, 'down')
    const top = pane.scrollTop
    const frame = setup.captureCharFrame()
    await press(setup, 'up')
    assert.equal(pane.scrollTop, top)
    assert.equal(await press(setup, 'j'), frame)
    assert.equal(pane.scrollTop, top)
    await press(setup, 'k')
    assert.equal(pane.scrollTop, top)
    await press(setup, 'up')
    assert.equal(pane.scrollTop, top)
    for (let row = 0; row < pane.viewport.height; row++) await press(setup, 'k')
    assert.ok(pane.scrollTop < top)
    for (let row = 0; row < 45; row++) await press(setup, row % 2 === 0 ? 'up' : 'k')
    assert.equal(pane.scrollTop, 0)
  } finally {
    app.destroy()
  }
})
