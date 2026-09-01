import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'

import { createTestRenderer } from '@opentui/core/testing'
import { createBacklogPlugin } from '@groma/work-source-backlog'

import { mountWelcome, renderPlainWelcome } from '../src/welcome.ts'
import { loadWelcomeModel } from '../src/welcome/model.ts'
import type { WelcomeModel } from '../src/welcome/model.ts'

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

    const foundBacklog = createBacklogPlugin(() => '/usr/local/bin/backlog')
    const model = await loadWelcomeModel(root, foundBacklog)
    assert.deepEqual(model.plugins, [
      { id: 'backlog.md', status: 'found' },
      { id: 'typescript', status: 'built-in' },
      { id: 'python', status: 'found' },
      { id: 'rust', status: 'missing' },
    ])
    assert.equal(await exists(marker), false)

    const plain = await renderPlainWelcome(root, foundBacklog)
    assert.match(plain, /plugins: backlog\.md: ✓ ready │ typescript: built-in │ python: ✓ ready │ rust: missing/)

    const setup = await createTestRenderer({ width: 110, height: 35 })
    const selected = mountWelcome(setup.renderer, model)
    await setup.renderOnce()
    assert.match(
      setup.captureCharFrame(),
      /plugins: backlog\.md: ✓ ready │ typescript: built-in │ python: ✓ ready │ rust: missing/,
    )
    setup.mockInput.pressEscape()
    await selected
    assert.equal(await exists(marker), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('the welcome explains how to install a missing Backlog command', async () => {
  const missingBacklog = createBacklogPlugin(() => null)
  const model = await loadWelcomeModel('/workspace/example', missingBacklog)
  const plain = await renderPlainWelcome('/workspace/example', missingBacklog)

  assert.deepEqual(model.plugins.slice(0, 2), [
    { id: 'backlog.md', status: 'missing', install: 'bun i -g backlog.md' },
    { id: 'typescript', status: 'built-in' },
  ])
  assert.match(plain, /plugins: backlog\.md: missing \(bun i -g backlog\.md\) │ typescript: built-in/)
})

test.concurrent('the bottom plugin strip stays one row as scanners grow', async () => {
  const compact = await createTestRenderer({ width: 100, height: 30 })
  const many = await createTestRenderer({ width: 100, height: 30 })
  const compactSelected = mountWelcome(compact.renderer, welcomeFixture())
  const manySelected = mountWelcome(many.renderer, {
    ...welcomeFixture(),
    plugins: [
      { id: 'backlog.md', status: 'found' },
      { id: 'typescript', status: 'built-in' },
      ...Array.from({ length: 20 }, (_, index) => ({
        id: `scanner-${index}`,
        status: index % 2 === 0 ? 'found' as const : 'missing' as const,
      })),
    ],
  })

  await compact.renderOnce()
  await many.renderOnce()
  const compactLines = compact.captureCharFrame().split('\n')
  const manyLines = many.captureCharFrame().split('\n')
  const row = (lines: string[], value: string) => lines.findIndex(line => line.includes(value))

  assert.equal(row(manyLines, 'groma web'), row(compactLines, 'groma web'))
  assert.equal(manyLines.filter(line => line.includes('plugins:')).length, 1)
  assert.ok(row(manyLines, 'plugins: backlog.md: ✓ ready │ typescript: built-in') > row(manyLines, 'groma web'))
  assert.ok(row(manyLines, 'navigate') > row(manyLines, 'plugins:'))

  compact.mockInput.pressEscape()
  many.mockInput.pressEscape()
  await Promise.all([compactSelected, manySelected])
})

test.concurrent('the welcome starts on web and returns the entered action', async () => {
  const setup = await createTestRenderer({ width: 100, height: 30 })
  const selected = mountWelcome(
    setup.renderer,
    welcomeFixture(),
  )

  setup.mockInput.pressEnter()

  assert.equal(await selected, 'web')
  assert.equal(setup.renderer.isDestroyed, true)
})

test.concurrent('arrows choose one action before enter', async () => {
  const setup = await createTestRenderer({ width: 100, height: 30 })
  const selected = mountWelcome(
    setup.renderer,
    welcomeFixture(),
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
    welcomeFixture(),
  )

  for (let index = 0; index < 4; index++) setup.mockInput.pressArrow('down')
  setup.mockInput.pressEnter()
  await setup.renderOnce()
  const expanded = setup.captureCharFrame()
  for (const command of ['add', 'install', 'list', 'remove']) {
    assert.match(expanded, new RegExp(`groma scanner ${command}`))
  }
  assert.match(expanded, /plugins: backlog\.md: ✓ ready │ typescript: built-in/)
  assert.match(expanded, /navigate.*Enter run\/open\/toggle.*quit/)
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
    welcomeFixture(),
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
    welcomeFixture(),
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
      welcomeFixture(),
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
    welcomeFixture(),
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
    welcomeFixture(),
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
