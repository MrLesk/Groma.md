import assert from 'node:assert/strict'

import { test } from 'bun:test'

import type { Camera } from '../src/viewers/web/iso/camera/camera.ts'
import { createCameraLayer } from '../src/viewers/web/iso/camera/layer.ts'

// The layer asks the page for a div and animation frames. These stubs stay in this file because the repository check
// runs bun test --parallel, which gives each test file its own globals; a plain bun test run would share them.
Object.assign(globalThis, {
  document: { createElement: () => ({ style: {}, offsetWidth: 0 }) },
  requestAnimationFrame: (frame: FrameRequestCallback) => setTimeout(() => frame(performance.now()), 16),
})

const view = (k: number, x = 0) => ({ camera: { k, x, y: 0 }, zoomRatio: k })

/** A layer showing a map drawn at scale 1; it records every camera it draws from then on. */
function drawnLayer() {
  const drawn: Camera[] = []
  let settle = (): void => {}
  const layer = createCameraLayer({ drawCamera: ({ camera }) => { drawn.push(camera) }, moveStarted() {}, settled: () => settle() })
  layer.move(view(1))
  drawn.length = 0
  /** Resolves when the map next settles. */
  const settled = () => new Promise<void>(resolve => { settle = resolve })
  return { layer, drawn, settled }
}

test.concurrent('a pan moves the cached picture without drawing', async () => {
  const { layer, drawn, settled } = drawnLayer()
  layer.move(view(1, 10))
  layer.move(view(1, 20))
  await settled()
  assert.equal(drawn.length, 0)
})

test.concurrent('a zoom-in draws its scale once the map settles', async () => {
  const { layer, drawn, settled } = drawnLayer()
  layer.move(view(1.5))
  layer.move(view(2))
  assert.equal(drawn.length, 0)
  await settled()
  assert.deepEqual(drawn.map(camera => camera.k), [2])
})

test.concurrent('a zoom-out navigation draws its destination once, before it moves', async () => {
  const { layer, drawn, settled } = drawnLayer()
  layer.approach(view(0.5))
  assert.deepEqual(drawn.map(camera => camera.k), [0.5])
  layer.move(view(0.8))
  layer.move(view(0.5))
  await settled()
  assert.deepEqual(drawn.map(camera => camera.k), [0.5])
})

test.concurrent('the move after a repaint draws the camera at once', async () => {
  const { layer, drawn, settled } = drawnLayer()
  layer.invalidate()
  layer.move(view(1, 10))
  assert.deepEqual(drawn.map(camera => camera.x), [10])
  await settled()
  assert.deepEqual(drawn.map(camera => camera.x), [10])
})
