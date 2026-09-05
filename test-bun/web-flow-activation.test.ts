import { expect, test } from 'bun:test'
import path from 'node:path'
import { loadAnnotatedArchitecture } from '../src/core.ts'
import { flowHighlight, flowSelection, retainFlows, toggleFlowActivation } from '../src/viewers/web/flow/state.ts'

test.concurrent('flows toggle independently and the last checked flow owns the reader', () => {
  const original = [{ id: 'first', step: 2 }]
  const next = toggleFlowActivation(original, { id: 'second' })
  expect(next.map(flow => flow.id)).toEqual(['first', 'second'])
  expect(flowSelection(next)).toEqual({ kind: 'flow', id: 'second' })
  expect(original).toEqual([{ id: 'first', step: 2 }])
  const remaining = toggleFlowActivation(next, { id: 'second' })
  expect(remaining).toEqual(original)
  expect(flowSelection(remaining)).toEqual({ kind: 'flow', id: 'first' })
  expect(toggleFlowActivation(next, { id: 'first' }).map(flow => flow.id)).toEqual(['second'])
  expect(flowSelection(toggleFlowActivation(remaining, { id: 'first' }))).toEqual({ kind: 'none' })
})

test.concurrent('a flow opened from details keeps its origin only for that visit', () => {
  const opened = toggleFlowActivation([], { id: 'first' }, 'component')
  expect(opened.at(-1)?.returnTo).toBe('component')
  const another = toggleFlowActivation(opened, { id: 'second' })
  expect(another.at(-1)?.returnTo).toBeUndefined()
  expect(another[0]?.returnTo).toBe('component')
  expect(toggleFlowActivation(opened, { id: 'first' }, 'component')).toEqual([])
})

test.concurrent('step focus retains the complete Web path and omits unrelated collaborations', async () => {
  const world = await loadAnnotatedArchitecture(path.resolve(import.meta.dir, '../test/fixtures/flows'))
  const original = structuredClone(world)
  const flow = world.flows[0]!
  const whole = flowHighlight([{ id: flow.id }], world)
  expect(whole.focusedRoute).toBeUndefined()
  expect(whole.routes.size).toBeGreaterThan(1)
  const unrelated = world.relationships.find(relationship => relationship.target === 'journal')!
  expect(whole.routes.has(unrelated.id)).toBe(false)
  for (let step = 0; step < flow.steps.length; step++) {
    const focused = flowHighlight([{ id: flow.id, step }], world)
    expect(focused.routes).toEqual(whole.routes)
    expect(focused.focusedRoute).toBe(flow.steps[step]!.relationshipId)
  }
  expect(flowHighlight([], world)).toEqual({ routes: new Set(), focusedRoute: undefined })
  expect(world).toEqual(original)
})

test.concurrent('checked flows combine explicit paths and survive world updates without stale steps', async () => {
  const world = await loadAnnotatedArchitecture(path.resolve(import.meta.dir, '../test/fixtures/flows'))
  const first = world.flows[0]!
  const other = world.relationships.find(relationship => relationship.target === 'journal')!
  world.flows.push({ ...first, id: 'other', steps: [{ ...other, relationshipId: other.id, action: 'Record' }] })
  const active = [{ id: first.id, step: 1 }, { id: 'other', step: 0 }]
  const combined = flowHighlight(active, world)
  expect(combined.routes).toEqual(new Set([...first.steps.map(step => step.relationshipId), other.id]))
  expect(combined.focusedRoute).toBe(other.id)
  const retained = retainFlows([...active, { id: 'removed' }], world)
  expect(retained).toEqual(active)
  const shortened = { ...world, flows: [{ ...first, steps: first.steps.slice(0, 1) }] }
  expect(retainFlows(active, shortened)).toEqual([{ id: first.id, step: undefined }])
  expect(active[0]!.step).toBe(1)
})
