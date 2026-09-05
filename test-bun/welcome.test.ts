import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'

import { createBacklogPlugin } from '@groma/work-source-backlog'
import { createTestRenderer } from '@opentui/core/testing'

import { mountWelcome } from '../src/welcome.ts'
import { loadWelcomeModel } from '../src/welcome/model.ts'
import type { WelcomeModel } from '../src/welcome/model.ts'
import { viewerFixtureRoot } from './helpers.ts'

function welcomeFixture(): WelcomeModel {
  return {
    project: 'example',
    folder: '/workspace/example',
    status: 'Architecture ready',
    plugins: [
      { id: 'backlog.md', status: 'found' },
      { id: 'typescript', status: 'built-in' },
    ],
  }
}

async function writeTree(root: string, files: Record<string, string>): Promise<void> {
  for (const [relative, source] of Object.entries(files)) {
    const filename = path.join(root, ...relative.split('/'))
    await mkdir(path.dirname(filename), { recursive: true })
    await writeFile(filename, source)
  }
}

async function exists(filename: string): Promise<boolean> {
  try {
    await stat(filename)
    return true
  } catch {
    return false
  }
}

test.concurrent('the welcome derives scanner readiness without executing modules', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-welcome-scanners-'))
  const marker = path.join(root, 'python-loaded')
  try {
    await writeTree(root, {
      'groma/scanners.json': JSON.stringify({
        scanners: [
          { id: 'python', source: './plugins/python' },
          { id: 'rust', source: './plugins/rust' },
        ],
      }),
      'plugins/python/package.json': JSON.stringify({
        name: 'fixture-python',
        version: '1.0.0',
        type: 'module',
        groma: { scanner: { id: 'python', entry: './index.js' } },
      }),
      'plugins/python/index.js': `await Bun.write(${JSON.stringify(marker)}, 'loaded')\nexport default {}\n`,
      'plugins/rust/package.json': JSON.stringify({
        name: 'fixture-rust',
        version: '1.0.0',
        type: 'module',
        groma: { scanner: { id: 'rust', entry: './index.js' } },
      }),
    })

    const model = await loadWelcomeModel(
      root,
      createBacklogPlugin(() => '/usr/local/bin/backlog'),
    )
    assert.deepEqual(model.plugins, [
      { id: 'backlog.md', status: 'found' },
      { id: 'typescript', status: 'built-in' },
      { id: 'python', status: 'found' },
      { id: 'rust', status: 'missing' },
    ])
    assert.equal(await exists(marker), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('the welcome model reports a missing Backlog command', async () => {
  const model = await loadWelcomeModel(
    viewerFixtureRoot,
    createBacklogPlugin(() => null),
  )

  assert.equal(
    model.plugins.find(plugin => plugin.id === 'backlog.md')?.status,
    'missing',
  )
})

test.concurrent('the welcome starts on web and returns the entered action', async () => {
  const setup = await createTestRenderer({ width: 100, height: 30 })
  const selected = mountWelcome(setup.renderer, welcomeFixture())

  setup.mockInput.pressEnter()

  assert.equal(await selected, 'web')
  assert.equal(setup.renderer.isDestroyed, true)
})

test.concurrent('a production handoff suspends the welcome until its action owns the process', async () => {
  const setup = await createTestRenderer({ width: 100, height: 30 })
  const selected = mountWelcome(
    setup.renderer,
    welcomeFixture(),
    'launcher',
    'suspend',
  )

  setup.mockInput.pressEnter()

  assert.equal(await selected, 'web')
  assert.equal(setup.renderer.isDestroyed, false)
  setup.renderer.destroy()
})

test.concurrent('arrows choose one action before enter', async () => {
  const setup = await createTestRenderer({ width: 100, height: 30 })
  const selected = mountWelcome(setup.renderer, welcomeFixture())

  setup.mockInput.pressArrow('down')
  setup.mockInput.pressArrow('down')
  setup.mockInput.pressArrow('up')
  setup.mockInput.pressEnter()

  assert.equal(await selected, 'view')
})

test.concurrent('the Back action returns to the launcher', async () => {
  const setup = await createTestRenderer({ width: 110, height: 35 })
  const selected = mountWelcome(setup.renderer, welcomeFixture())

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
    const selected = mountWelcome(setup.renderer, welcomeFixture())

    setup.mockInput.pressKey(key)

    assert.equal(await selected, undefined)
    assert.equal(setup.renderer.isDestroyed, true)
  }
})

test.concurrent('control-c closes the welcome and releases its input handler', async () => {
  const setup = await createTestRenderer({ width: 100, height: 30 })
  const inputListeners = setup.renderer.keyInput.listenerCount('keypress')
  const selected = mountWelcome(setup.renderer, welcomeFixture())

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

test.concurrent('instructions Tab gives arrows the same reading scroll as j/k and returns arrows to guide selection', async () => {
  const setup = await createTestRenderer({ width: 100, height: 30 })
  const selected = mountWelcome(setup.renderer, welcomeFixture(), 'instructions')
  const frame = async () => { await setup.renderOnce(); return setup.captureCharFrame() }
  try {
    setup.mockInput.pressKey('TAB')
    const top = await frame()
    setup.mockInput.pressArrow('down')
    const down = await frame()
    assert.notEqual(down, top)
    setup.mockInput.pressKey('k')
    assert.equal(await frame(), top)
    setup.mockInput.pressKey('j')
    assert.equal(await frame(), down)
    setup.mockInput.pressArrow('up')
    assert.equal(await frame(), top)
    setup.mockInput.pressKey('TAB')
    const list = await frame()
    setup.mockInput.pressArrow('down')
    assert.notEqual((await frame()).split('\n').slice(0, 20).join('\n'), list.split('\n').slice(0, 20).join('\n'))
  } finally {
    setup.mockInput.pressCtrlC()
    await selected
  }
})

test.concurrent('advanced commands retain selection while arrows and j/k scroll in reading focus', async () => {
  const setup = await createTestRenderer({ width: 100, height: 30 })
  const selected = mountWelcome(setup.renderer, welcomeFixture())
  const frame = async () => { await setup.renderOnce(); return setup.captureCharFrame() }
  try {
    for (let index = 0; index < 4; index++) setup.mockInput.pressArrow('down')
    setup.mockInput.pressEnter()
    for (let index = 0; index < 10; index++) setup.mockInput.pressArrow('down')
    setup.mockInput.pressKey('TAB')
    const top = await frame()
    setup.mockInput.pressArrow('down')
    const down = await frame()
    assert.notEqual(down, top)
    assert.equal(down.split('\n').slice(0, 24).join('\n'), top.split('\n').slice(0, 24).join('\n'))
    setup.mockInput.pressKey('k')
    assert.equal(await frame(), top)
    setup.mockInput.pressKey('j')
    assert.equal(await frame(), down)
    setup.mockInput.pressArrow('up')
    assert.equal(await frame(), top)
  } finally {
    setup.mockInput.pressCtrlC()
    await selected
  }
})
