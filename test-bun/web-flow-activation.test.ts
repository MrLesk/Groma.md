import { expect, test } from 'bun:test'
import path from 'node:path'
import { loadAnnotatedArchitecture } from '../src/core.ts'
import { flowHighlight, toggleFlowActivation } from '../src/viewers/web/flow/state.ts'

test.concurrent('opening another flow replaces the current scenario and its step', () => {
  const original = { id: 'first', step: 2 }
  const next = toggleFlowActivation(original, { id: 'second' })
  expect(next).toEqual({ id: 'second' })
  expect(original.step).toBe(2)
  expect(toggleFlowActivation(next, { id: 'second' })).toBeUndefined()
})

test.concurrent('a flow opened from details keeps its origin only for that visit', () => {
  const opened = toggleFlowActivation(undefined, { id: 'first' }, 'component')
  expect(opened?.returnTo).toBe('component')
  const another = toggleFlowActivation(opened, { id: 'second' })
  expect(another?.returnTo).toBeUndefined()
  expect(toggleFlowActivation(opened, { id: 'first' }, 'component')).toBeUndefined()
})

test.concurrent('step focus retains the complete Web path and omits unrelated collaborations', async () => {
  const world = await loadAnnotatedArchitecture(path.resolve(import.meta.dir, '../test/fixtures/flows'))
  const original = structuredClone(world)
  const flow = world.flows[0]!
  const whole = flowHighlight({ id: flow.id }, world)
  expect(whole.focusedRoute).toBeUndefined()
  expect(whole.routes.size).toBeGreaterThan(1)
  const unrelated = world.relationships.find(relationship => relationship.target === 'journal')!
  expect(whole.routes.has(unrelated.id)).toBe(false)
  for (let step = 0; step < flow.steps.length; step++) {
    const focused = flowHighlight({ id: flow.id, step }, world)
    expect(focused.routes).toEqual(whole.routes)
    expect(focused.focusedRoute).toBe(flow.steps[step]!.relationshipId)
  }
  expect(flowHighlight(undefined, world)).toEqual({ routes: new Set(), focusedRoute: undefined })
  expect(world).toEqual(original)
})
