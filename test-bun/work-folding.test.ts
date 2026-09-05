import assert from 'node:assert/strict'
import { test } from 'bun:test'
import type { WorkItem } from '../src/types.ts'
import { initialState, reduceViewer, type ViewerState } from '../src/viewers/tui/navigation.ts'
import { foldWorkStatus, initialWorkFocus, reconcileWorkFocus, workRows } from '../src/viewers/tui/work/model.ts'
import { taskRecordView } from '../src/viewers/tui/panes/details.ts'
import { detailsScrollOffset } from '../src/viewers/tui/panes/screen.ts'
import { READING_CONTENT_WIDTH } from '../src/viewers/tui/layout.ts'
import { viewerTheme } from '../src/viewers/tui/atoms/theme.ts'
import { navigationWorld } from './helpers.ts'

function model() {
  const items: WorkItem[] = ['To Do', 'In Progress', 'Done'].map((status, index) => ({
    id: `TASK-${index}`, title: `Task ${index}`, status, assignees: [], references: ['pmid'], modifiedFiles: [],
    acceptanceCriteriaCount: 0, acceptanceCriteriaCompleted: 0, updatedAt: '',
  }))
  return { ...navigationWorld(), work: { statuses: ['To Do', 'In Progress', 'Done'], defaultStatus: 'To Do', items } }
}

test.concurrent('status folding preserves map filters and moves hidden task selection to its header', () => {
  const world = model()
  const focus = initialWorkFocus(world.work, initialState(world))
  assert.deepEqual(focus.expanded, ['In Progress'])
  assert.deepEqual(focus.shown, ['In Progress'])
  assert.deepEqual(workRows(world, focus).map(row => row.kind), ['status', 'status', 'task', 'status'])
  const folded = foldWorkStatus(world, focus, 'In Progress', false)
  assert.deepEqual(folded.selection, { state: 'status', status: 'In Progress' })
  assert.deepEqual(folded.shown, focus.shown)
  assert.equal(workRows(world, folded).some(row => row.kind === 'task'), false)
  assert.equal(workRows(world, foldWorkStatus(world, folded, 'To Do', true)).filter(row => row.kind === 'task').length, 1)
  const delayed = reconcileWorkFocus(world.work, initialWorkFocus(undefined, initialState(world)))!
  assert.deepEqual(delayed.shown, ['In Progress'])
})

test.concurrent('component task groups and global Work share folding without coupling it to map visibility', () => {
  const world = model()
  let state: ViewerState = { ...initialState(world), currentId: 'observed:pmid', level: 'components', focus: 'details', detailsTab: 'tasks' }
  state = reduceViewer(world, state, 'down')
  assert.equal(state.actionCursor, 'status:To Do')
  state = reduceViewer(world, state, 'enter')
  assert.ok(state.workList?.expanded?.includes('To Do'))
  assert.deepEqual(state.workList?.shown, ['In Progress'])
  state = reduceViewer(world, state, 'toggle-selection')
  assert.deepEqual(state.workList?.shown, ['In Progress'])
  state = reduceViewer(world, state, 'down')
  assert.equal(state.actionCursor, 'TASK-0')
  state = reduceViewer(world, state, 'left')
  assert.equal(state.actionCursor, 'status:To Do')
  assert.deepEqual(state.workList?.shown, ['In Progress'])
  state = reduceViewer(world, state, 'toggle-work')
  assert.deepEqual(state.work?.expanded, ['In Progress'])
  assert.deepEqual(state.work?.selection, { state: 'selected', taskId: 'TASK-1' })
})


test.concurrent('a long record reads every row before and after links and returns from a diff to the same row', () => {
  const world = model()
  const files = ['src/features/long-component-name/first.ts', 'src/features/long-component-name/following.ts']
  world.work.items[1]!.modifiedFiles = files
  const item = world.work.items[1]!
  const details = { id: item.id, description: Array.from({ length: 45 }, (_, index) => `Detail ${index}`).join('\n'), acceptanceCriteria: [{ text: 'Result', checked: false }], definitionOfDone: [{ text: 'Proof', checked: false }], implementationPlan: 'Steps', implementationNotes: 'Note\n'.repeat(40), comments: [] }
  let state: ViewerState = { ...initialState(world), focus: 'details', taskRecord: { id: item.id, row: 0, details } }
  const content = taskRecordView(viewerTheme(), item, details, READING_CONTENT_WIDTH, undefined)
  const lines = content.lines
  const opened = new Set<string>()
  for (let index = 1; index < lines.length; index++) {
    state = reduceViewer(world, state, 'down')
    assert.equal(state.taskRecord!.row, index)
    const pane = taskRecordView(viewerTheme(), item, details, READING_CONTENT_WIDTH, state.taskRecord!.row)
    const top = detailsScrollOffset(pane, 0, 28)
    assert.ok(index >= top && index < top + 28)
    const file = content.ids?.[index]
    if (file !== undefined && files.includes(file)) {
      const diff = reduceViewer(world, state, 'enter')
      assert.equal(diff.diffView?.file, file)
      opened.add(diff.diffView!.file)
      const restored = reduceViewer(world, diff, 'dismiss')
      assert.equal(restored.taskRecord!.row, index)
    }
  }
  assert.deepEqual([...opened], files)
  for (let index = lines.length - 2; index >= 0; index--) {
    state = reduceViewer(world, state, 'up')
    assert.equal(state.taskRecord!.row, index)
  }
  assert.equal(state.actionCursor, undefined)
})
