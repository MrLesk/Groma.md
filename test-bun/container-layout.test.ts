import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { initialState, reduceViewer, type MapDirection } from '../src/viewers/tui/navigation.ts'
import { encloses } from '../src/viewers/tui/projection-camera.ts'
import { projectWorld } from '../src/viewers/tui/projection.ts'
import { terminalBounds } from '../src/viewers/tui/projection-sheet.ts'
import { box, containersFixtureRoot, terminalModel, worldOf } from './helpers.ts'

const VIEWPORT = { x: 0, y: 0, width: 60, height: 29 }
const DIRECTIONS: MapDirection[] = ['up', 'down', 'left', 'right']

test.concurrent('the container map uses its fixed sheet geometry and excludes neighbouring containers', async () => {
  const model = await terminalModel(containersFixtureRoot)
  const projection = projectWorld(model, { viewport: VIEWPORT, level: 'components', currentId: 'page' })
  const slab = projection.items.find(item => item.representationId === 'web')!
  const sheetSlab = model.sheet.slabs.find(item => item.representationId === 'web')!

  assert.deepEqual(slab.worldBounds, terminalBounds(sheetSlab.rect))
  assert.equal(projection.items.some(item => item.representationId === 'api'), false)
  assert.equal(projection.items.some(item => item.representationId === 'orders'), false)
  for (const item of projection.items.filter(item => item.key !== slab.key)) {
    assert.ok(encloses(slab.worldBounds, item.worldBounds), item.key)
  }
})

test.concurrent('arrows keep component selection inside the open container', async () => {
  const model = await terminalModel(containersFixtureRoot)
  const start = { ...initialState(model), level: 'components' as const, currentId: 'page' }
  const byId = new Map(model.elements.map(element => [element.representationId, element]))

  for (const direction of DIRECTIONS) {
    const moved = reduceViewer(model, start, direction)
    assert.equal(moved.level, 'components')
    assert.equal(byId.get(moved.currentId!)?.parent, 'web')
  }
})

const CELL = { x: 0, y: 0, width: 1, height: 1 }

function files(count: number): { scanner: string; file: string; lines: number }[] {
  return Array.from({ length: count }, (_, index) => ({ scanner: 'test', file: `src/file${index}.ts`, lines: 10 + index }))
}

test.concurrent('component buildings keep the shared sheet placement without overlap', () => {
  const ids = Array.from({ length: 9 }, (_, index) => `part${index}`)
  const model = worldOf([
    box('sys', 'system', CELL, { children: ['observed:store'] }),
    box('store', 'container', CELL, { parent: 'observed:sys', children: ids.map(id => `observed:${id}`) }),
    ...ids.map((id, index) => box(id, 'component', CELL, { parent: 'observed:store', code: files(1 + index) })),
  ])
  const cards = projectWorld(model, { viewport: VIEWPORT, level: 'components', currentId: 'observed:part0' }).items
    .filter(item => item.shape === 'card')

  assert.equal(cards.length, 9)
  for (const card of cards) {
    const building = model.sheet.buildings.find(item => item.representationId === card.representationId)!
    assert.deepEqual(card.worldBounds, terminalBounds(building.rect))
    for (const other of cards) {
      if (card === other) continue
      const a = card.worldBounds
      const b = other.worldBounds
      assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y)
    }
  }
})
