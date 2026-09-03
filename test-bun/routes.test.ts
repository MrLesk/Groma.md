import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { OptimizedBuffer } from '@opentui/core'

import { viewerTheme } from '../src/viewers/tui/atoms/theme.ts'
import { litLegs } from '../src/viewers/tui/flow.ts'
import { drawPorts, drawRoute } from '../src/viewers/tui/molecules/route.ts'
import type { Occupied } from '../src/viewers/tui/molecules/route.ts'
import { initialState, litAction, reduceViewer, type ViewerState } from '../src/viewers/tui/navigation.ts'
import { paintMap } from '../src/viewers/tui/paint.ts'
import { projectWorld } from '../src/viewers/tui/projection.ts'
import type { ProjectedMapRoute, TerminalProjection } from '../src/viewers/tui/projection.ts'
import type { Point } from '../src/types.ts'
import type { TerminalViewModel } from '../src/viewers/tui/model.ts'
import { box, uses, worldOf } from './helpers.ts'

const CELL = { x: 0, y: 0, width: 1, height: 1 }
const HEAVY = new Set(['━', '┃', '┅', '┇'])
const THIN = new Set(['─', '│', '╌', '┆'])

function reader(buffer: OptimizedBuffer): (x: number, y: number) => string {
  const rows = buffer.getSpanLines().map(line => line.spans.map(span => span.text).join(''))
  return (x, y) => [...(rows[y] ?? '')][x] ?? ' '
}

function route(cells: Point[]): ProjectedMapRoute {
  return { ids: ['link'], source: 'from', target: 'to', description: 'Reads data', origin: 'observed', worldRoute: cells, cellRoute: cells }
}

test.concurrent('two unlit routes crossing share a junction glyph', () => {
  const theme = viewerTheme()
  const viewport = { x: 0, y: 0, width: 20, height: 12 }
  const buffer = OptimizedBuffer.create(viewport.width, viewport.height, 'unicode')
  buffer.clear(theme.background)
  const occupied: Occupied = new Map()
  const ends = { source: undefined, target: undefined }
  drawRoute(buffer, route([{ x: 0, y: 5 }, { x: 15, y: 5 }]), viewport, theme, { lit: false, ends, occupied })
  drawRoute(buffer, route([{ x: 8, y: 0 }, { x: 8, y: 10 }]), viewport, theme, { lit: false, ends, occupied })
  const at = reader(buffer)
  buffer.destroy()
  assert.equal(at(8, 5), '┼')
  assert.equal(at(4, 5), '─')
  assert.equal(at(8, 2), '│')
})

test.concurrent('a lit route draws heavy with an arrowhead and a port dot on a side border, none on a top border', () => {
  const theme = viewerTheme()
  const viewport = { x: 0, y: 0, width: 20, height: 12 }
  const buffer = OptimizedBuffer.create(viewport.width, viewport.height, 'unicode')
  buffer.clear(theme.background)
  const ends = { source: { x: 0, y: 4, width: 4, height: 3 }, target: { x: 10, y: 8, width: 6, height: 3 } }
  const lit = route([{ x: 4, y: 5 }, { x: 12, y: 5 }, { x: 12, y: 7 }])
  drawRoute(buffer, lit, viewport, theme, { lit: true, ends })
  drawPorts(buffer, lit, viewport, theme, ends)
  const at = reader(buffer)
  buffer.destroy()
  assert.equal(at(6, 5), '━')
  assert.equal(at(12, 6), '┃')
  assert.equal(at(12, 7), '▼')
  assert.equal(at(3, 5), '●')
  assert.ok(Array.from({ length: 6 }, (_, index) => at(10 + index, 8)).every(glyph => glyph !== '●'))
})

function linkedWorld(): TerminalViewModel {
  return worldOf([
    box('sys', 'system', CELL, { children: ['observed:store'] }),
    box('store', 'container', CELL, { parent: 'observed:sys', children: ['observed:a', 'observed:b', 'observed:c'] }),
    ...['a', 'b', 'c'].map(id => box(id, 'component', CELL, { parent: 'observed:store' })),
  ], [uses('a-reads-b', 'a', 'b')])
}

/** The glyph painted on the middle cell of the route's first run. */
function routeGlyph(model: TerminalViewModel, projection: TerminalProjection): string {
  const buffer = OptimizedBuffer.create(projection.viewport.width, projection.viewport.height, 'unicode')
  paintMap(buffer, projection, model, viewerTheme(), { lit: {}, step: undefined, animationPhase: 0 })
  const at = reader(buffer)
  buffer.destroy()
  const [from, to] = projection.relationships[0]!.cellRoute
  return at(Math.floor((from!.x + to!.x) / 2), Math.floor((from!.y + to!.y) / 2))
}

test.concurrent('routes touching the selection light while the others stay thin', () => {
  const model = linkedWorld()
  const viewport = { x: 0, y: 0, width: 60, height: 20 }
  assert.ok(HEAVY.has(routeGlyph(model, projectWorld(model, { viewport, level: 'components', currentId: 'observed:a' }))))
  assert.ok(THIN.has(routeGlyph(model, projectWorld(model, { viewport, level: 'components', currentId: 'observed:c' }))))
})

test.concurrent('a picked relationship lights its own route and Enter follows it to the other end', () => {
  const model = linkedWorld()
  let state: ViewerState = { ...initialState(model), level: 'components', currentId: 'observed:a', focus: 'details', mapWidth: 60 }
  state = reduceViewer(model, state, 'down')
  assert.equal(state.actionCursor, 'a-reads-b')
  const lit = litAction(model, state)
  assert.deepEqual(litLegs(model, lit).map(leg => leg.id), ['a-reads-b'])
  state = reduceViewer(model, state, 'enter')
  assert.equal(state.activeActionId, 'a-reads-b')
  state = reduceViewer(model, state, 'enter')
  assert.equal(state.currentId, 'observed:b')
})

test.concurrent('routes keep their cells while the selection stays on its island', () => {
  const model = worldOf([
    box('alpha', 'system', CELL, { children: ['observed:c1', 'observed:c2'] }),
    box('c1', 'container', CELL, { parent: 'observed:alpha' }),
    box('c2', 'container', CELL, { parent: 'observed:alpha' }),
    box('beta', 'system', CELL, { children: ['observed:c3'] }),
    box('c3', 'container', CELL, { parent: 'observed:beta' }),
  ], [uses('c1-c3', 'c1', 'c3')])
  const viewport = { x: 0, y: 0, width: 40, height: 12 }
  const first = projectWorld(model, { viewport, currentId: 'observed:c1' })
  const second = projectWorld(model, { viewport, currentId: 'observed:c2', camera: first.camera })
  assert.ok(first.relationships.length === 1)
  assert.deepEqual(second.relationships[0]!.cellRoute, first.relationships[0]!.cellRoute)
})
