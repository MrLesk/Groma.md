import { expect, test } from 'bun:test'
import path from 'node:path'
import { loadTerminalModel } from '../src/view-host.ts'
import { initialState, reduceViewer, toggleFlow, litAction } from '../src/viewers/tui/navigation.ts'
import { litLegs, projectFlowStep } from '../src/viewers/tui/flow.ts'
import { projectWorld } from '../src/viewers/tui/projection.ts'
import { mapViewportOf } from './helpers.ts'

const fixture = path.resolve(import.meta.dir, '../test/fixtures/flows')

test.concurrent('flow reading, endpoint inspection and return retain the authored step and membership', async () => {
  const model = await loadTerminalModel(fixture)
  const before = initialState(model)
  let state = toggleFlow(before, 'process-request')
  expect(state.currentId).toBe(before.currentId)
  expect(state.level).toBe(before.level)
  expect(state.flowReading).toBe(true)
  state = reduceViewer(model, state, 'down')
  state = reduceViewer(model, state, 'down')
  expect(state.actionStep).toBe(1)
  const ids = litLegs(model, litAction(model, state)).map(leg => leg.id)
  state = reduceViewer(model, state, 'enter')
  expect(state.currentId).toBe('worker')
  expect(state.flowReading).toBe(false)
  expect(state.actionStep).toBe(1)
  state = reduceViewer(model, state, 'dismiss')
  expect(state.flowReading).toBe(true)
  expect(state.actionStep).toBe(1)
  expect(litLegs(model, litAction(model, state)).map(leg => leg.id)).toEqual(ids)
  state = reduceViewer(model, state, 'left')
  expect(state.currentId).toBe('entry')
  state = reduceViewer(model, state, 'dismiss')
  state = reduceViewer(model, state, 'up')
  state = reduceViewer(model, state, 'up')
  expect(state.actionStep).toBeUndefined()
  state = reduceViewer(model, state, 'clear-action')
  expect(state.activeActionId).toBeUndefined()
  expect(state.flowReading).toBe(false)
})

test.concurrent('selecting a flow step preserves map geometry and promotes its exact endpoints', async () => {
  const model = await loadTerminalModel(fixture)
  const state = toggleFlow(initialState(model), 'process-request')
  const selected = reduceViewer(model, reduceViewer(model, state, 'step-action'), 'step-action')
  for (const size of [{ width: 120, height: 36 }, { width: 200, height: 60 }]) {
    const viewport = mapViewportOf(size)
    const before = projectWorld(model, { viewport, currentId: state.currentId, level: state.level })
    const target = model.flows[0]!.steps[selected.actionStep!]!.target
    const after = projectWorld(model, { viewport, currentId: selected.currentId, level: selected.level, camera: before.camera, attentionIds: [target] })
    expect(after.items.map(item => [item.key, item.worldBounds])).toEqual(before.items.map(item => [item.key, item.worldBounds]))
    expect(after.relationships.map(route => [route.ids, route.worldRoute])).toEqual(before.relationships.map(route => [route.ids, route.worldRoute]))
    const step = projectFlowStep(model, after, selected.activeActionId, selected.actionStep)!
    expect(step.id).toBe(model.flows[0]!.steps[1]!.relationshipId)
    expect(step.source.visibleKey).toBe('api')
    expect(step.target.visibleKey).toBe('api')
  }
})
