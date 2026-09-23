import { expect, test } from 'bun:test'
import { LineRuns, type RunEnds } from '../src/sheet/route/order.ts'

// A run heading north joins its vertical line at the high end and has the -1 (west) side on its left; a run heading
// east joins its horizontal line at the low end and has the -1 (north) side on its left.
const north: RunEnds = { joinedAtLow: false, left: -1 }
const east: RunEnds = { joinedAtLow: true, left: -1 }

test.concurrent('a route that joins a shared line first crosses the other route only when it also leaves last', () => {
  const placed = new LineRuns()
  // Comes from the west at y = 10, runs north and turns east at y = 0.
  placed.add(0, [{ line: 0, low: 0, high: 10, lowSide: 1, highSide: -1 }])
  expect(placed.crossings({ line: 0, low: 2, high: 12, lowSide: 1, highSide: -1 }, north, undefined)).toBe(0)
  expect(placed.crossings({ line: 0, low: -2, high: 12, lowSide: 1, highSide: -1 }, north, undefined)).toBe(1)
})

test.concurrent('routes that turn a corner together keep their order round it', () => {
  const placed = new LineRuns()
  // Comes from the west at y = 10, turns east at (100, 0) and turns north again at x = 200.
  placed.add(0, [{ line: 0, low: 0, high: 10, lowSide: 1, highSide: -1 }, { line: 1, low: 100, high: 200, lowSide: 1, highSide: -1 }])
  // Comes from the east at y = 5, so it runs on the east side of the placed route, and takes the same corner.
  expect(placed.crossings({ line: 0, low: 0, high: 5, lowSide: 1, highSide: 1 }, north, undefined)).toBe(0)
  const carried = placed.carry
  // Past the corner it runs on the south side: turning south is free, turning north crosses the placed route.
  expect(placed.crossings({ line: 1, low: 100, high: 150, lowSide: 1, highSide: 1 }, east, carried)).toBe(0)
  expect(placed.crossings({ line: 1, low: 100, high: 150, lowSide: 1, highSide: -1 }, east, carried)).toBe(1)
})
