import assert from 'node:assert/strict'

import { test } from 'bun:test'

import { toggleFlowSelection } from '../src/viewers/web/flow/state.ts'

const scan = { commandId: 'scan' }
const render = { commandId: 'render', actorId: 'architect' }

test.concurrent('inactive flows append while the latest clicked flow becomes selected', () => {
  const first = toggleFlowSelection([], undefined, scan)
  const second = toggleFlowSelection(first.active, first.selected, render)

  assert.deepEqual(second, { active: [scan, render], selected: render })
})

test.concurrent('an active non-selected flow changes details without losing highlights', () => {
  const next = toggleFlowSelection([scan, render], render, scan)

  assert.deepEqual(next, { active: [scan, render], selected: scan })
})

test.concurrent('the selected flow deactivates with ordered fallback', () => {
  const fallback = toggleFlowSelection([scan, render], render, render)
  const cleared = toggleFlowSelection(fallback.active, fallback.selected, scan)

  assert.deepEqual(fallback, { active: [scan], selected: scan })
  assert.deepEqual(cleared, { active: [], selected: undefined })
})

test.concurrent('actor scope replaces the same command instead of hiding a second flow behind one row', () => {
  const unscoped = { commandId: 'render' }
  const scoped = toggleFlowSelection([unscoped], unscoped, render)

  assert.deepEqual(scoped, { active: [render], selected: render })
})
