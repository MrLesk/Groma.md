import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { createArchitectureSearch } from '../src/search.ts'
import {
  defaultSelection,
  initialState,
  litAction,
  reduceViewer,
  type ViewerState,
} from '../src/viewers/tui/navigation.ts'
import { reduceSearch } from '../src/viewers/tui/navigation-search.ts'
import { selectedWorkId } from '../src/viewers/tui/work/model.ts'
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
      // The island row west to east: actors, north, system, south, external.
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
      buildings: model.sheet.buildings.map(building => ({
        ...building,
        rect: { gx: 2, gy: 54, w: 12, d: 10 },
      })),
    },
  }
}

test.concurrent('map navigation enters only containers and returns to the same container', () => {
  const model = navigationWorld()
  assert.equal(defaultSelection(model, 'context')?.representationId, 'observed:alpha')

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

test.concurrent('map edges lead to the fixed hierarchy and details panes', () => {
  const model = navigationWorld()
  const left = reduceViewer(model, {
    ...initialState(model),
    currentId: 'observed:ann',
  }, 'left')
  assert.equal(left.focus, 'hierarchy')
  assert.equal(left.tree.cursor, 'observed:ann')

  const right = reduceViewer(model, {
    ...initialState(model),
    currentId: 'observed:ext',
    panes: { hierarchy: true, details: false },
  }, 'right')
  assert.equal(right.focus, 'details')
  assert.equal(right.panes.details, true)
})

test.concurrent('container arrows follow the lines of buildings', () => {
  const model = laneNavigationWorld()
  let state: ViewerState = { ...initialState(model), level: 'components', currentId: 'observed:a', mapWidth: 40 }

  // Right reads on: along the line, then onto the next line.
  state = reduceViewer(model, state, 'right')
  assert.equal(state.currentId, 'observed:b')
  state = reduceViewer(model, state, 'right')
  assert.equal(state.currentId, 'observed:c')
  state = reduceViewer(model, state, 'left')
  assert.equal(state.currentId, 'observed:b')
  state = reduceViewer(model, state, 'down')
  assert.equal(state.currentId, 'observed:d')
  state = reduceViewer(model, state, 'up')
  assert.equal(state.currentId, 'observed:b')
  // Past the last building with no neighbouring container, the map hands over to the pane.
  assert.equal(reduceViewer(model, { ...state, currentId: 'observed:d' }, 'right').focus, 'details')
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

test.concurrent('dismiss closes details and returns container scope to the root map', () => {
  const model = navigationWorld()
  const state = reduceViewer(model, {
    ...initialState(model),
    focus: 'details',
  }, 'dismiss')

  assert.equal(state.panes.details, false)
  assert.equal(state.focus, 'architecture')

  const nested = reduceViewer(model, {
    ...initialState(model),
    level: 'components',
    currentId: 'observed:pleft',
    focus: 'details',
  }, 'dismiss')
  assert.equal(nested.level, 'context')
  assert.equal(nested.currentId, 'observed:cleft')
  assert.equal(nested.panes.details, false)
  assert.equal(nested.focus, 'architecture')
})

test.concurrent('search follows matches live and cancel restores the prior view', async () => {
  const model = await terminalModel(viewerFixtureRoot)
  const search = createArchitectureSearch(model.elements)
  let state = reduceSearch(model, search, initialState(model), { type: 'open' })
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
  assert.equal(cancelled.currentId, 'shop')
})

test.concurrent('flow preview, commit, step, and clear share one navigation state', () => {
  const model = actionWorld()
  let state: ViewerState = {
    ...initialState(model),
    currentId: 'observed:buyer',
    focus: 'details',
  }

  state = reduceViewer(model, state, 'down')
  assert.equal(state.activeActionId, undefined)
  assert.equal(litAction(model, state).actorId, 'observed:buyer')
  state = reduceViewer(model, state, 'enter')
  assert.ok(state.activeActionId)
  const committed = state.activeActionId

  state = reduceViewer(model, state, 'dismiss')
  assert.equal(litAction(model, state).id, committed)
  state = reduceViewer(model, state, 'step-action')
  assert.equal(state.actionStep, 0)
  state = reduceViewer(model, state, 'clear-action')
  assert.equal(state.activeActionId, undefined)
  assert.equal(state.actionStep, undefined)
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
  assert.equal(state.focus, before.focus)
  assert.deepEqual(state.panes, before.panes)
  assert.equal(state.detailsScroll, before.detailsScroll)
  assert.equal(state.actionCursor, before.actionCursor)
  assert.equal(litAction(model, state).id, 'buyer-api')
})
