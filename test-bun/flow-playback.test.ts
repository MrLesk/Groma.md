import { expect, test } from 'bun:test'

import {
  initialPlayback,
  nextPlayback,
} from '../src/viewers/web/flow-playback.ts'

test.concurrent('pause toggles and always leaves leg tracing', () => {
  const paused = nextPlayback(initialPlayback, { type: 'toggle-pause' })
  expect(paused.paused).toBe(true)
  const resumed = nextPlayback(paused, { type: 'toggle-pause' })
  expect(resumed.paused).toBe(false)

  const tracing = nextPlayback(initialPlayback, { type: 'step', legCount: 3 })
  expect(nextPlayback(tracing, { type: 'toggle-pause' }).step).toBeNull()
})

test.concurrent('rate changes keep the rest of the playback', () => {
  const tracing = nextPlayback(initialPlayback, { type: 'step', legCount: 3 })
  const fast = nextPlayback(tracing, { type: 'rate', rate: 2 })
  expect(fast).toEqual({ paused: false, rate: 2, step: 0 })
})

test.concurrent('stepping advances one leg at a time and wraps', () => {
  let state = initialPlayback
  const steps: (number | null)[] = []
  for (let i = 0; i < 4; i += 1) {
    state = nextPlayback(state, { type: 'step', legCount: 3 })
    steps.push(state.step)
  }
  expect(steps).toEqual([0, 1, 2, 0])
  // A walk with no legs cannot be traced.
  expect(nextPlayback(initialPlayback, { type: 'step', legCount: 0 }).step).toBeNull()
})
