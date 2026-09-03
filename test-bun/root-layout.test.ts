import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { rootLayout } from '../src/viewers/tui/projection-root.ts'
import { terminalBounds } from '../src/viewers/tui/projection-sheet.ts'
import { navigationWorld } from './helpers.ts'

test.concurrent('the root shows systems, containers, actors, and external systems but no components', () => {
  const model = navigationWorld()
  const items = rootLayout(model)

  assert.deepEqual(
    new Set(items.flatMap(item => item.representationId === undefined ? [] : [item.representationId])),
    new Set([
      'observed:alpha',
      'observed:zeta',
      'observed:empty',
      'observed:cleft',
      'observed:cright',
      'observed:cfar',
      'observed:ann',
      'observed:ext',
    ]),
  )
  assert.equal(items.some(item => item.kind === 'component'), false)
})

test.concurrent('root items keep the shared sheet geometry at the fixed terminal scale', () => {
  const model = navigationWorld()
  const byKey = new Map(rootLayout(model).map(item => [item.key, item]))
  const sheetItems = [
    ...model.sheet.islands.map(item => ({ key: item.key, rect: item.rect })),
    ...model.sheet.slabs.map(item => ({ key: item.representationId, rect: item.rect })),
    ...model.sheet.buildings
      .filter(item => item.kind !== 'component')
      .map(item => ({ key: item.representationId, rect: item.rect })),
  ]

  for (const item of sheetItems) {
    assert.deepEqual(byKey.get(item.key)?.worldBounds, terminalBounds(item.rect), item.key)
  }
})
