import assert from 'node:assert/strict'
import { test } from 'bun:test'

import {
  defaultSelection,
  filterMatches,
  initialState,
  litAction,
  reduceFilter,
  reduceViewer,
  type ViewerState,
} from '../src/viewers/tui/navigation.ts'
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

function laneNavigationWorld() {
  const ids = ['top-left', 'top-right', 'middle-left', 'bottom-left', 'middle-right']
  const model = worldOf([
    box('system', 'system', { x: 0, y: 0, width: 1, height: 1 }, {
      children: ['observed:container'],
    }),
    box('container', 'container', { x: 0, y: 0, width: 1, height: 1 }, {
      parent: 'observed:system',
      children: ids.map(id => `observed:${id}`),
    }),
    ...ids.map(id => box(id, 'component', { x: 0, y: 0, width: 1, height: 1 }, {
      parent: 'observed:container',
    })),
  ])
  const rects = new Map([
    ['observed:top-left', { gx: 10, gy: 5, w: 6, d: 4 }],
    ['observed:top-right', { gx: 20, gy: 5, w: 6, d: 4 }],
    ['observed:middle-left', { gx: 10, gy: 11, w: 6, d: 4 }],
    ['observed:bottom-left', { gx: 11, gy: 17, w: 6, d: 4 }],
    ['observed:middle-right', { gx: 24, gy: 11, w: 6, d: 4 }],
  ])
  return {
    ...model,
    sheet: {
      ...model.sheet,
      buildings: model.sheet.buildings.map(building => ({
        ...building,
        rect: rects.get(building.representationId) ?? building.rect,
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
        if (island.element?.id === 'system') {
          return { ...island, rect: { gx: 20, gy: 20, w: 72, d: 80 } }
        }
        if (island.element?.id === 'north') {
          return { ...island, rect: { gx: 20, gy: 0, w: 72, d: 10 } }
        }
        if (island.element?.id === 'south') {
          return { ...island, rect: { gx: 20, gy: 110, w: 72, d: 10 } }
        }
        return island
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
    panes: { details: false },
  }, 'right')
  assert.equal(right.focus, 'details')
  assert.equal(right.panes.details, true)
})

test.concurrent('map navigation follows visual rows and columns before diagonals', () => {
  const model = laneNavigationWorld()
  let state: ViewerState = {
    ...initialState(model),
    level: 'components',
    currentId: 'observed:top-right',
  }

  state = reduceViewer(model, state, 'left')
  assert.equal(state.currentId, 'observed:top-left')
  state = reduceViewer(model, state, 'right')
  assert.equal(state.currentId, 'observed:top-right')

  state = { ...state, currentId: 'observed:top-left' }
  state = reduceViewer(model, state, 'down')
  assert.equal(state.currentId, 'observed:middle-left')
  state = reduceViewer(model, state, 'down')
  assert.equal(state.currentId, 'observed:bottom-left')
})

test.concurrent('map navigation stays with directional siblings before crossing a boundary', () => {
  const model = containmentNavigationWorld()
  const start: ViewerState = {
    ...initialState(model),
    currentId: 'observed:lower',
  }

  const up = reduceViewer(model, start, 'up')
  assert.equal(up.currentId, 'observed:upper')

  const boundary = reduceViewer(model, start, 'left')
  assert.equal(boundary.currentId, 'observed:system')
  const outside = reduceViewer(model, boundary, 'left')
  assert.equal(outside.currentId, 'observed:actor')

  let inward: ViewerState = {
    ...initialState(model),
    currentId: 'observed:actor',
  }
  inward = reduceViewer(model, inward, 'right')
  assert.equal(inward.currentId, 'observed:system')
  inward = reduceViewer(model, inward, 'right')
  assert.equal(inward.currentId, 'observed:lower')

  let reverse: ViewerState = {
    ...initialState(model),
    currentId: 'observed:external',
  }
  reverse = reduceViewer(model, reverse, 'left')
  assert.equal(reverse.currentId, 'observed:system')
  reverse = reduceViewer(model, reverse, 'left')
  assert.equal(reverse.currentId, 'observed:lower')

  let downward: ViewerState = {
    ...initialState(model),
    currentId: 'observed:north',
  }
  downward = reduceViewer(model, downward, 'down')
  assert.equal(downward.currentId, 'observed:system')
  downward = reduceViewer(model, downward, 'down')
  assert.equal(downward.currentId, 'observed:upper')

  let upward: ViewerState = {
    ...initialState(model),
    currentId: 'observed:south',
  }
  upward = reduceViewer(model, upward, 'up')
  assert.equal(upward.currentId, 'observed:system')
  upward = reduceViewer(model, upward, 'up')
  assert.equal(upward.currentId, 'observed:lower')
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
  const matches = filterMatches(model, 'VIEW')
  assert.deepEqual(
    matches.map(element => element.representationId).sort(),
    ['observed:order-viewer', 'observed:stock-viewer'],
  )

  let state = reduceFilter(model, initialState(model), { type: 'open' })
  for (const char of 'view') state = reduceFilter(model, state, { type: 'char', char })
  assert.equal(state.currentId, matches[0]!.representationId)
  assert.equal(state.level, 'context')
  state = reduceFilter(model, state, { type: 'next' })
  assert.equal(state.currentId, matches[1]!.representationId)

  const cancelled = reduceFilter(model, state, { type: 'cancel' })
  assert.equal(cancelled.filter, undefined)
  assert.equal(cancelled.currentId, 'observed:shop')
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
        { id: 'TASK-1', title: 'First', status: 'In Progress', assignees: [], description: '', references: ['api'], modifiedFiles: [], criteria: [] },
        { id: 'TASK-2', title: 'Second', status: 'In Progress', assignees: [], description: '', references: ['web'], modifiedFiles: [], criteria: [] },
      ],
    },
  }
  const before: ViewerState = {
    ...initialState(model),
    currentId: 'observed:product',
    focus: 'hierarchy',
    panes: { details: false },
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
