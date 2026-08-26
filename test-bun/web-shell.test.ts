import assert from 'node:assert/strict'

import { test } from 'bun:test'

import { mapFrame } from '../src/viewers/web/chrome/shell.ts'

const map = { left: 10, top: 20, right: 1010, bottom: 720, width: 1000, height: 700 }
const header = { left: 10, top: 20, right: 1010, bottom: 82, width: 1000, height: 62 }
const hierarchy = { left: 10, top: 94, right: 290, bottom: 720, width: 280, height: 626 }
const details = { left: 710, top: 94, right: 1010, bottom: 720, width: 300, height: 626 }

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
