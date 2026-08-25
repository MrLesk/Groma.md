import assert from 'node:assert/strict'

import { test } from 'bun:test'

import { flowRowState } from '../src/viewers/web/flow/row.ts'
import { toggleFlowActivation } from '../src/viewers/web/flow/state.ts'

const scan = { commandId: 'scan' }
const render = { commandId: 'render', actorId: 'architect' }

test.concurrent('flow toggles append, deactivate, and rescope one active path per command', () => {
  const activated = toggleFlowActivation([scan], render)
  const deactivated = toggleFlowActivation(activated, render)
  const rescope = toggleFlowActivation([{ commandId: 'render' }], render)

  assert.deepEqual(activated, [scan, render])
  assert.deepEqual(deactivated, [scan])
  assert.deepEqual(rescope, [render])
})

test.concurrent('general rows preserve current scope while actor command rows require their exact scope', () => {
  const general = flowRowState({ commandId: 'render' }, [render])
  const otherActor = flowRowState(
    { commandId: 'render', actorId: 'reviewer' },
    [render],
  )

  assert.deepEqual(general, { active: true, toggleTarget: render })
  assert.deepEqual(otherActor, {
    active: false,
    toggleTarget: { commandId: 'render', actorId: 'reviewer' },
  })
})
