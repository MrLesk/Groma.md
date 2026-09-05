import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { OptimizedBuffer } from '@opentui/core'

import { viewerTheme } from '../src/viewers/tui/atoms/theme.ts'
import { initialState, reduceViewer } from '../src/viewers/tui/navigation.ts'
import { paintMap } from '../src/viewers/tui/paint.ts'
import { projectWorld } from '../src/viewers/tui/projection.ts'
import { encloses } from '../src/viewers/tui/projection-camera.ts'
import { MAP_PADDING, rootIslands } from '../src/viewers/tui/projection-root.ts'
import { box, containersFixtureRoot, terminalModel, worldOf } from './helpers.ts'

const VIEWPORT = { x: 0, y: 0, width: 60, height: 29 }

test.concurrent('the container map fits its slab, keeps selection visible, and keeps its neighbour adjacent', async () => {
  const model = await terminalModel(containersFixtureRoot)
  const projection = projectWorld(model, {
    viewport: VIEWPORT,
    level: 'components',
    currentId: 'page',
  })
  const slab = projection.items.find(item => item.representationId === 'web')!.cellBounds
  assert.equal(slab.width, VIEWPORT.width - 2 * MAP_PADDING)
  const zone = projection.items.find(item => item.kind === 'group')!.cellBounds
  const card = projection.items.find(item => item.representationId === 'page')!.cellBounds
  assert.ok(encloses(VIEWPORT, card))
  assert.ok(encloses(slab, zone) && encloses(zone, card))
  const neighbour = projection.items.find(item => item.representationId === 'api')!.cellBounds
  assert.ok(neighbour.x >= slab.x + slab.width || neighbour.x + neighbour.width <= slab.x)
  assert.ok(neighbour.width <= 3)
  assert.ok(projection.worldBounds.width <= VIEWPORT.width)
  assert.ok(encloses(VIEWPORT, { ...slab, y: VIEWPORT.y, height: 1 }))
})

test.concurrent('past the last building the arrows cross to the neighbouring container', async () => {
  const model = await terminalModel(containersFixtureRoot)
  const rows = rootIslands(model)
    .find(entry => entry.island.element?.representationId === 'shop')!
    .rows.map(row => row.element.representationId)
  const towardsApi = rows.indexOf('api') > rows.indexOf('web') ? 'right' : 'left'
  const state = {
    ...initialState(model),
    level: 'components' as const,
    currentId: 'page',
    mapWidth: VIEWPORT.width,
  }
  const crossed = reduceViewer(model, state, towardsApi)
  assert.deepEqual(
    { level: crossed.level, currentId: crossed.currentId },
    { level: 'components', currentId: 'orders' },
  )
  const back = reduceViewer(model, crossed, towardsApi === 'right' ? 'left' : 'right')
  assert.equal(back.currentId, 'page')
})

const CELL = { x: 0, y: 0, width: 1, height: 1 }

function files(count: number, name = 'file'): { scanner: string; file: string; lines: number }[] {
  return Array.from({ length: count }, (_, index) => ({
    scanner: 'test',
    file: `src/${name}${index}.ts`,
    lines: 10 + index,
  }))
}

test.concurrent('a building lists one row per floor; a ghost shows one empty row', () => {
  const model = worldOf([
    box('sys', 'system', CELL, { children: ['observed:store'] }),
    box('store', 'container', CELL, {
      parent: 'observed:sys',
      children: ['observed:full', 'observed:ghost'],
    }),
    box('full', 'component', CELL, { parent: 'observed:store', code: files(7) }),
    box('ghost', 'component', CELL, { parent: 'observed:store', origin: 'draft' }),
  ])
  const projection = projectWorld(model, {
    viewport: VIEWPORT,
    level: 'components',
    currentId: 'observed:full',
  })
  const full = projection.items.find(item => item.representationId === 'observed:full')!
  const floors = model.sheet.buildings
    .find(building => building.representationId === 'observed:full')!.floors
  assert.ok(floors.length >= 1 && floors.length <= 5)
  assert.deepEqual(full.lines, floors.map(floor => {
    const others = floor.files.length > 1 ? ` +${floor.files.length - 1}` : ''
    return `${floor.files[0]!.split('/').at(-1)}${others}`
  }))
  assert.equal(full.cellBounds.height, full.lines.length + 2)
  assert.equal(
    full.cellBounds.width,
    Math.max(full.title.length + 6, ...full.lines.map(row => row.length + 4)),
  )
  const ghost = projection.items.find(item => item.representationId === 'observed:ghost')!
  assert.deepEqual(ghost.lines, [''])
  assert.equal(ghost.cellBounds.height, 3)
})

test.concurrent('buildings never overlap and two rows lie between their lines', () => {
  const ids = Array.from({ length: 9 }, (_, index) => `part${index}`)
  const model = worldOf([
    box('sys', 'system', CELL, { children: ['observed:store'] }),
    box('store', 'container', CELL, {
      parent: 'observed:sys',
      children: ids.map(id => `observed:${id}`),
    }),
    ...ids.map((id, index) => {
      return box(id, 'component', CELL, {
        parent: 'observed:store',
        code: files(1 + index),
      })
    }),
  ])
  const cards = projectWorld(model, {
    viewport: VIEWPORT,
    level: 'components',
    currentId: 'observed:part0',
  }).items.filter(item => item.shape === 'card').map(item => item.worldBounds)
  assert.equal(cards.length, 9)
  for (const a of cards) {
    for (const b of cards) {
      if (a === b) continue
      const apart = a.x + a.width <= b.x
        || b.x + b.width <= a.x
        || a.y + a.height <= b.y
        || b.y + b.height <= a.y
      assert.ok(apart)
      if (a.y !== b.y && a.y < b.y) assert.ok(b.y >= a.y + a.height + 2)
    }
  }
})

test.concurrent('a row wider than its building ends in an ellipsis', () => {
  const model = worldOf([
    box('sys', 'system', CELL, { children: ['observed:store'] }),
    box('store', 'container', CELL, {
      parent: 'observed:sys',
      children: ['observed:long'],
    }),
    box('long', 'component', CELL, {
      parent: 'observed:store',
      code: files(1, 'a-very-long-source-file-name-that-no-building-can-hold-'),
    }),
  ])
  const projection = projectWorld(model, {
    viewport: VIEWPORT,
    level: 'components',
    currentId: 'observed:long',
  })
  const buffer = OptimizedBuffer.create(VIEWPORT.width, VIEWPORT.height, 'unicode')
  paintMap(buffer, projection, model, viewerTheme(), {
    lit: {},
    step: undefined,
    animationPhase: 0,
  })
  const rows = buffer.getSpanLines().map(line => line.spans.map(span => span.text).join(''))
  buffer.destroy()
  const card = projection.items.find(item => item.representationId === 'observed:long')!.cellBounds
  const row = [...(rows[card.y + 1] ?? '')]
    .slice(card.x + 2, card.x + card.width - 2)
    .join('')
    .trimEnd()
  assert.ok(row.endsWith('…'))
  assert.ok(row.length <= card.width - 4)
})
