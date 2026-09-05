import assert from 'node:assert/strict'
import { test } from 'bun:test'


import { litLegs } from '../src/viewers/tui/flow.ts'
import { initialState, litAction, reduceViewer, type ViewerState } from '../src/viewers/tui/navigation.ts'
import { projectWorld } from '../src/viewers/tui/projection.ts'
import type { TerminalViewModel } from '../src/viewers/tui/model.ts'
import { box, uses, worldOf } from './helpers.ts'

const CELL = { x: 0, y: 0, width: 1, height: 1 }
function linkedWorld(): TerminalViewModel {
  return worldOf([
    box('sys', 'system', CELL, { children: ['observed:store'] }),
    box('store', 'container', CELL, { parent: 'observed:sys', children: ['observed:a', 'observed:b', 'observed:c'] }),
    ...['a', 'b', 'c'].map(id => box(id, 'component', CELL, { parent: 'observed:store' })),
  ], [uses('a-reads-b', 'a', 'b')])
}

test.concurrent('browsing leaves a relationship inactive, Enter lights it and Enter again follows it', () => {
  const model = linkedWorld()
  let state: ViewerState = { ...initialState(model), level: 'components', currentId: 'observed:a', focus: 'details' }
  state = reduceViewer(model, state, 'down')
  assert.equal(state.actionCursor, 'a-reads-b')
  assert.equal(litAction(model, state).id, undefined)
  state = reduceViewer(model, state, 'enter')
  assert.equal(state.activeActionId, 'a-reads-b')
  assert.deepEqual(litLegs(model, litAction(model, state)).map(leg => leg.id), ['a-reads-b'])
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
  const viewport = { x: 0, y: 0, width: 200, height: 100 }
  const first = projectWorld(model, { viewport, currentId: 'observed:c1' })
  const second = projectWorld(model, { viewport, currentId: 'observed:c2', camera: first.camera })
  assert.ok(first.relationships.length === 1)
  assert.deepEqual(second.relationships[0]!.cellRoute, first.relationships[0]!.cellRoute)
})
