import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { initialState, reduceViewer } from '../src/viewers/tui/navigation.ts'
import { projectWorld } from '../src/viewers/tui/projection.ts'
import { encloses } from '../src/viewers/tui/projection-camera.ts'
import { MAP_PADDING, rootIslands } from '../src/viewers/tui/projection-root.ts'
import { containersFixtureRoot, terminalModel } from './helpers.ts'

const VIEWPORT = { x: 0, y: 0, width: 60, height: 29 }

test.concurrent('the container map fits and centres the selected slab with a neighbour peeking', async () => {
  const model = await terminalModel(containersFixtureRoot)
  const projection = projectWorld(model, { viewport: VIEWPORT, level: 'components', currentId: 'page' })
  const slab = projection.items.find(item => item.representationId === 'web')!.cellBounds
  assert.equal(slab.width, VIEWPORT.width - 2 * MAP_PADDING)
  assert.equal(slab.x, MAP_PADDING)
  const zone = projection.items.find(item => item.kind === 'group')!.cellBounds
  const card = projection.items.find(item => item.representationId === 'page')!.cellBounds
  assert.ok(encloses(slab, zone) && encloses(zone, card))
  const neighbour = projection.items.find(item => item.representationId === 'api')!.cellBounds
  assert.ok(neighbour.x >= slab.x + slab.width || neighbour.x + neighbour.width <= slab.x)
  assert.ok(neighbour.x < VIEWPORT.width && neighbour.x + neighbour.width > 0)
})

test.concurrent('past the last building the arrows cross to the neighbouring container', async () => {
  const model = await terminalModel(containersFixtureRoot)
  const rows = rootIslands(model).find(entry => entry.island.element?.representationId === 'shop')!.rows.map(row => row.element.representationId)
  const towardsApi = rows.indexOf('api') > rows.indexOf('web') ? 'right' : 'left'
  const state = { ...initialState(model), level: 'components' as const, currentId: 'page', mapWidth: VIEWPORT.width }
  const crossed = reduceViewer(model, state, towardsApi)
  assert.deepEqual({ level: crossed.level, currentId: crossed.currentId }, { level: 'components', currentId: 'orders' })
  const back = reduceViewer(model, crossed, towardsApi === 'right' ? 'left' : 'right')
  assert.equal(back.currentId, 'page')
})
