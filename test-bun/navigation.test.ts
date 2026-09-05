import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { createArchitectureSearch } from '../src/search.ts'
import {
  defaultSelection,
  detailsCommands,
  initialState,
  litAction,
  reduceViewer,
  type ViewerState,
} from '../src/viewers/tui/navigation.ts'
import { reduceSearch } from '../src/viewers/tui/navigation-search.ts'
import { selectedWorkId } from '../src/viewers/tui/work/model.ts'
import { nearestInDirection } from '../src/viewers/tui/navigation-spatial.ts'
import { worldCommands } from '../src/viewers/action-path.ts'
import { litLegs } from '../src/viewers/tui/flow.ts'
import { taskRecordView } from '../src/viewers/tui/panes/details.ts'
import { detailsContentWidth } from '../src/viewers/tui/layout.ts'
import { viewerTheme } from '../src/viewers/tui/atoms/theme.ts'
import {
  box,
  navigationWorld,
  terminalModel,
  uses,
  viewerFixtureRoot,
  worldOf,
} from './helpers.ts'

function actionWorld() {
  return worldOf([
    box('buyer', 'actor', { x: 0, y: 0, width: 1, height: 1 }),
    box('product', 'system', { x: 0, y: 0, width: 1, height: 1 }, {
      children: ['observed:api', 'observed:web', 'observed:jobs'],
    }),
    ...['api', 'web', 'jobs'].map(id => box(
      id,
      'container',
      { x: 0, y: 0, width: 1, height: 1 },
      { parent: 'observed:product' },
    )),
  ], [
    uses('buyer-api', 'buyer', 'api'),
    uses('buyer-web', 'buyer', 'web'),
    uses('api-web', 'api', 'web'),
    uses('api-jobs', 'api', 'jobs'),
  ])
}

/** Four buildings that wrap into two lines of two at a 40-column map. */
function laneNavigationWorld() {
  const ids = ['a', 'b', 'c', 'd']
  const cell = { x: 0, y: 0, width: 1, height: 1 }
  const model = worldOf([
    box('system', 'system', cell, { children: ['observed:container'] }),
    box('container', 'container', cell, { parent: 'observed:system', children: ids.map(id => `observed:${id}`) }),
    ...ids.map(id => box(id, 'component', cell, { parent: 'observed:container' })),
  ])
  return {
    ...model,
    sheet: {
      ...model.sheet,
      buildings: model.sheet.buildings.map(building => ({
        ...building,
        rect: { gx: ids.indexOf(building.id) * 10, gy: 0, w: 6, d: 4 },
      })),
    },
  }
}

function containmentNavigationWorld() {
  const model = worldOf([
    box('system', 'system', { x: 0, y: 0, width: 1, height: 1 }, {
      children: ['observed:upper', 'observed:lower'],
    }),
    box('upper', 'container', { x: 0, y: 0, width: 1, height: 1 }, {
      parent: 'observed:system',
    }),
    box('lower', 'container', { x: 0, y: 0, width: 1, height: 1 }, {
      parent: 'observed:system',
    }),
    box('north', 'system', { x: 0, y: 0, width: 1, height: 1 }),
    box('south', 'system', { x: 0, y: 0, width: 1, height: 1 }),
    box('actor', 'actor', { x: 0, y: 0, width: 1, height: 1 }),
    box('external', 'system', { x: 0, y: 0, width: 1, height: 1 }, { external: true }),
  ])
  return {
    ...model,
    sheet: {
      ...model.sheet,
      islands: model.sheet.islands.map(island => {
        const gx = { actors: 0, north: 20, system: 40, south: 60, external: 80 }[island.element?.id ?? island.kind]
        return gx === undefined ? island : { ...island, rect: { ...island.rect, gx, gy: 0 } }
      }),
      slabs: model.sheet.slabs.map(slab => ({
        ...slab,
        rect: slab.id === 'upper'
          ? { gx: 22, gy: 24, w: 18, d: 14 }
          : { gx: 22, gy: 70, w: 37, d: 14 },
      })),
    },
  }
}

test.concurrent('map navigation enters only containers and returns to the same container', () => {
  const model = navigationWorld()
  assert.equal(defaultSelection(model, 'context')?.representationId, 'observed:cleft')

  let state: ViewerState = {
    ...initialState(model),
    currentId: 'observed:cleft',
  }
  state = reduceViewer(model, state, 'enter')
  assert.deepEqual(
    { level: state.level, currentId: state.currentId },
    { level: 'components', currentId: 'observed:pleft' },
  )

  state = reduceViewer(model, state, 'right')
  assert.equal(state.currentId, 'observed:pmid')
  state = reduceViewer(model, state, 'leave')
  assert.deepEqual(
    { level: state.level, currentId: state.currentId },
    { level: 'context', currentId: 'observed:cleft' },
  )

  const actor = reduceViewer(model, {
    ...initialState(model),
    currentId: 'observed:ann',
  }, 'enter')
  assert.equal(actor.level, 'context')
  assert.equal(actor.focus, 'details')
})

test.concurrent('map edges preserve map focus until an explicit pane key', () => {
  const model = navigationWorld()
  const left = reduceViewer(model, {
    ...initialState(model),
    currentId: 'observed:ann',
  }, 'left')
  assert.equal(left.focus, 'architecture')
  assert.equal(left.tree.cursor, 'observed:ann')

  const right = reduceViewer(model, {
    ...initialState(model),
    currentId: 'observed:ext',
    panes: { hierarchy: true, details: false },
  }, 'right')
  assert.equal(right.focus, 'architecture')
  assert.equal(right.panes.details, false)
  assert.equal(reduceViewer(model, right, 'enter').focus, 'details')
})

test.concurrent('container arrows select only buildings in the pressed direction', () => {
  const model = laneNavigationWorld()
  const state: ViewerState = { ...initialState(model), level: 'components', currentId: 'observed:a', mapWidth: 40 }

  assert.equal(reduceViewer(model, state, 'right').currentId, 'observed:b')
  assert.equal(reduceViewer(model, state, 'down').currentId, 'observed:c')
  assert.equal(reduceViewer(model, { ...state, currentId: 'observed:b' }, 'down').currentId, 'observed:d')
  assert.equal(reduceViewer(model, { ...state, currentId: 'observed:d' }, 'left').currentId, 'observed:c')
  assert.equal(reduceViewer(model, { ...state, currentId: 'observed:c' }, 'up').currentId, 'observed:a')
  assert.equal(reduceViewer(model, { ...state, currentId: 'observed:d' }, 'up').currentId, 'observed:b')

  const noRightCandidate = reduceViewer(model, { ...state, currentId: 'observed:b' }, 'right')
  assert.equal(noRightCandidate.currentId, 'observed:b')
  assert.equal(noRightCandidate.focus, 'architecture')
})

test.concurrent('root arrows walk the rows of an island and cross to its neighbours', () => {
  const model = containmentNavigationWorld()
  const start: ViewerState = { ...initialState(model), currentId: 'observed:lower' }

  const up = reduceViewer(model, start, 'up')
  assert.equal(up.currentId, 'observed:upper')
  const island = reduceViewer(model, up, 'up')
  assert.equal(island.currentId, 'observed:system')
  assert.equal(reduceViewer(model, island, 'up').currentId, 'observed:system')
  assert.equal(reduceViewer(model, island, 'down').currentId, 'observed:upper')
  assert.equal(reduceViewer(model, start, 'down').currentId, 'observed:lower')

  const west = reduceViewer(model, start, 'left')
  assert.equal(west.currentId, 'observed:north')
  assert.equal(reduceViewer(model, west, 'left').currentId, 'observed:actor')
  const east = reduceViewer(model, start, 'right')
  assert.equal(east.currentId, 'observed:south')
  assert.equal(reduceViewer(model, east, 'right').currentId, 'observed:external')
})

test.concurrent('Escape returns to the map without changing pane visibility, scope or selection', () => {
  const model = navigationWorld()
  const state = reduceViewer(model, {
    ...initialState(model),
    focus: 'details',
  }, 'dismiss')

  assert.equal(state.panes.details, true)
  assert.equal(state.focus, 'architecture')

  const nested = reduceViewer(model, {
    ...initialState(model),
    level: 'components',
    currentId: 'observed:pleft',
    focus: 'details',
  }, 'dismiss')
  assert.equal(nested.level, 'components')
  assert.equal(nested.currentId, 'observed:pleft')
  assert.equal(nested.panes.details, true)
  assert.equal(nested.focus, 'architecture')
})

test.concurrent('search follows matches live and cancel restores the prior view', async () => {
  const model = await terminalModel(viewerFixtureRoot)
  const search = createArchitectureSearch(model.elements)
  const before = initialState(model)
  let state = reduceSearch(model, search, before, { type: 'open' })
  for (const char of 'view') state = reduceSearch(model, search, state, { type: 'char', char })
  const matches = state.search?.matches ?? []
  assert.deepEqual(
    matches.map(element => element.representationId).sort(),
    ['order-page', 'order-viewer', 'stock-page', 'stock-viewer'],
  )

  assert.equal(state.currentId, matches[0]!.representationId)
  assert.equal(state.level, 'context')
  state = reduceSearch(model, search, state, { type: 'next' })
  assert.equal(state.currentId, matches[1]!.representationId)

  const cancelled = reduceSearch(model, search, state, { type: 'cancel' })
  assert.equal(cancelled.search, undefined)
  assert.equal(cancelled.currentId, before.currentId)
})

test.concurrent('flow selection, step, and clear share one navigation state', () => {
  const model = actionWorld()
  let state: ViewerState = {
    ...initialState(model),
    currentId: 'observed:buyer',
    focus: 'details',
  }

  state = reduceViewer(model, state, 'down')
  assert.equal(state.activeActionId, undefined)
  state = reduceViewer(model, state, 'enter')
  assert.ok(state.activeActionId)
  assert.equal(litAction(model, state).actorId, 'observed:buyer')
  const committed = state.activeActionId

  state = reduceViewer(model, state, 'dismiss')
  assert.equal(litAction(model, state).id, committed)
  state = reduceViewer(model, state, 'step-action')
  assert.equal(state.actionStep, 0)
  state = reduceViewer(model, state, 'clear-action')
  assert.equal(state.activeActionId, undefined)
  assert.equal(state.actionStep, undefined)
})

test.concurrent('a one-row rectangle overlap selects the nearer card outside the centre cone', () => {
  const a = { x: 0, y: 0, width: 10, height: 8 }
  const b = { x: 11, y: 7, width: 10, height: 12 }
  const c = { x: 30, y: 0, width: 10, height: 8 }
  const anchors = new Map([['a', a], ['b', b], ['c', c]])
  assert.equal(nearestInDirection(anchors, 'a', a, 'right'), 'b')
  assert.equal(nearestInDirection(anchors, 'b', b, 'left'), 'a')
})

test.concurrent('flow browsing preserves container scope, toggling opens root and clearing restores selection', () => {
  const model = actionWorld()
  const flow = worldCommands(model).at(-1)!
  const before = { ...initialState(model), level: 'components' as const, currentId: 'observed:api' }
  let state = { ...before, focus: 'hierarchy' as const, tree: { ...before.tree, cursor: flow.id } }
  state = reduceViewer(model, state, 'up') as typeof state
  assert.equal(state.activeActionId, undefined)
  assert.equal(state.level, 'components')
  state = reduceViewer(model, state, 'toggle-selection') as typeof state
  assert.ok(state.activeActionId)
  assert.equal(state.level, 'context')
  assert.equal(state.currentId, before.currentId)
  const cleared = reduceViewer(model, state, 'clear-action')
  assert.equal(litAction(model, cleared).id, undefined)
  assert.equal(cleared.currentId, before.currentId)
  assert.equal(cleared.level, before.level)
  const unchecked = reduceViewer(model, state, 'enter')
  assert.equal(unchecked.activeActionId, undefined)
  assert.equal(unchecked.level, before.level)
})

test.concurrent('a launcher flow lights its approach and downstream legs across container boundaries', () => {
  const model = actionWorld()
  assert.deepEqual(litLegs(model, { id: 'api-web' }).map(leg => leg.id), ['buyer-api', 'api-web'])
  const state = { ...initialState(model), focus: 'hierarchy' as const, tree: { ...initialState(model).tree, cursor: 'api-web' } }
  const active = reduceViewer(model, state, 'enter')
  const browsed = reduceViewer(model, active, 'down')
  assert.equal(browsed.activeActionId, active.activeActionId)
  const replaced = reduceViewer(model, browsed, 'toggle-selection')
  assert.notEqual(replaced.activeActionId, active.activeActionId)
  assert.deepEqual(replaced.beforeFlow, active.beforeFlow)
})

test.concurrent('Work focus keeps architecture and flow state while tasks own the side panes', () => {
  const base = actionWorld()
  const model = {
    ...base,
    work: {
      statuses: ['To Do', 'In Progress', 'Done'],
      defaultStatus: 'To Do',
      items: [
        {
          id: 'TASK-1', title: 'First', status: 'In Progress', assignees: [], references: ['api'], modifiedFiles: [],
          acceptanceCriteriaCompleted: 0, acceptanceCriteriaCount: 0, updatedAt: '2026-08-30T12:00:00Z',
        },
        {
          id: 'TASK-2', title: 'Second', status: 'In Progress', assignees: [], references: ['web'], modifiedFiles: [],
          acceptanceCriteriaCompleted: 0, acceptanceCriteriaCount: 0, updatedAt: '2026-08-30T12:00:00Z',
        },
      ],
    },
  }
  const before: ViewerState = {
    ...initialState(model),
    currentId: 'observed:product',
    focus: 'hierarchy',
    panes: { hierarchy: true, details: false },
    detailsScroll: 4,
    activeActionId: 'buyer-api',
    actionCursor: 'buyer-api',
  }

  let state = reduceViewer(model, before, 'toggle-work')
  assert.equal(state.currentId, before.currentId)
  assert.equal(state.focus, 'hierarchy')
  assert.equal(selectedWorkId(state.work), 'TASK-1')
  assert.equal(litAction(model, state).id, undefined)

  state = reduceViewer(model, state, 'down')
  assert.equal(selectedWorkId(state.work), 'TASK-2')
  state = reduceViewer(model, state, 'enter')
  assert.equal(state.focus, 'details')

  state = reduceViewer(model, state, 'toggle-work')
  assert.equal(state.work, undefined)
  assert.equal(state.currentId, before.currentId)
  assert.equal(state.focus, 'architecture')
  assert.deepEqual(state.panes, before.panes)
  assert.equal(state.detailsScroll, before.detailsScroll)
  assert.equal(state.actionCursor, before.actionCursor)
  assert.equal(litAction(model, state).id, 'buyer-api')
})

test.concurrent('component Tasks and global Work open the same record, diff and architecture reference', () => {
  const model = { ...navigationWorld(), work: {
    statuses: ['To Do', 'In Progress', 'Done'], defaultStatus: 'To Do', items: [{
      id: 'TASK-1', title: 'Change a component', status: 'In Progress', assignees: [],
      references: ['pmid'], modifiedFiles: ['src/change.ts'],
      acceptanceCriteriaCompleted: 1, acceptanceCriteriaCount: 2, updatedAt: '2026-09-04T12:00:00Z',
    }],
  } }
  const before: ViewerState = { ...initialState(model), currentId: 'observed:pmid', level: 'components', focus: 'details' }
  let component = reduceViewer(model, before, 'tab')
  component = reduceViewer(model, component, 'tab')
  assert.equal(component.detailsTab, 'tasks')
  component = reduceViewer(model, component, 'down')
  component = reduceViewer(model, component, 'down')
  component = reduceViewer(model, component, 'enter')
  const global = reduceViewer(model, reduceViewer(model, initialState(model), 'toggle-work'), 'enter')
  assert.deepEqual(component.taskRecord, global.taskRecord)
  assert.equal(selectedWorkId(component.work), selectedWorkId(global.work))
  assert.equal(component.currentId, before.currentId)
  component = { ...component, taskRecord: { id: 'TASK-1', row: 0, details: { id: 'TASK-1', description: '', acceptanceCriteria: [], definitionOfDone: [], implementationPlan: '', implementationNotes: '', comments: [] } } }
  const rows = taskRecordView(viewerTheme(), model.work.items[0]!, component.taskRecord!.details, detailsContentWidth(component), undefined)
  const readTo = (id: string) => {
    const row = rows.ids!.indexOf(id)
    assert.ok(row >= 0)
    while (component.taskRecord!.row < row) component = reduceViewer(model, component, 'down')
  }
  readTo('src/change.ts')
  component = reduceViewer(model, component, 'enter')
  assert.equal(component.diffView?.file, 'src/change.ts')
  assert.equal(component.taskRecord?.id, 'TASK-1')
  component = reduceViewer(model, component, 'dismiss')
  readTo('pmid')
  component = reduceViewer(model, component, 'enter')
  assert.equal(component.work, undefined)
  assert.equal(component.taskRecord, undefined)
  assert.equal(component.currentId, 'observed:pmid')
  assert.equal(component.level, 'components')
})

test.concurrent('actor details toggle the same flow as the hierarchy without following it or changing tabs', () => {
  const model = actionWorld()
  let state: ViewerState = { ...initialState(model), currentId: 'observed:buyer', focus: 'details' }
  state = reduceViewer(model, state, 'down')
  const flow = state.actionCursor
  assert.ok(worldCommands(model).some(command => command.id === flow))
  state = reduceViewer(model, state, 'enter')
  assert.equal(state.activeActionId, flow)
  assert.equal(state.currentId, 'observed:buyer')
  state = reduceViewer(model, state, 'tab')
  assert.equal(state.detailsTab, 'what')
  assert.equal(state.focus, 'details')
  state = reduceViewer(model, state, 'enter')
  assert.equal(state.activeActionId, undefined)
  assert.equal(state.currentId, 'observed:buyer')
})

test.concurrent('folding the Backlog hierarchy leaves map arrows usable', () => {
  const model = actionWorld()
  const before = initialState(model)
  let state = reduceViewer(model, before, 'toggle-work')
  state = reduceViewer(model, state, 'toggle-hierarchy')
  assert.equal(state.focus, 'architecture')
  const expected = reduceViewer(model, before, 'down')
  state = reduceViewer(model, state, 'down')
  assert.equal(state.currentId, expected.currentId)
  assert.notEqual(state.currentId, before.currentId)
  assert.equal(state.focus, 'architecture')
})

test.concurrent('How navigates declarations while What toggles component flow participation', () => {
  const base = navigationWorld()
  const model = { ...base, relationships: [uses('read', 'ann', 'pleft')] }
  let state: ViewerState = {
    ...initialState(model), currentId: 'observed:pleft', focus: 'details', detailsTab: 'how',
    codeStructure: { elementId: 'observed:pleft', files: [{ file: 'src/part.ts', declarations: [
      { kind: 'function', name: 'run', line: 8, scope: 'export', entry: true },
      { kind: 'function', name: 'save', line: 18, scope: 'export', entry: false },
    ] }] },
  }
  assert.deepEqual(detailsCommands(model, state), [])
  state = reduceViewer(model, state, 'down')
  assert.equal(state.actionCursor, 'src/part.ts:8')
  state = reduceViewer(model, state, 'down')
  assert.equal(state.actionCursor, 'src/part.ts:18')
  state = reduceViewer(model, state, 'up')
  state = reduceViewer(model, state, 'enter')
  assert.equal(state.sourceView?.line, 8)
  state = reduceViewer(model, state, 'dismiss')
  state = { ...state, focus: 'details', detailsTab: 'what', actionCursor: undefined }
  assert.deepEqual(detailsCommands(model, state).map(item => item.id), ['read'])
  state = reduceViewer(model, state, 'down')
  assert.equal(state.activeActionId, undefined)
  state = reduceViewer(model, state, 'enter')
  assert.equal(state.activeActionId, 'read')
  assert.equal(state.activeActionActorId, undefined)
  state = reduceViewer(model, state, 'enter')
  assert.equal(state.activeActionId, undefined)
  assert.equal(state.currentId, 'observed:pleft')
})
