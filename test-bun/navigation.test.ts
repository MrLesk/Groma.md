import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { loadArchitectureViewModel } from '../src/core.ts'
import {
  defaultSelection,
  filterMatches,
  initialState,
  reduceFilter,
  reduceViewer,
} from '../src/viewers/tui/navigation.ts'
import type { ViewerState } from '../src/viewers/tui/navigation.ts'
import type { ArchitectureWorld } from '../src/types.ts'
import { initialTree } from '../src/viewers/tui/tree.ts'
import { navigationWorld, repositoryRoot } from './helpers.ts'

function viewOf(state: ViewerState): Pick<ViewerState, 'level' | 'currentId'> {
  return { level: state.level, currentId: state.currentId }
}

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
  }
  assert.equal(reduceViewer(world, state, 'right').currentId, 'observed:cright')

  state = {
    level: 'components',
    currentId: 'observed:pright',
    focus: 'architecture',
    tree: initialTree(),
    panes: { hierarchy: true, details: true },
    detailsScroll: 0,
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
  const response = await loadArchitectureViewModel(repositoryRoot)
  const world = response.world

  const viewerMatches = filterMatches(world, 'VIEW')
  assert.deepEqual(
    viewerMatches.map(element => element.representationId).sort(),
    ['observed:terminal-viewer', 'observed:web-viewer'],
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

test.concurrent('a person action stays on after leaving details and x clears it', () => {
  const box = (
    id: string,
    kind: 'person' | 'container',
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
  const world: ArchitectureWorld = {
    bounds: { x: 0, y: 0, width: 20, height: 10 },
    groups: [],
    elements: [box('buyer', 'person'), box('api', 'container'), box('web', 'container')],
    relationships: [
      {
        id: 'buyer-api',
        source: 'buyer',
        target: 'api',
        description: 'sends',
        technology: 'https',
        origin: 'observed' as const,
        route: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
        label: null,
      },
      {
        id: 'buyer-web',
        source: 'buyer',
        target: 'web',
        description: 'reads',
        technology: 'https',
        origin: 'observed' as const,
        route: [{ x: 0, y: 0 }, { x: 2, y: 0 }],
        label: null,
      },
    ],
  }
  let state: ViewerState = {
    ...initialState(world),
    currentId: 'buyer',
    focus: 'details',
  }
  state = reduceViewer(world, state, 'down')
  assert.equal(state.activeActionId, 'buyer-api')
  state = reduceViewer(world, state, 'down')
  assert.equal(state.activeActionId, 'buyer-web')
  state = reduceViewer(world, state, 'left')
  assert.equal(state.focus, 'architecture')
  assert.equal(state.activeActionId, 'buyer-web')
  state = reduceViewer(world, { ...state, currentId: 'api', focus: 'details' }, 'down')
  assert.equal(state.activeActionId, 'buyer-web')
  assert.equal(state.detailsScroll, 1)
  state = reduceViewer(world, { ...state, currentId: 'buyer', focus: 'details' }, 'up')
  assert.equal(state.activeActionId, 'buyer-api')
  state = reduceViewer(world, state, 'dismiss')
  assert.equal(state.focus, 'architecture')
  assert.equal(state.activeActionId, 'buyer-api')
  state = reduceViewer(world, state, 'clear-action')
  assert.equal(state.activeActionId, undefined)
})
