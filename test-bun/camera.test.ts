import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { createTestRenderer } from '@opentui/core/testing'

import { loadArchitectureViewModel } from '../src/core.ts'
import { createCamera } from '../src/viewers/tui/camera.ts'
import { mountTerminalViewer } from '../src/viewers/tui/terminal-viewer.ts'
import { fitLayer, followSelection, projectWorld } from '../src/viewers/tui/projection.ts'
import {
  mapViewportOf,
  press,
  projectedById,
  repositoryRoot,
  requiredElement,
  visible,
} from './helpers.ts'

test.concurrent('camera tweens zoom in log space with ease-in-out cubic', () => {
  const camera = createCamera({ zoom: 1, centerX: 0, centerY: 0 })
  camera.startTween({ zoom: Math.E, centerX: 10, centerY: 4 }, 1000)
  camera.update(250)
  assert.equal(camera.isAnimating(), true)
  assert.equal(camera.zoom, Math.exp(0.0625))
  assert.equal(camera.centerX, 0.625)
  assert.equal(camera.centerY, 0.25)
  camera.update(750)
  assert.equal(camera.zoom, Math.E)
  assert.equal(camera.centerX, 10)
  assert.equal(camera.isAnimating(), false)
  camera.startTween({ zoom: 1, centerX: 0, centerY: 0 }, 1000)
  camera.snapTo({ zoom: 2, centerX: 1, centerY: 1 })
  assert.equal(camera.isAnimating(), false)
  assert.equal(camera.zoom, 2)
})

test.concurrent('opening map fits the whole world and zoom stays inside its bounds', async () => {
  const response = await loadArchitectureViewModel(repositoryRoot)
  const viewport = mapViewportOf({ width: 120, height: 36 })
  const start = projectWorld(response.world, { viewport })
  assert.equal(start.camera.zoom, start.fitZoom)
  assert.ok(start.camera.zoom < 1)
  const byId = projectedById(start.elements)
  for (const id of [
    'observed:groma',
    'observed:git',
    'observed:human-architect',
    'observed:coding-agent',
  ]) {
    assert.ok(visible(requiredElement(byId, id).cellBounds, start.viewport), id)
  }
  const closer = projectWorld(response.world, {
    viewport,
    camera: {
      ...start.camera,
      zoom: Math.min(1, start.camera.zoom * 1.25),
    },
  })
  assert.ok(closer.camera.zoom > start.camera.zoom)
  assert.equal(closer.level, 'context')
  assert.ok(closer.camera.zoom <= 1)

  const setup = await createTestRenderer({ width: 120, height: 36 })
  const app = mountTerminalViewer(setup.renderer, response)
  await setup.renderOnce()
  const first = setup.captureCharFrame()
  const zoomed = await press(setup, '+')
  assert.notEqual(zoomed, first)
  await press(setup, '-')
  const rezoomed = await press(setup, '+')
  assert.equal(rezoomed, zoomed)
  app.destroy()
})

test.concurrent('camera follows selection across levels with the outer zoom rule', async () => {
  const response = await loadArchitectureViewModel(repositoryRoot)
  const from = {
    level: 'components' as const,
    currentId: 'observed:world-layout',
  }
  const model = {
    level: 'components' as const,
    currentId: 'observed:architecture-model',
  }
  const workspace = {
    level: 'containers' as const,
    currentId: 'observed:cli',
  }
  const core = {
    level: 'containers' as const,
    currentId: 'observed:core',
  }
  const viewport = mapViewportOf({ width: 120, height: 36 })
  const tight = fitLayer(response.world, viewport, from.level, from.currentId)
  assert.deepEqual(
    tight,
    fitLayer(response.world, viewport, model.level, model.currentId),
  )
  assert.deepEqual(
    fitLayer(response.world, viewport, core.level, core.currentId),
    fitLayer(response.world, viewport, workspace.level, workspace.currentId),
  )
  assert.equal(
    followSelection(response.world, viewport, from, model, tight),
    undefined,
  )
  const sibling = followSelection(
    response.world,
    viewport,
    from,
    workspace,
    tight,
  )
  assert.ok(sibling)
  assert.equal(sibling.zoom, Math.min(tight.zoom, fitLayer(
    response.world,
    viewport,
    workspace.level,
    workspace.currentId,
  ).zoom))
  const zoomedOut = followSelection(
    response.world,
    viewport,
    from,
    core,
    tight,
  )
  assert.ok(zoomedOut)
  assert.ok(zoomedOut.zoom < tight.zoom)
  assert.equal(zoomedOut.zoom, sibling.zoom)
})
