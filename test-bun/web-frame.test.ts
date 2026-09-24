import assert from 'node:assert/strict'

import { test } from 'bun:test'

import { mapFrame } from '../src/viewers/web/chrome/frame.ts'

const map = { left: 10, top: 20, right: 1010, bottom: 720, width: 1000, height: 700 }
const header = { left: 10, top: 20, right: 1010, bottom: 82, width: 1000, height: 62 }
const hierarchy = { left: 10, top: 94, right: 290, bottom: 720, width: 280, height: 626 }
const details = { left: 710, hidden: false }

test.concurrent('the HUD reserves a safe camera frame between its panes', () => {
  assert.deepEqual(mapFrame(map, header, hierarchy, details, true), {
    x: 292,
    y: 74,
    width: 396,
    height: 614,
  })
})

test.concurrent('map-only mode gives the camera the complete viewport', () => {
  assert.deepEqual(mapFrame(map, header, hierarchy, details, false), {
    x: 0,
    y: 0,
    width: 1000,
    height: 700,
  })
})

test.concurrent('opening details immediately reserves its final layout width', () => {
  const closed = mapFrame(map, header, hierarchy, { ...details, hidden: true }, true)
  const opened = mapFrame(map, header, hierarchy, details, true)
  assert.equal(closed.x, opened.x)
  assert.equal(closed.width, map.width - closed.x)
  assert.equal(opened.x + opened.width, details.left - map.left - 12)
})

test.concurrent('the welcome card over an empty map moves the camera frame below it', () => {
  const card = { bottom: 400 }
  for (const hudVisible of [true, false]) {
    const open = mapFrame(map, header, hierarchy, details, hudVisible)
    const below = mapFrame(map, header, hierarchy, details, hudVisible, card)
    assert.equal(below.y, card.bottom - map.top + 12)
    assert.equal(below.y + below.height, open.y + open.height)
    assert.deepEqual([below.x, below.width], [open.x, open.width])
  }
})
