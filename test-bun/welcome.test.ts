import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { normalizeTerminalPalette } from '@opentui/core'
import { createTestRenderer } from '@opentui/core/testing'

import { mountWelcomeLauncher } from '../src/welcome.ts'

test.concurrent('the welcome starts on web and returns the entered action', async () => {
  const setup = await createTestRenderer({ width: 100, height: 30 })
  const selected = mountWelcomeLauncher(
    setup.renderer,
    '/workspace/example',
    normalizeTerminalPalette(),
  )

  setup.mockInput.pressEnter()

  assert.equal(await selected, 'web')
  assert.equal(setup.renderer.isDestroyed, true)
})

test.concurrent('up and down choose one action before enter', async () => {
  const setup = await createTestRenderer({ width: 100, height: 30 })
  const selected = mountWelcomeLauncher(
    setup.renderer,
    '/workspace/example',
    normalizeTerminalPalette(),
  )

  setup.mockInput.pressArrow('down')
  setup.mockInput.pressArrow('down')
  setup.mockInput.pressArrow('up')
  setup.mockInput.pressEnter()

  assert.equal(await selected, 'view')
})

test.concurrent('control-c closes the welcome and releases its input handler', async () => {
  const setup = await createTestRenderer({ width: 100, height: 30 })
  const inputListeners = setup.renderer.keyInput.listenerCount('keypress')
  const selected = mountWelcomeLauncher(
    setup.renderer,
    '/workspace/example',
    normalizeTerminalPalette(),
  )

  assert.equal(
    setup.renderer.keyInput.listenerCount('keypress'),
    inputListeners + 1,
  )
  setup.mockInput.pressCtrlC()

  assert.equal(await selected, undefined)
  assert.equal(
    setup.renderer.keyInput.listenerCount('keypress'),
    inputListeners,
  )
})
