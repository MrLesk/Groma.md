import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { createTestRenderer } from '@opentui/core/testing'

import { mountWelcomeLauncher } from '../src/welcome.ts'

test.concurrent('the welcome starts on web and returns the entered action', async () => {
  const setup = await createTestRenderer({ width: 100, height: 30 })
  const selected = mountWelcomeLauncher(
    setup.renderer,
    '/workspace/example',
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
  )

  setup.mockInput.pressArrow('down')
  setup.mockInput.pressArrow('down')
  setup.mockInput.pressArrow('up')
  setup.mockInput.pressEnter()

  assert.equal(await selected, 'view')
})

test.concurrent('advanced command rows never become launcher actions', async () => {
  const setup = await createTestRenderer({ width: 110, height: 45 })
  const selected = mountWelcomeLauncher(
    setup.renderer,
    '/workspace/example',
  )

  for (let index = 0; index < 4; index++) setup.mockInput.pressArrow('down')
  setup.mockInput.pressEnter()
  setup.mockInput.pressArrow('down')
  setup.mockInput.pressEnter()
  setup.mockInput.pressArrow('up')
  setup.mockInput.pressEnter()

  assert.equal(await selected, 'help')
})

test.concurrent('escape and q close without choosing an action', async () => {
  for (const key of ['ESCAPE', 'q'] as const) {
    const setup = await createTestRenderer({ width: 100, height: 30 })
    const selected = mountWelcomeLauncher(
      setup.renderer,
      '/workspace/example',
    )

    setup.mockInput.pressKey(key)

    assert.equal(await selected, undefined)
    assert.equal(setup.renderer.isDestroyed, true)
  }
})

test.concurrent('the welcome uses terminal defaults and the exact brand green', async () => {
  const setup = await createTestRenderer({ width: 100, height: 30 })
  const selected = mountWelcomeLauncher(
    setup.renderer,
    '/workspace/example',
  )

  await setup.renderOnce()
  const spans = setup.captureSpans().lines.flatMap(line => line.spans)
  const title = spans.find(span => span.text === 'groma')
  const accent = spans.find(span => span.text === '.md')
  assert.ok(title)
  assert.ok(accent)
  assert.equal(title.fg.intent, 'default')
  assert.equal(title.bg.intent, 'default')
  assert.deepEqual(accent.fg.toInts().slice(0, 3), [29, 158, 117])
  assert.equal(accent.bg.intent, 'default')

  setup.mockInput.pressEscape()
  await selected
})

test.concurrent('control-c closes the welcome and releases its input handler', async () => {
  const setup = await createTestRenderer({ width: 100, height: 30 })
  const inputListeners = setup.renderer.keyInput.listenerCount('keypress')
  const selected = mountWelcomeLauncher(
    setup.renderer,
    '/workspace/example',
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
