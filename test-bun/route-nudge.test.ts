import { expect, test } from 'bun:test'
import type { Point } from '../src/sheet/route/geometry.ts'
import type { Box } from '../src/sheet/route/graph.ts'
import { nudgeRoutes } from '../src/sheet/route/nudge.ts'
import { BUNDLE_SPACING } from '../src/sheet/route/space.ts'

// Two routes share the line y = 100 between their ports; the inner one leaves it first.
function sharedLine(): Point[][] {
  return [
    [{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 400, y: 100 }, { x: 400, y: 0 }],
    [{ x: 10, y: 0 }, { x: 10, y: 100 }, { x: 390, y: 100 }, { x: 390, y: 0 }],
  ]
}

const ends = [0, 10].map(x => ({
  source: { key: `source-${x}`, span: [x - 20, x + 20] as [number, number] },
  target: { key: `target-${x}`, span: [400 - x - 20, 400 - x + 20] as [number, number] },
}))

test.concurrent('routes sharing a roomy channel line spread to the bundle spacing around it', () => {
  const routes = sharedLine()
  nudgeRoutes(routes, [], ends)
  const [outer, inner] = routes.map(points => points[1]!.y)
  expect(outer! - inner!).toBeCloseTo(BUNDLE_SPACING, 6)
  expect((outer! + inner!) / 2).toBeCloseTo(100, 6)
})

test.concurrent('a narrow channel shrinks the spacing only as far as its walls require', () => {
  const walls: Box[] = [{ x0: 100, x1: 300, y0: 40, y1: 97 }, { x0: 100, x1: 300, y0: 103, y1: 160 }]
  const routes = sharedLine()
  nudgeRoutes(routes, walls, ends)
  const [outer, inner] = routes.map(points => points[1]!.y)
  expect(inner).toBeCloseTo(97, 6)
  expect(outer).toBeCloseTo(103, 6)
})
