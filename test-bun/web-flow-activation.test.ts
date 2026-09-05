import { expect, test } from 'bun:test'
import { toggleFlowActivation } from '../src/viewers/web/flow/state.ts'

test.concurrent('opening another flow replaces the current scenario and its step', () => {
  const original = { id: 'first', step: 2 }
  const next = toggleFlowActivation(original, { id: 'second' })
  expect(next).toEqual({ id: 'second' })
  expect(original.step).toBe(2)
  expect(toggleFlowActivation(next, { id: 'second' })).toBeUndefined()
})
