import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { projectWorld } from '../src/viewers/tui/projection.ts'
import { attachRoute, routeBetween } from '../src/viewers/tui/projection-routes.ts'
import { box, mapViewportOf, uses, worldOf } from './helpers.ts'

function assertOrthogonal(points: readonly { x: number; y: number }[]): void {
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!
    const point = points[index]!
    assert.ok(previous.x === point.x || previous.y === point.y)
  }
}

test.concurrent('route attachment clips shapes and preserves orthogonal segments', () => {
  const source = { x: 0, y: 0, width: 10, height: 6 }
  const target = { x: 30, y: 10, width: 10, height: 6 }
  const route = attachRoute([
    { x: 5, y: 3 },
    { x: 15, y: 3 },
    { x: 15, y: 13 },
    { x: 35, y: 13 },
  ], source, target)

  assertOrthogonal(route)
  assert.equal(route[0]!.x, source.x + source.width)
  assert.equal(route.at(-1)!.x, target.x - 1)
  assertOrthogonal(routeBetween(source, target))
})

test.concurrent('root routes promote hidden component endpoints to their containers', () => {
  const model = worldOf([
    box('system', 'system', { x: 0, y: 0, width: 1, height: 1 }, {
      children: ['observed:left', 'observed:right'],
    }),
    box('left', 'container', { x: 0, y: 0, width: 1, height: 1 }, {
      parent: 'observed:system',
      children: ['observed:a'],
    }),
    box('right', 'container', { x: 0, y: 0, width: 1, height: 1 }, {
      parent: 'observed:system',
      children: ['observed:b'],
    }),
    box('a', 'component', { x: 0, y: 0, width: 1, height: 1 }, { parent: 'observed:left' }),
    box('b', 'component', { x: 0, y: 0, width: 1, height: 1 }, { parent: 'observed:right' }),
  ], [uses('a-uses-b', 'a', 'b')])

  const projection = projectWorld(model, {
    viewport: mapViewportOf({ width: 120, height: 36 }),
  })
  const route = projection.relationships[0]
  assert.ok(route)
  assert.equal(route.source, 'observed:left')
  assert.equal(route.target, 'observed:right')
  assertOrthogonal(route.worldRoute)
})
