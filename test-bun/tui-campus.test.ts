import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { loadArchitectureViewModel } from '../src/core.ts'
import { MAP_SCALE } from '../src/viewers/tui/projection-camera.ts'
import { letterName } from '../src/viewers/tui/projection-display.ts'
import { projectWorld } from '../src/viewers/tui/projection.ts'
import { initialState, reduceViewer } from '../src/viewers/tui/navigation.ts'
import {
  containersFixtureRoot,
  mapViewportOf,
  openclawFixtureRoot,
  projectedById,
  requiredElement,
} from './helpers.ts'

test.concurrent('root names systems and containers but hides component cards', async () => {
  const { world } = await loadArchitectureViewModel(openclawFixtureRoot)
  const projection = projectWorld(world, {
    viewport: mapViewportOf({ width: 120, height: 36 }),
    level: 'context',
    currentId: 'observed:openclaw',
  })
  const byId = projectedById(projection.elements)
  const system = requiredElement(byId, 'observed:openclaw')

  assert.equal(projection.camera.zoom, MAP_SCALE)
  assert.equal(system.display, 'system-boundary')
  assert.equal(letterName(system, 'context'), true)

  for (const element of world.elements) {
    const painted = requiredElement(byId, element.representationId)
    if (element.parent === system.representationId) {
      assert.equal(painted.display, 'container-boundary', element.id)
      assert.equal(letterName(painted, 'context'), true, element.id)
    }
    if (element.kind === 'component') {
      assert.equal(painted.display, 'hidden', element.id)
    }
    if (element.kind === 'actor' || element.external) {
      assert.equal(painted.display, 'card', element.id)
    }
  }
})

test.concurrent('Enter replaces root with the selected container children', async () => {
  const { world } = await loadArchitectureViewModel(containersFixtureRoot)
  const container = world.elements.find(element => {
    return element.kind === 'container' && element.children.length > 0
  })
  assert.ok(container)

  let state = initialState(world)
  state = { ...state, currentId: container.representationId }
  state = reduceViewer(world, state, 'enter')
  assert.equal(state.level, 'components')
  assert.ok(container.children.includes(state.currentId!))

  const projection = projectWorld(world, {
    viewport: mapViewportOf({ width: 120, height: 36 }),
    level: state.level,
    currentId: state.currentId,
  })
  const byId = projectedById(projection.elements)
  const boundary = requiredElement(byId, container.representationId)
  assert.equal(boundary.display, 'container-boundary')
  assert.equal(letterName(boundary, 'components'), true)

  for (const element of world.elements) {
    const painted = requiredElement(byId, element.representationId)
    const directChild = element.parent === container.representationId
    if (directChild) {
      assert.equal(painted.display, 'card', element.id)
      assert.equal(letterName(painted, 'components'), true, element.id)
    } else if (element.representationId !== container.representationId) {
      assert.equal(painted.display, 'hidden', element.id)
    }
  }

  state = reduceViewer(world, state, 'leave')
  assert.equal(state.level, 'context')
  assert.equal(state.currentId, container.representationId)
})
