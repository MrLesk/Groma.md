import assert from 'node:assert/strict'
import { test } from 'bun:test'

import type { TerminalViewModel } from '../src/viewers/tui/model.ts'
import { canEnter, enterView } from '../src/viewers/tui/navigation-spatial.ts'
import { initialState, reduceViewer, type MapDirection, type ViewerState } from '../src/viewers/tui/navigation.ts'
import { encloses, type TerminalCamera } from '../src/viewers/tui/projection-camera.ts'
import { paintedWorld } from '../src/viewers/tui/organisms/world.ts'
import { routeTouches, visibleIn } from '../src/viewers/tui/projection-camera.ts'
import { mapAnchors, projectWorld } from '../src/viewers/tui/projection.ts'
import { largeWorldFixtureRoot, paneLayout, terminalModel } from './helpers.ts'

const DIRECTIONS: MapDirection[] = ['up', 'down', 'left', 'right']
// Each test owns a clone; compose the large fixture only once.
const template = terminalModel(largeWorldFixtureRoot)
/** Every selection arrow keys alone can reach from a state without leaving the map or its level. */
function reachableByArrows(world: TerminalViewModel, start: ViewerState): Set<string> {
  const seen = new Set<string>()
  const visited = new Set<string>()
  const queue = [start]
  while (queue.length > 0) {
    const state = queue.shift()!
    const key = state.currentId ?? ''
    if (visited.has(key)) continue
    visited.add(key)
    if (state.currentId !== undefined) seen.add(state.currentId)
    for (const direction of DIRECTIONS) {
      const next = reduceViewer(world, state, direction)
      assert.equal(next.level, start.level, 'an arrow never changes scope')
      if (next.focus !== 'architecture') continue
      queue.push(next)
    }
  }
  return seen
}


test.concurrent('arrow keys reach every element of the root map and of every container map', async () => {
  const world = structuredClone(await template)
  const root = initialState(world)
  const rootAnchors = [...mapAnchors(world, 'context', undefined, root.mapWidth).keys()]
  const rootReached = reachableByArrows(world, root)
  assert.deepEqual(rootAnchors.filter(id => !rootReached.has(id)), [])

  for (const container of world.elements.filter(canEnter)) {
    const start = { ...root, ...enterView(world, container) }
    const anchors = [...mapAnchors(world, 'components', start.currentId, start.mapWidth).keys()]
    const reached = reachableByArrows(world, start)
    assert.deepEqual(anchors.filter(id => !reached.has(id)), [], `container ${container.id}`)
  }
})

test.concurrent('the painter visits only the items and routes that touch the viewport', async () => {
  const world = structuredClone(await template)
  const viewport = paneLayout(200, 60).mapViewport
  const projection = projectWorld(world, { viewport })
  const painted = paintedWorld(projection)
  assert.ok(painted.items.length > 0)
  assert.ok(painted.items.length < projection.items.length, 'the root map does not fit one viewport, so some items stay unpainted')
  assert.ok(painted.routes.length < projection.relationships.length, 'routes off the viewport stay unpainted')
  assert.ok(painted.items.every(item => visibleIn(item.cellBounds, viewport)))
})

test.concurrent('a route is painted when a segment crosses the viewport, not when only its box does', () => {
  const viewport = { x: 10, y: 10, width: 20, height: 10 }
  const through = [{ x: 0, y: 15 }, { x: 40, y: 15 }]
  const around = [{ x: 0, y: 5 }, { x: 40, y: 5 }, { x: 40, y: 25 }]
  assert.equal(routeTouches(through, viewport), true)
  assert.equal(routeTouches(around, viewport), false)
})

test.concurrent('arrow navigation keeps root framing and bounds component follow', async () => {
  const world = structuredClone(await template)
  const viewport = { x: 0, y: 0, width: 100, height: 20 }
  let state = { ...initialState(world), mapWidth: viewport.width }
  let camera: TerminalCamera | undefined
  let previousProjection: ReturnType<typeof projectWorld> | undefined
  const walk = ['down', 'down', 'down', 'right', 'right', 'down', 'down', 'down', 'down', 'down', 'down', 'up', 'left', 'enter',
    'right', 'right', 'right', 'right', 'right', 'down', 'down', 'right', 'right', 'up', 'left', 'left', 'left', 'left', 'left', 'left', 'left'] as const
  for (const action of walk) {
    const before = state
    state = reduceViewer(world, state, action)
    if (state.level !== before.level) camera = undefined
    const projection = projectWorld(world, { viewport, level: state.level, currentId: state.currentId, camera })
    const selected = projection.items.find(item => item.representationId === projection.currentId)!
    const holder = projection.items.find(item => (item.shape === 'island' || item.shape === 'slab') && encloses(item.worldBounds, selected.worldBounds))!
    if (state.level === 'components') {
      const bounds = projection.worldBounds
      assert.ok(projection.camera.x >= bounds.x && projection.camera.x + viewport.width <= bounds.x + bounds.width)
      assert.ok(projection.camera.y >= bounds.y && projection.camera.y + viewport.height <= bounds.y + bounds.height)
    } else if (projection.worldBounds.width > viewport.width) {
      assert.ok(Math.abs(holder.cellBounds.x + holder.cellBounds.width / 2 - viewport.width / 2) <= 1, `${action}: ${holder.title} off centre`)
    }
    assert.ok(selected.cellBounds.y >= 0 && selected.cellBounds.y + selected.cellBounds.height <= viewport.height, `${action}: ${selected.title} hidden`)
    if (previousProjection?.scope === projection.scope) {
      assert.deepEqual(
        projection.items.map(item => [item.key, item.worldBounds]),
        previousProjection.items.map(item => [item.key, item.worldBounds]),
        `${action}: world layout moved`,
      )
    }
    camera = projection.camera
    previousProjection = projection
  }
})
