import assert from 'node:assert/strict'

import { test } from 'bun:test'

import type { IsoMap } from '../src/viewers/web/iso/map.ts'
import { bindMapPointer } from '../src/viewers/web/iso/pointer.ts'

/** The map pane reduced to what the gesture binding touches; every press lands on the empty sheet at the pane's origin. */
function mapPane(orbiting = false) {
  const listeners = new Map<string, (event: object) => void>()
  const svg = { addEventListener: (type: string, listener: (event: object) => void) => { listeners.set(type, listener) }, setPointerCapture() {} }
  const map = { svg, hitId: () => undefined, isSheet: () => true, isProjectEdit: () => false, dragging() {} } as unknown as IsoMap
  const host = { addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0 }) } as unknown as HTMLElement
  const calls: unknown[] = []
  bindMapPointer(host, map, {
    orbiting: () => orbiting,
    hold: () => { calls.push(['hold']) },
    pan: (dx, dy) => { calls.push(['pan', dx, dy]) },
    glide: velocity => { calls.push(['glide', velocity]) },
    orbit: (dx, dy) => { calls.push(['orbit', dx, dy]) },
    zoom: (factor, point) => { calls.push(['zoom', factor, point]) },
    select: id => { calls.push(['select', id]) },
    deselect: () => { calls.push(['deselect']) },
    editProject: () => { calls.push(['editProject']) },
  })
  const fire = (type: string, pointerId: number, clientX: number, clientY: number, timeStamp = 0) => {
    listeners.get(type)?.({ pointerId, clientX, clientY, timeStamp, button: 0, shiftKey: false })
  }
  return { calls, fire }
}

test.concurrent('two fingers zoom about their midpoint without selecting, and the finger left keeps panning without a glide', () => {
  const pinch = mapPane()
  pinch.fire('pointerdown', 1, 100, 100)
  pinch.fire('pointerdown', 2, 140, 100)
  pinch.fire('pointermove', 2, 180, 100)
  pinch.fire('pointerup', 2, 180, 100)
  pinch.fire('pointermove', 1, 90, 100)
  pinch.fire('pointerup', 1, 90, 100)
  assert.deepEqual(pinch.calls, [
    ['hold'],
    ['pan', 20, 0],
    ['zoom', 2, { x: 140, y: 100 }],
    ['pan', -10, 0],
  ])

  const tap = mapPane()
  tap.fire('pointerdown', 1, 100, 100)
  tap.fire('pointerdown', 2, 140, 100)
  tap.fire('pointerup', 2, 140, 100)
  tap.fire('pointerup', 1, 100, 100)
  assert.deepEqual(tap.calls, [['hold']])
})

test.concurrent('a drag released while moving glides at its recent speed; a pause before release, a tap or a Layers orbit does not glide', () => {
  const flick = mapPane()
  flick.fire('pointerdown', 1, 100, 100, 0)
  flick.fire('pointermove', 1, 120, 100, 16)
  flick.fire('pointermove', 1, 140, 110, 32)
  flick.fire('pointerup', 1, 140, 110, 40)
  assert.deepEqual(flick.calls, [
    ['hold'],
    ['pan', 20, 0],
    ['pan', 20, 10],
    ['glide', { x: 20 / 24, y: 10 / 24 }],
  ])

  const paused = mapPane()
  paused.fire('pointerdown', 1, 100, 100, 0)
  paused.fire('pointermove', 1, 140, 100, 16)
  paused.fire('pointerup', 1, 140, 100, 300)
  assert.deepEqual(paused.calls, [['hold'], ['pan', 40, 0]])

  const tap = mapPane()
  tap.fire('pointerdown', 1, 100, 100, 0)
  tap.fire('pointerup', 1, 101, 100, 50)
  assert.deepEqual(tap.calls, [['hold'], ['deselect']])

  const orbit = mapPane(true)
  orbit.fire('pointerdown', 1, 100, 100, 0)
  orbit.fire('pointermove', 1, 120, 100, 16)
  orbit.fire('pointerup', 1, 120, 100, 20)
  assert.deepEqual(orbit.calls, [['hold'], ['orbit', 20, 0]])
})
