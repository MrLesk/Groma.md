import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { createTestRenderer } from '@opentui/core/testing'

import { mountWelcome } from '../src/welcome.ts'

test.concurrent('the welcome starts on web and returns the entered action', async () => {
  const setup = await createTestRenderer({ width: 100, height: 30 })
  const selected = mountWelcome(
    setup.renderer,
    '/workspace/example',
  )

  setup.mockInput.pressEnter()

  assert.equal(await selected, 'web')
  assert.equal(setup.renderer.isDestroyed, true)
})

test.concurrent('arrows choose one action before enter', async () => {
  const setup = await createTestRenderer({ width: 100, height: 30 })
  const selected = mountWelcome(
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
  const selected = mountWelcome(
    setup.renderer,
    '/workspace/example',
  )

  for (let index = 0; index < 4; index++) setup.mockInput.pressArrow('down')
  setup.mockInput.pressEnter()
  setup.mockInput.pressArrow('down')
  setup.mockInput.pressEnter()
  setup.mockInput.pressArrow('up')
  setup.mockInput.pressArrow('up')
  setup.mockInput.pressEnter()

  assert.equal(await selected, 'scan')
})

test.concurrent('instructions change guide, page content, and return to the launcher', async () => {
  const setup = await createTestRenderer({ width: 110, height: 38 })
  const selected = mountWelcome(
    setup.renderer,
    '/workspace/example',
    'instructions',
  )

  await setup.renderOnce()
  const overviewFrame = setup.captureCharFrame()
  setup.mockInput.pressKey('\u001B[6~')
  await setup.renderOnce()
  const pagedFrame = setup.captureCharFrame()
  setup.mockInput.pressKey('\u001B[5~')
  await setup.renderOnce()
  assert.equal(setup.captureCharFrame(), overviewFrame)
  setup.mockInput.pressKey('j')
  await setup.renderOnce()
  const lineScrolledFrame = setup.captureCharFrame()
  setup.mockInput.pressKey('k')
  await setup.renderOnce()
  assert.equal(setup.captureCharFrame(), overviewFrame)
  setup.mockInput.pressArrow('down')
  await setup.renderOnce()
  const authoringFrame = setup.captureCharFrame()

  assert.notEqual(pagedFrame, overviewFrame)
  assert.notEqual(lineScrolledFrame, overviewFrame)
  assert.equal(authoringFrame.split('Authoring').length - 1, 2)
  assert.match(authoringFrame, /groma create <name> --plan <plan-id>/)

  setup.mockInput.pressBackspace()
  setup.mockInput.pressArrow('up')
  setup.mockInput.pressEnter()

  assert.equal(await selected, 'scan')
})

test.concurrent('the visible Back row returns to the launcher', async () => {
  const setup = await createTestRenderer({ width: 110, height: 35 })
  const selected = mountWelcome(
    setup.renderer,
    '/workspace/example',
  )

  for (let index = 0; index < 3; index++) setup.mockInput.pressArrow('down')
  setup.mockInput.pressEnter()
  setup.mockInput.pressArrow('up')
  setup.mockInput.pressEnter()
  setup.mockInput.pressArrow('up')
  setup.mockInput.pressEnter()

  assert.equal(await selected, 'scan')
})

test.concurrent('escape and q close without choosing an action', async () => {
  for (const key of ['ESCAPE', 'q'] as const) {
    const setup = await createTestRenderer({ width: 100, height: 30 })
    const selected = mountWelcome(
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
  const selected = mountWelcome(
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
  const selected = mountWelcome(
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
