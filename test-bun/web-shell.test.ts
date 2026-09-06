import assert from 'node:assert/strict'

import { test } from 'bun:test'

import { createDetailsExpansion, mapFrame } from '../src/viewers/web/chrome/shell.ts'

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

test.concurrent('file inspection widens the reader until an explicit panel choice is made', () => {
  const panel = createDetailsExpansion()
  assert.equal(panel.expanded(false), false)
  assert.equal(panel.expanded(true), true)
  assert.equal(panel.expanded(false), false)

  panel.toggle(true)
  assert.equal(panel.expanded(true), false)
  assert.equal(panel.expanded(false), false)
  // Reopening another source or diff cannot override the explicit compact choice.
  assert.equal(panel.expanded(true), false)
})

test.concurrent('manual expansion belongs to the panel across content and file returns', () => {
  const panel = createDetailsExpansion()
  panel.toggle(false)
  assert.equal(panel.expanded(false), true)
  assert.equal(panel.expanded(true), true)
  assert.equal(panel.expanded(false), true)
  panel.toggle(false)
  assert.equal(panel.expanded(false), false)
  assert.equal(panel.expanded(true), false)
})
