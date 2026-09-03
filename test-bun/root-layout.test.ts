import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { encloses } from '../src/viewers/tui/projection-camera.ts'
import { MAP_PADDING, rootLayout } from '../src/viewers/tui/projection-root.ts'
import { box, navigationWorld, worldOf } from './helpers.ts'

test.concurrent('an island lists one row per child with one block per component and no counts', () => {
  const items = rootLayout(navigationWorld(), 200)
  const island = items.find(item => item.representationId === 'observed:alpha')!
  const rows = items.filter(item => item.shape === 'row' && encloses(island.worldBounds, item.worldBounds))
  assert.deepEqual(rows.map(row => row.representationId), ['observed:cleft', 'observed:cright'])
  assert.ok(rows[0]!.lines[0]!.endsWith('▪▪'))
  assert.ok(rows[1]!.lines[0]!.endsWith('▪'))
  assert.ok(items.every(item => item.lines.every(line => !/\d/.test(line))))
  const islands = items.filter(item => item.shape === 'island')
  for (let index = 1; index < islands.length; index += 1) {
    const previous = islands[index - 1]!.worldBounds
    assert.ok(islands[index]!.worldBounds.x >= previous.x + previous.width)
  }
})

test.concurrent('a wide row wraps its blocks and the island grows down inside the map padding', () => {
  const ids = Array.from({ length: 40 }, (_, index) => `c${index}`)
  const cell = { x: 0, y: 0, width: 1, height: 1 }
  const model = worldOf([
    box('sys', 'system', cell, { children: ['observed:big'] }),
    box('big', 'container', cell, { parent: 'observed:sys', children: ids.map(id => `observed:${id}`) }),
    ...ids.map(id => box(id, 'component', cell, { parent: 'observed:big' })),
  ])
  const island = (items: ReturnType<typeof rootLayout>) => items.find(item => item.representationId === 'observed:sys')!
  const row = (items: ReturnType<typeof rootLayout>) => items.find(item => item.representationId === 'observed:big')!
  const wide = rootLayout(model, 200)
  assert.equal(row(wide).lines.length, 1)
  const narrow = rootLayout(model, 60)
  assert.ok(island(narrow).worldBounds.width <= 60 - 2 * MAP_PADDING)
  assert.ok(row(narrow).lines.length > 1)
  assert.equal(row(narrow).lines.join('').replace(/[^▪]/g, '').length, 40)
  assert.equal(island(narrow).worldBounds.height, row(narrow).lines.length + 3)
})
