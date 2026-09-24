import assert from 'node:assert/strict'

import { test } from 'bun:test'

import type { IsoMap } from '../src/viewers/web/iso/painting/map.ts'
import { bindMapPointer } from '../src/viewers/web/iso/camera/pointer.ts'

/** The map pane reduced to what the gesture binding touches; every press lands on the empty sheet at the pane's origin. */
function mapPane() {
  const listeners = new Map<string, (event: object) => void>()
  const svg = { addEventListener: (type: string, listener: (event: object) => void) => { listeners.set(type, listener) }, setPointerCapture() {} }
  const map = { svg, hitId: () => undefined, isSheet: () => true, isProjectEdit: () => false, dragging() {} } as unknown as IsoMap
  const host = { addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0 }) } as unknown as HTMLElement
  const calls: unknown[] = []
  bindMapPointer(host, map, {
    orbiting: () => false,
    hold() {},
    pan: (dx, dy) => { calls.push(['pan', dx, dy]) },
    glide() {},
    orbit: (dx, dy) => { calls.push(['orbit', dx, dy]) },
    zoom: (factor, point) => { calls.push(['zoom', factor, point]) },
    select: id => { calls.push(['select', id]) },
    deselect: () => { calls.push(['deselect']) },
    editProject: () => { calls.push(['editProject']) },
  })
  const fire = (type: string, pointerId: number, clientX: number, clientY: number) => {
    listeners.get(type)?.({ pointerId, clientX, clientY, button: 0, shiftKey: false })
  }
  return { calls, fire }
}

test.concurrent('two fingers zoom about their midpoint without selecting, and the finger left keeps panning', () => {
  const pinch = mapPane()
  pinch.fire('pointerdown', 1, 100, 100)
  pinch.fire('pointerdown', 2, 140, 100)
  pinch.fire('pointermove', 2, 180, 100)
  pinch.fire('pointerup', 2, 180, 100)
  pinch.fire('pointermove', 1, 90, 100)
  pinch.fire('pointerup', 1, 90, 100)
  assert.deepEqual(pinch.calls, [
    ['pan', 20, 0],
    ['zoom', 2, { x: 140, y: 100 }],
    ['pan', -10, 0],
  ])

  const tap = mapPane()
  tap.fire('pointerdown', 1, 100, 100)
  tap.fire('pointerdown', 2, 140, 100)
  tap.fire('pointerup', 2, 140, 100)
  tap.fire('pointerup', 1, 100, 100)
  assert.deepEqual(tap.calls, [])
})
