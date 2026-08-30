import assert from 'node:assert/strict'
import { test } from 'bun:test'

import type { SheetScene } from '../src/sheet/types.ts'
import type { ArchitectureGraph } from '../src/types.ts'
import { framesPerSecond, mapDebugSnapshot, mapDebugValues } from '../src/viewers/web/chrome/map-debug.ts'

test.concurrent('FPS samples round the frame rate across their elapsed window', () => {
  assert.equal(framesPerSecond(30, 500), 60)
  assert.equal(framesPerSecond(37, 625), 59)
})

test.concurrent('map debug formats and refreshes one generation snapshot without changing its map', () => {
  const world = {
    elements: Array.from({ length: 3 }, () => ({})),
    relationships: Array.from({ length: 2 }, () => ({})),
  } as unknown as ArchitectureGraph
  const sheet = {
    sheet: { gx: 0, gy: 0, w: 4.26, d: 5.04 },
    islands: [{}],
    zones: [{}],
    slabs: [{}],
    buildings: [{}, {}],
    routes: [{ points: [{}, {}, {}] }, { points: [{}, {}] }],
  } as unknown as SheetScene
  const before = structuredClone({ world, sheet })
  const snapshot = mapDebugSnapshot({
    generation: 7,
    timings: {
      architectureLoadMilliseconds: 11,
      placementMilliseconds: 5,
      routingMilliseconds: 40,
      totalMilliseconds: 53,
    },
    world,
    sheet,
  }, { projectionMilliseconds: 2, paintMilliseconds: 3 })

  const { sheetCells, ...counts } = snapshot.counts
  assert.deepEqual(counts, {
    elements: 3,
    relationships: 2,
    buildings: 2,
    routes: 2,
    routePoints: 5,
    surfaces: 3,
    sheetWidth: 4.26,
    sheetHeight: 5.04,
  })
  assert.equal(sheetCells, sheet.sheet.w * sheet.sheet.d)
  assert.equal(snapshot.generation, 7)
  assert.deepEqual(mapDebugValues(snapshot), {
    total: '53.0 ms',
    architecture: '11.0 ms',
    placement: '5.0 ms',
    routing: '40.0 ms',
    projection: '2.0 ms',
    paint: '3.0 ms',
    generation: '7',
    elements: '3',
    relationships: '2',
    buildings: '2',
    surfaces: '3',
    routes: '2',
    routePoints: '5',
    sheet: '4.3 × 5.0',
    sheetCells: '21',
  })
  assert.deepEqual(
    mapDebugValues({ ...snapshot, generation: 8, timings: { ...snapshot.timings, totalMilliseconds: 145.5 } }),
    { ...mapDebugValues(snapshot), generation: '8', total: '146 ms' },
  )
  assert.deepEqual({ world, sheet }, before)
})
