import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { loadArchitectureViewModel } from '../src/core.ts'
import {
  defaultSelection,
  filterMatches,
  initialState,
  litAction,
  reduceFilter,
  reduceViewer,
} from '../src/viewers/tui/navigation.ts'
import type { ViewerState } from '../src/viewers/tui/navigation.ts'
import type { ArchitectureWorld } from '../src/types.ts'
import { initialTree } from '../src/viewers/tui/tree.ts'
import { navigationWorld, viewerFixtureRoot } from './helpers.ts'

function viewOf(state: ViewerState): Pick<ViewerState, 'level' | 'currentId'> {
  return { level: state.level, currentId: state.currentId }
}

const box = (
  id: string,
  kind: 'actor' | 'container',
  parent: string | null = null,
) => ({
  representationId: id,
  id,
  kind,
  name: id,
  description: '',
  parent,
  children: [] as string[],
  external: false,
  code: [],
  origin: 'observed' as const,
  bounds: { x: 0, y: 0, width: 8, height: 8 },
})

const edge = (id: string, source: string, target: string) => ({
  id,
  source,
  target,
  description: id,
  technology: '',
  origin: 'observed' as const,
  route: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
  label: null,
})

test.concurrent('unit navigation covers selection, level changes, and spatial movement', () => {
  const world = navigationWorld()
  assert.equal(defaultSelection(world, 'context')?.representationId, 'observed:alpha')
  assert.notEqual(world.elements[0]?.representationId, 'observed:alpha')

  let state = initialState(world)
  assert.deepEqual(state, {
    level: 'context',
    currentId: 'observed:alpha',
    focus: 'architecture',
    tree: initialTree(),
    panes: { hierarchy: true, details: true },
    detailsScroll: 0,
    detailsTab: 'what' as const,
  })

  assert.deepEqual(viewOf(reduceViewer(world, state, 'enter')), {
    level: 'containers',
    currentId: 'observed:cleft',
  })
  assert.equal(
    reduceViewer(world, { ...state, currentId: 'observed:ann' }, 'enter').focus,
    'details',
  )
  assert.equal(
    reduceViewer(world, { ...state, currentId: 'observed:ext' }, 'enter').focus,
    'details',
  )
  assert.equal(
    reduceViewer(world, { ...state, currentId: 'observed:empty' }, 'enter').focus,
    'details',
  )
  assert.deepEqual(
    viewOf(reduceViewer(world, {
      level: 'components',
      currentId: 'observed:pleft',
      focus: 'architecture',
      tree: initialTree(),
      panes: { hierarchy: true, details: true },
      detailsScroll: 0,
      detailsTab: 'what' as const,
    }, 'enter')),
    { level: 'components', currentId: 'observed:pleft' },
  )

  state = reduceViewer(world, state, 'enter')
  assert.deepEqual(viewOf(reduceViewer(world, state, 'leave')), {
    level: 'context',
    currentId: 'observed:alpha',
  })
  state = reduceViewer(world, {
    ...state,
    currentId: 'observed:cleft',
  }, 'enter')
  assert.deepEqual(viewOf(state), { level: 'components', currentId: 'observed:pleft' })
  assert.deepEqual(viewOf(reduceViewer(world, state, 'leave')), {
    level: 'containers',
    currentId: 'observed:cleft',
  })
  assert.deepEqual(viewOf(reduceViewer(world, initialState(world), 'leave')), {
    level: 'context',
    currentId: 'observed:alpha',
  })

  state = {
    level: 'containers',
    currentId: 'observed:cleft',
    focus: 'architecture',
    tree: initialTree(),
    panes: { hierarchy: true, details: true },
    detailsScroll: 0,
    detailsTab: 'what' as const,
  }
  assert.equal(reduceViewer(world, state, 'right').currentId, 'observed:cright')

  state = {
    level: 'components',
    currentId: 'observed:pright',
    focus: 'architecture',
    tree: initialTree(),
    panes: { hierarchy: true, details: true },
    detailsScroll: 0,
    detailsTab: 'what' as const,
  }
  assert.deepEqual(viewOf(reduceViewer(world, state, 'right')), {
    level: 'containers',
    currentId: 'observed:cfar',
  })

  state = {
    level: 'components',
    currentId: 'observed:pfar',
    focus: 'architecture',
    tree: initialTree(),
    panes: { hierarchy: true, details: true },
    detailsScroll: 0,
    detailsTab: 'what' as const,
  }
  assert.deepEqual(viewOf(reduceViewer(world, state, 'right')), {
    level: 'context',
    currentId: 'observed:ext',
  })

  state = {
    level: 'components',
    currentId: 'observed:pleft',
    focus: 'architecture',
    tree: initialTree(),
    panes: { hierarchy: true, details: true },
    detailsScroll: 0,
    detailsTab: 'what' as const,
  }
  const escaped = reduceViewer(world, state, 'left')
  assert.deepEqual(viewOf(escaped), { level: 'context', currentId: 'observed:ann' })
  assert.notEqual(escaped.currentId, 'observed:alpha')
  assert.notEqual(escaped.currentId, 'observed:cleft')

  state = {
    level: 'context',
    currentId: 'observed:ann',
    focus: 'architecture',
    tree: initialTree(),
    panes: { hierarchy: false, details: true },
    detailsScroll: 0,
    detailsTab: 'what' as const,
  }
  const toTree = reduceViewer(world, state, 'left')
  assert.deepEqual(viewOf(toTree), { level: 'context', currentId: 'observed:ann' })
  assert.equal(toTree.focus, 'hierarchy')
  assert.equal(toTree.tree.cursor, 'observed:ann')
  assert.equal(toTree.panes.hierarchy, true)

  const toDetails = reduceViewer(world, {
    ...state,
    currentId: 'observed:ext',
    panes: { hierarchy: true, details: false },
  }, 'right')
  assert.deepEqual(viewOf(toDetails), { level: 'context', currentId: 'observed:ext' })
  assert.equal(toDetails.focus, 'details')
  assert.equal(toDetails.panes.details, true)

  let details = reduceViewer(world, toDetails, 'down')
  details = reduceViewer(world, details, 'down')
  assert.equal(details.detailsScroll, 2)
  details = reduceViewer(world, details, 'up')
  details = reduceViewer(world, details, 'up')
  details = reduceViewer(world, details, 'up')
  assert.equal(details.detailsScroll, 0)
  details = reduceViewer(world, { ...details, detailsScroll: 3 }, 'left')
  assert.equal(details.focus, 'architecture')
  const moved = reduceViewer(world, details, 'left')
  assert.equal(moved.detailsScroll, 0)

  const hidden = reduceViewer(world, toDetails, 'toggle-details')
  assert.equal(hidden.focus, 'architecture')
  assert.equal(hidden.panes.details, false)
})

test.concurrent('the filter narrows by name, drives selection live, and restores on cancel', async () => {
  const response = await loadArchitectureViewModel(viewerFixtureRoot)
  const world = response.world

  const viewerMatches = filterMatches(world, 'VIEW')
  assert.deepEqual(
    viewerMatches.map(element => element.representationId).sort(),
    ['observed:order-viewer', 'observed:stock-viewer'],
  )
  assert.deepEqual(filterMatches(world, ''), [])
  assert.deepEqual(filterMatches(world, 'no such thing'), [])

  let state = {
    ...initialState(world),
    panes: { hierarchy: false, details: false },
  }
  const before = { level: state.level, currentId: state.currentId }

  state = reduceFilter(world, state, { type: 'open' })
  assert.ok(state.filter)
  for (const char of 'view') {
    state = reduceFilter(world, state, { type: 'char', char })
  }
  assert.equal(state.currentId, viewerMatches[0]?.representationId)
  assert.equal(state.level, 'containers')

  const firstMatch = viewerMatches[0]?.representationId
  const secondMatch = viewerMatches[1]?.representationId
  state = reduceFilter(world, state, { type: 'next' })
  assert.equal(state.currentId, secondMatch)
  assert.equal(state.level, 'containers')
  state = reduceFilter(world, state, { type: 'previous' })
  assert.equal(state.currentId, firstMatch)

  state = reduceFilter(world, state, { type: 'char', char: 'q' })
  assert.equal(state.currentId, firstMatch)
  state = reduceFilter(world, state, { type: 'delete' })
  assert.equal(state.filter?.query, 'view')

  const cancelled = reduceFilter(world, state, { type: 'cancel' })
  assert.equal(cancelled.filter, undefined)
  assert.equal(cancelled.level, before.level)
  assert.equal(cancelled.currentId, before.currentId)

  const accepted = reduceFilter(world, state, { type: 'accept' })
  assert.equal(accepted.filter, undefined)
  assert.equal(accepted.currentId, firstMatch)
  assert.equal(accepted.level, 'containers')
})

test.concurrent('leave from details returns to the map and the parent Enter opened', () => {
  const world = navigationWorld()
  let state = initialState(world)
  state = reduceViewer(world, state, 'enter')
  state = reduceViewer(world, state, 'enter')
  state = reduceViewer(world, state, 'enter')
  assert.equal(state.focus, 'details')
  assert.deepEqual(viewOf(state), { level: 'components', currentId: 'observed:pleft' })
  const dismissed = reduceViewer(world, state, 'dismiss')
  assert.equal(dismissed.focus, 'architecture')
  assert.deepEqual(viewOf(dismissed), { level: 'components', currentId: 'observed:pleft' })
  state = reduceViewer(world, state, 'leave')
  assert.equal(state.focus, 'architecture')
  assert.deepEqual(viewOf(state), { level: 'containers', currentId: 'observed:cleft' })
})

test.concurrent('an actor action stays on after leaving details and x clears it', () => {
  const world: ArchitectureWorld = {
    bounds: { x: 0, y: 0, width: 20, height: 10 },
    groups: [],
    elements: [box('buyer', 'actor'), box('api', 'container'), box('web', 'container')],
    relationships: [
      edge('buyer-api', 'buyer', 'api'),
      edge('buyer-web', 'buyer', 'web'),
    ],
  }
  let state: ViewerState = {
    ...initialState(world),
    currentId: 'buyer',
    focus: 'details',
  }
  // Browsing moves the cursor without lighting a path.
  state = reduceViewer(world, state, 'down')
  assert.equal(state.actionCursor, 'buyer-api')
  assert.equal(state.activeActionId, undefined)
  state = reduceViewer(world, state, 'down')
  assert.equal(state.actionCursor, 'buyer-web')
  assert.equal(state.activeActionId, undefined)
  // Enter picks the command under the cursor.
  state = reduceViewer(world, state, 'enter')
  assert.equal(state.activeActionId, 'buyer-web')
  state = reduceViewer(world, state, 'left')
  assert.equal(state.focus, 'architecture')
  assert.equal(state.activeActionId, 'buyer-web')
  // A selection without commands scrolls instead of moving the cursor.
  state = reduceViewer(world, { ...state, currentId: 'api', focus: 'details' }, 'down')
  assert.equal(state.activeActionId, 'buyer-web')
  assert.equal(state.detailsScroll, 1)
  state = reduceViewer(world, { ...state, currentId: 'buyer', focus: 'details' }, 'up')
  state = reduceViewer(world, state, 'enter')
  assert.equal(state.activeActionId, 'buyer-api')
  state = reduceViewer(world, state, 'dismiss')
  assert.equal(state.focus, 'architecture')
  assert.equal(state.activeActionId, 'buyer-api')
  state = reduceViewer(world, state, 'clear-action')
  assert.equal(state.activeActionId, undefined)
})

test.concurrent('s traces the active walk one leg at a time and wraps', () => {
  const world: ArchitectureWorld = {
    bounds: { x: 0, y: 0, width: 20, height: 10 },
    groups: [],
    elements: [box('buyer', 'actor'), box('api', 'container'), box('web', 'container')],
    // buyer uses api and web, making api a launcher, so picking its api-web
    // command walks buyer-api then api-web.
    relationships: [
      edge('buyer-api', 'buyer', 'api'),
      edge('buyer-web', 'buyer', 'web'),
      edge('api-web', 'api', 'web'),
    ],
  }
  let state: ViewerState = { ...initialState(world), currentId: 'buyer' }

  // Without an active command s does nothing.
  assert.equal(reduceViewer(world, state, 'step-action').actionStep, undefined)

  state = { ...state, activeActionId: 'api-web' }
  state = reduceViewer(world, state, 'step-action')
  assert.equal(state.actionStep, 0)
  state = reduceViewer(world, state, 'step-action')
  assert.equal(state.actionStep, 1)
  state = reduceViewer(world, state, 'step-action')
  assert.equal(state.actionStep, 0)

  // Picking a command again restarts the trace; x removes it with the path.
  state = reduceViewer(world, {
    ...state,
    focus: 'details',
    actionCursor: 'api-web',
  }, 'enter')
  assert.equal(state.activeActionId, 'api-web')
  assert.equal(state.actionStep, undefined)
  state = reduceViewer(world, state, 'step-action')
  state = reduceViewer(world, state, 'clear-action')
  assert.equal(state.activeActionId, undefined)
  assert.equal(state.actionStep, undefined)
})

test.concurrent('t flips the details tab and How lists travelled-by picks', () => {
  const world: ArchitectureWorld = {
    bounds: { x: 0, y: 0, width: 20, height: 10 },
    groups: [],
    elements: [box('buyer', 'actor'), box('api', 'container'), box('web', 'container')],
    // buyer uses api and web, so api is a launcher and api-web its command.
    relationships: [
      edge('buyer-api', 'buyer', 'api'),
      edge('buyer-web', 'buyer', 'web'),
      edge('api-web', 'api', 'web'),
    ],
  }
  let state: ViewerState = { ...initialState(world), currentId: 'web' }
  assert.equal(state.detailsTab, 'what')

  state = reduceViewer(world, { ...state, detailsScroll: 3 }, 'toggle-details-tab')
  assert.equal(state.detailsTab, 'how')
  assert.equal(state.detailsScroll, 0)

  // The tab survives moving the selection.
  state = reduceViewer(world, { ...state, focus: 'architecture' }, 'left')
  assert.equal(state.detailsTab, 'how')

  // On How, the details cursor walks the commands that travel the element.
  state = reduceViewer(world, { ...state, currentId: 'web', focus: 'details' }, 'down')
  assert.equal(state.actionCursor, 'api-web')
  state = reduceViewer(world, state, 'enter')
  assert.equal(state.activeActionId, 'api-web')
  // A travelled-by pick has no picking actor.
  assert.equal(state.activeActionActorId, undefined)

  // On What, a non-actor selection scrolls instead.
  state = reduceViewer(world, state, 'toggle-details-tab')
  assert.equal(state.detailsTab, 'what')
  state = reduceViewer(world, { ...state, actionCursor: undefined }, 'down')
  assert.equal(state.detailsScroll, 1)
  assert.equal(state.actionCursor, undefined)
})

test.concurrent('a details pick scopes the walk to that actor; a flows pick does not', () => {
  const world: ArchitectureWorld = {
    bounds: { x: 0, y: 0, width: 20, height: 10 },
    groups: [],
    elements: [
      box('buyer', 'actor'),
      box('ops', 'actor'),
      box('api', 'container'),
      box('web', 'container'),
    ],
    // buyer and ops both use the api launcher, so both expose api-web.
    relationships: [
      edge('buyer-api', 'buyer', 'api'),
      edge('buyer-web', 'buyer', 'web'),
      edge('ops-api', 'ops', 'api'),
      edge('ops-web', 'ops', 'web'),
      edge('api-web', 'api', 'web'),
    ],
  }
  let state: ViewerState = {
    ...initialState(world),
    currentId: 'buyer',
    focus: 'details',
    actionCursor: 'api-web',
  }
  state = reduceViewer(world, state, 'enter')
  assert.equal(state.activeActionId, 'api-web')
  assert.equal(state.activeActionActorId, 'buyer')

  // The scoped walk has two legs (buyer's approach, then the command),
  // so a third step wraps; the other actor's approach is not walked.
  state = reduceViewer(world, state, 'step-action')
  state = reduceViewer(world, state, 'step-action')
  state = reduceViewer(world, state, 'step-action')
  assert.equal(state.actionStep, 0)

  state = reduceViewer(world, state, 'clear-action')
  assert.equal(state.activeActionActorId, undefined)

  // The flows list has no actor context: the pick keeps the whole walk.
  state = reduceViewer(world, {
    ...state,
    focus: 'hierarchy',
    tree: { ...state.tree, cursor: 'api-web' },
  }, 'enter')
  assert.equal(state.activeActionId, 'api-web')
  assert.equal(state.activeActionActorId, undefined)
})

test.concurrent('browsing details previews a walk; only Enter keeps it', () => {
  const world: ArchitectureWorld = {
    bounds: { x: 0, y: 0, width: 20, height: 10 },
    groups: [],
    elements: [
      box('buyer', 'actor'),
      box('api', 'container'),
      box('web', 'container'),
      box('jobs', 'container'),
    ],
    relationships: [
      edge('buyer-api', 'buyer', 'api'),
      edge('buyer-web', 'buyer', 'web'),
      edge('api-web', 'api', 'web'),
      edge('api-jobs', 'api', 'jobs'),
    ],
  }
  let state: ViewerState = { ...initialState(world), currentId: 'buyer', focus: 'details' }
  assert.deepEqual(litAction(world, state), { id: undefined, actorId: undefined })

  // Browsing lights the row under the cursor, scoped to the actor.
  state = reduceViewer(world, state, 'down')
  assert.equal(state.actionCursor, 'api-web')
  assert.deepEqual(litAction(world, state), { id: 'api-web', actorId: 'buyer' })
  assert.equal(state.activeActionId, undefined)
  state = reduceViewer(world, state, 'down')
  assert.deepEqual(litAction(world, state), { id: 'api-jobs', actorId: 'buyer' })

  // Leaving without Enter drops the preview: nothing was committed.
  const left = reduceViewer(world, state, 'dismiss')
  assert.equal(left.focus, 'architecture')
  assert.deepEqual(litAction(world, left), { id: undefined, actorId: undefined })

  // Enter commits, so the walk survives leaving the pane.
  state = reduceViewer(world, state, 'enter')
  assert.equal(state.activeActionId, 'api-jobs')
  const kept = reduceViewer(world, state, 'dismiss')
  assert.deepEqual(litAction(world, kept), { id: 'api-jobs', actorId: 'buyer' })

  // Browsing again previews over the commitment without replacing it.
  let browsing = reduceViewer(world, { ...kept, focus: 'details' }, 'up')
  assert.deepEqual(litAction(world, browsing), { id: 'api-web', actorId: 'buyer' })
  assert.equal(browsing.activeActionId, 'api-jobs')
  browsing = reduceViewer(world, browsing, 'dismiss')
  assert.deepEqual(litAction(world, browsing), { id: 'api-jobs', actorId: 'buyer' })

  // A How-tab preview is a walk reference, so it carries no actor scope.
  const how = reduceViewer(world, {
    ...state,
    currentId: 'web',
    focus: 'details',
    detailsTab: 'how',
    actionCursor: undefined,
  }, 'down')
  assert.deepEqual(litAction(world, how), { id: 'api-web', actorId: undefined })
})

test.concurrent('the hierarchy cursor reaches the flow rows and Enter lights one', () => {
  const world: ArchitectureWorld = {
    bounds: { x: 0, y: 0, width: 20, height: 10 },
    groups: [],
    elements: [box('buyer', 'actor'), box('api', 'container'), box('web', 'container')],
    relationships: [
      edge('buyer-api', 'buyer', 'api'),
      edge('buyer-web', 'buyer', 'web'),
      edge('api-web', 'api', 'web'),
    ],
  }
  let state: ViewerState = { ...initialState(world), currentId: 'buyer' }
  state = reduceViewer(world, state, 'tab')
  assert.equal(state.focus, 'hierarchy')
  assert.equal(state.tree.cursor, 'buyer')

  // Up from the first tree row crosses onto the flow row above it.
  state = reduceViewer(world, state, 'up')
  assert.equal(state.tree.cursor, 'api-web')
  state = reduceViewer(world, state, 'enter')
  assert.equal(state.activeActionId, 'api-web')
  assert.equal(state.actionStep, undefined)
  assert.equal(state.focus, 'hierarchy')

  // Right on a flow row returns to the map; Down returns to the tree.
  assert.equal(reduceViewer(world, state, 'right').focus, 'architecture')
  state = reduceViewer(world, state, 'down')
  assert.equal(state.tree.cursor, 'buyer')
  state = reduceViewer(world, state, 'enter')
  assert.equal(state.currentId, 'buyer')
  assert.equal(state.activeActionId, 'api-web')
})
