import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { projectWorld } from '../src/viewers/tui/projection.ts'
import { routeBetween } from '../src/viewers/tui/projection-routes.ts'
import { box, mapViewportOf, uses, worldOf } from './helpers.ts'

function assertOrthogonal(points: readonly { x: number; y: number }[]): void {
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!
    const point = points[index]!
    assert.ok(previous.x === point.x || previous.y === point.y)
  }
}

test.concurrent('a route runs orthogonally from outside its source to outside its target', () => {
  const source = { x: 0, y: 0, width: 10, height: 6 }
  const target = { x: 30, y: 10, width: 10, height: 6 }
  const route = routeBetween(source, target)

  assertOrthogonal(route)
  // Out of the source's right side, one bend, down onto the target's top side.
  assert.equal(route[0]!.x, source.x + source.width)
  assert.equal(route.at(-1)!.y, target.y - 1)
})

test.concurrent('root routes promote hidden endpoints to their rows, leave on the row line and skip rows of one island', () => {
  const cell = { x: 0, y: 0, width: 1, height: 1 }
  const model = worldOf([
    box('system', 'system', cell, { children: ['observed:left', 'observed:other'] }),
    box('left', 'container', cell, { parent: 'observed:system', children: ['observed:a'] }),
    box('other', 'container', cell, { parent: 'observed:system', children: ['observed:c'] }),
    box('far', 'system', cell, { children: ['observed:right'] }),
    box('right', 'container', cell, { parent: 'observed:far', children: ['observed:b'] }),
    box('a', 'component', cell, { parent: 'observed:left' }),
    box('b', 'component', cell, { parent: 'observed:right' }),
    box('c', 'component', cell, { parent: 'observed:other' }),
  ], [uses('a-uses-b', 'a', 'b'), uses('a-uses-c', 'a', 'c')])

  const projection = projectWorld(model, { viewport: mapViewportOf({ width: 120, height: 36 }) })
  assert.equal(projection.relationships.length, 1)
  const route = projection.relationships[0]!
  assert.equal(route.source, 'observed:left')
  assert.equal(route.target, 'observed:right')
  assertOrthogonal(route.worldRoute)
  const row = projection.items.find(item => item.representationId === 'observed:left')!.worldBounds
  assert.ok(route.worldRoute[0]!.y >= row.y && route.worldRoute[0]!.y < row.y + row.height)
})
