import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { createTestRenderer } from '@opentui/core/testing'

import { loadArchitectureViewModel } from '../src/core.ts'
import { mountTerminalViewer } from '../src/viewers/tui/terminal-viewer.ts'
import { MAP_SCALE } from '../src/viewers/tui/projection-camera.ts'
import { projectWorld } from '../src/viewers/tui/projection.ts'
import {
  mapViewportOf,
  press,
  projectedById,
  requiredElement,
  viewerFixtureRoot,
  visible,
} from './helpers.ts'

test.concurrent('the map keeps one readable scale and ignores zoom keys', async () => {
  const response = await loadArchitectureViewModel(viewerFixtureRoot)
  const viewport = mapViewportOf({ width: 120, height: 36 })
  for (const view of [
    { level: 'context' as const, currentId: 'observed:shop' },
    { level: 'components' as const, currentId: 'observed:orders' },
  ]) {
    const projection = projectWorld(response.world, { viewport, ...view })
    assert.equal(projection.camera.zoom, MAP_SCALE)
  }

  const setup = await createTestRenderer({ width: 120, height: 36 })
  const app = mountTerminalViewer(setup.renderer, response)
  await setup.renderOnce()
  const first = setup.captureCharFrame()
  assert.equal(await press(setup, '+'), first)
  assert.equal(await press(setup, '-'), first)
  app.destroy()
})

test.concurrent('selection keeps the world fixed and pans only to stay visible', async () => {
  const response = await loadArchitectureViewModel(viewerFixtureRoot)
  const before = structuredClone(response.world)
  const viewport = mapViewportOf({ width: 120, height: 36 })
  const start = projectWorld(response.world, {
    viewport,
    level: 'context',
    currentId: 'observed:shop',
  })
  const moved = projectWorld(response.world, {
    viewport,
    level: 'context',
    currentId: 'observed:shop-architect',
    camera: start.camera,
  })
  assert.equal(moved.camera.zoom, MAP_SCALE)
  assert.ok(visible(
    requiredElement(projectedById(moved.elements), 'observed:shop-architect').cellBounds,
    viewport,
  ))
  assert.deepEqual(response.world, before)
})
