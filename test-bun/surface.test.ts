import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { OptimizedBuffer } from '@opentui/core'

import { viewerTheme } from '../src/viewers/tui/atoms/theme.ts'
import { paintMap } from '../src/viewers/tui/paint.ts'
import { projectWorld } from '../src/viewers/tui/projection.ts'
import type { TerminalProjection } from '../src/viewers/tui/projection.ts'
import type { Bounds, TerminalLevel } from '../src/types.ts'
import type { TerminalViewModel } from '../src/viewers/tui/model.ts'
import { containersFixtureRoot, terminalModel } from './helpers.ts'

const PATTERN_GLYPHS = new Set(['╲', '╱', '·', '×'])
const VIEWPORT = { x: 0, y: 0, width: 60, height: 29 }

/** Strictly inside the frame of a surface or building. */
function inside(bounds: Bounds, x: number, y: number): boolean {
  return x > bounds.x && x < bounds.x + bounds.width - 1 && y > bounds.y && y < bounds.y + bounds.height - 1
}

type Painted = { projection: TerminalProjection; at: (x: number, y: number) => string }

/** Paints a projection into its own buffer and reads the cells back. */
function paint(model: TerminalViewModel, projection: TerminalProjection): Painted {
  const buffer = OptimizedBuffer.create(VIEWPORT.width, VIEWPORT.height, 'unicode')
  paintMap(buffer, projection, model, viewerTheme(), { lit: {}, step: undefined, animationPhase: 0 })
  const rows = buffer.getSpanLines().map(line => line.spans.map(span => span.text).join(''))
  buffer.destroy()
  return { projection, at: (x, y) => [...(rows[y] ?? '')][x] ?? ' ' }
}

async function paintedMap(level: TerminalLevel, currentId: string): Promise<Painted> {
  const model = await terminalModel(containersFixtureRoot)
  return paint(model, projectWorld(model, { viewport: VIEWPORT, level, currentId }))
}

/** The slab-relative cells that carry grain, on the rows visible in both a frame and its one-row pan. */
function grainCells(painted: Painted, sharedRows: [number, number]): string[] {
  const slab = painted.projection.items.find(item => item.kind === 'container')!.cellBounds
  const cells: string[] = []
  for (let y = 0; y < VIEWPORT.height; y += 1) {
    for (let x = 0; x < VIEWPORT.width; x += 1) {
      const row = y - slab.y
      if (row >= sharedRows[0] && row < sharedRows[1] && painted.at(x, y) === '╲') cells.push(`${x - slab.x},${row}`)
    }
  }
  return cells
}

test.concurrent('a container map grains its slab, hatches its zone and leaves the ground plain', async () => {
  const { projection, at } = await paintedMap('components', 'page')
  const slab = projection.items.find(item => item.kind === 'container')!.cellBounds
  const zone = projection.items.find(item => item.kind === 'group')!.cellBounds
  const buildings = projection.items.filter(item => item.shape === 'card').map(item => item.cellBounds)
  const seen = { zone: new Set<string>(), slab: new Set<string>(), ground: new Set<string>() }
  for (let y = 0; y < VIEWPORT.height; y += 1) {
    for (let x = 0; x < VIEWPORT.width; x += 1) {
      const glyph = at(x, y)
      if (!PATTERN_GLYPHS.has(glyph) || buildings.some(bounds => inside(bounds, x, y))) continue
      seen[inside(zone, x, y) ? 'zone' : inside(slab, x, y) ? 'slab' : 'ground'].add(glyph)
    }
  }
  assert.deepEqual([...seen.zone], ['╱'])
  assert.deepEqual([...seen.slab], ['╲'])
  assert.equal(seen.ground.size, 0)
})

test.concurrent('the root map keeps the system island and the ground plain', async () => {
  const { projection, at } = await paintedMap('context', 'shop')
  const island = projection.items.find(item => item.kind === 'system')!
  const covered = projection.items.filter(item => item.kind !== 'system').map(item => item.cellBounds)
  for (let y = 0; y < VIEWPORT.height; y += 1) {
    for (let x = 0; x < VIEWPORT.width; x += 1) {
      if (covered.some(bounds => inside(bounds, x, y))) continue
      assert.ok(!PATTERN_GLYPHS.has(at(x, y)), `pattern glyph ${inside(island.cellBounds, x, y) ? 'on the island' : 'on the ground'} at ${x},${y}`)
    }
  }
})

test.concurrent('the pattern stays on its surface when the camera pans a row', async () => {
  const model = await terminalModel(containersFixtureRoot)
  const still = projectWorld(model, { viewport: VIEWPORT, level: 'components', currentId: 'page' })
  const shift = (bounds: Bounds) => ({ ...bounds, y: bounds.y - 1 })
  const panned = {
    ...still,
    items: still.items.map(item => ({ ...item, cellBounds: shift(item.cellBounds) })),
    relationships: still.relationships.map(route => ({ ...route, cellRoute: route.cellRoute.map(point => ({ ...point, y: point.y - 1 })) })),
  }
  const slab = still.items.find(item => item.kind === 'container')!.cellBounds
  // Rows of the slab that both frames show in full.
  const shared: [number, number] = [Math.max(1, 1 - slab.y), Math.min(slab.height - 1, VIEWPORT.height - 1 - slab.y)]
  assert.deepEqual(grainCells(paint(model, panned), shared), grainCells(paint(model, still), shared))
  assert.ok(grainCells(paint(model, still), shared).length > 0)
})
