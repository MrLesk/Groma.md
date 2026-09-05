import assert from 'node:assert/strict'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'

import { createTestRenderer } from '@opentui/core/testing'
import { EMPTY_WORK_SNAPSHOT } from '@groma/work-source'
import type { WorkSource } from '@groma/work-source'

import { startTerminalViewer } from '../src/view-host.ts'
import { noComponentsTitle } from '../src/empty-world.ts'
import { mountTerminalViewer } from '../src/viewers/tui/terminal-viewer.ts'
import {
  fixtureRoot,
  press,
  repositoryRoot,
  terminalModel,
  viewerFixtureRoot,
} from './helpers.ts'

const emptyFixtureRoot = path.join(repositoryRoot, 'test', 'fixtures', 'empty-project')

function emptyWorkSource(): WorkSource {
  return {
    read: async () => EMPTY_WORK_SNAPSHOT,
    readItem: async () => assert.fail('unexpected task detail read'),
    watch: () => ({ close() {} }),
  }
}

test.concurrent('headless groma view startup releases its renderer and input handler', async () => {
  const setup = await createTestRenderer({ width: 120, height: 36 })
  try {
    const inputListeners = setup.renderer.keyInput.listenerCount('keypress')
    const app = await startTerminalViewer(fixtureRoot, {
      renderer: setup.renderer,
      workSource: emptyWorkSource(),
    })

    assert.equal(
      setup.renderer.keyInput.listenerCount('keypress'),
      inputListeners + 1,
    )
    await setup.renderOnce()
    setup.mockInput.pressEscape()
    await setup.renderOnce()
    assert.equal(setup.renderer.isDestroyed, false)
    setup.mockInput.pressCtrlC()
    await app.closed
    assert.equal(setup.renderer.isDestroyed, true)
    assert.equal(setup.renderer.root.getChildrenCount(), 0)
    assert.equal(
      setup.renderer.keyInput.listenerCount('keypress'),
      inputListeners,
    )
  } finally {
    if (!setup.renderer.isDestroyed) setup.renderer.destroy()
  }
})

test.concurrent('refresh reloads the world from core and keeps the current view', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-refresh-'))
  const setup = await createTestRenderer({ width: 120, height: 36 })
  let app: Awaited<ReturnType<typeof startTerminalViewer>> | undefined
  try {
    await cp(fixtureRoot, root, { recursive: true })
    app = await startTerminalViewer(root, {
      renderer: setup.renderer,
      workSource: emptyWorkSource(),
    })
    app.setView({ level: 'components', currentId: 'inventory' })
    await setup.renderOnce()
    assert.match(setup.captureCharFrame(), /Inventory/)

    const document = path.join(
      root,
      'groma/systems/shop/containers/api/components/inventory.md',
    )
    const markdown = await readFile(document, 'utf8')
    await writeFile(
      document,
      markdown.replace('title: Inventory', 'title: Stock queue'),
    )

    await app.refresh()
    await setup.renderOnce()
    const after = setup.captureCharFrame()
    assert.match(after, /Stock queue/)
    assert.doesNotMatch(after, /Inventory/)
  } finally {
    app?.destroy()
    if (!setup.renderer.isDestroyed) setup.renderer.destroy()
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('headless keys drive the viewer and leave world coordinates unchanged', async () => {
  const response = await terminalModel(viewerFixtureRoot)
  const before = structuredClone(response.sheet)
  const setup = await createTestRenderer({ width: 120, height: 36 })
  try {
    const app = mountTerminalViewer(setup.renderer, response)
    await setup.renderOnce()

    await press(setup, 'enter', 'right', 'left', 'up', 'down')
    await press(setup, 'tab', 'right', 'down', 'enter', 'escape')
    await press(setup, '[', ']', '[', ']')
    await press(setup, 'enter', 'escape')
    assert.equal(setup.renderer.isDestroyed, false)

    assert.deepEqual(response.sheet, before)
    app.destroy()
  } finally {
    if (!setup.renderer.isDestroyed) setup.renderer.destroy()
  }
}, 20000)

test.concurrent('an empty world shows its next steps until a live update supplies the map', async () => {
  const empty = await terminalModel(emptyFixtureRoot)
  const full = await terminalModel(viewerFixtureRoot)
  const setup = await createTestRenderer({ width: 120, height: 36 })
  try {
    let refreshes = 0
    const app = mountTerminalViewer(setup.renderer, empty, {
      onRefresh: () => { refreshes += 1 },
    })

    await setup.renderOnce()
    const before = setup.captureCharFrame()
    assert.ok(before.includes(noComponentsTitle))

    await press(setup, 'r')
    assert.equal(refreshes, 1)

    app.update(full)
    await setup.renderOnce()
    assert.ok(!setup.captureCharFrame().includes(noComponentsTitle))
    app.destroy()
  } finally {
    if (!setup.renderer.isDestroyed) setup.renderer.destroy()
  }
})

test.concurrent('Escape, q and Ctrl+C each leave the empty viewer', async () => {
  const empty = await terminalModel(emptyFixtureRoot)
  for (const key of ['escape', 'q', 'ctrl-c'] as const) {
    const setup = await createTestRenderer({ width: 120, height: 36 })
    try {
      const app = mountTerminalViewer(setup.renderer, empty)
      await setup.renderOnce()
      if (key === 'escape') setup.mockInput.pressEscape()
      else if (key === 'ctrl-c') setup.mockInput.pressCtrlC()
      else setup.mockInput.pressKey(key)
      await app.closed
      assert.equal(setup.renderer.isDestroyed, true)
    } finally {
      if (!setup.renderer.isDestroyed) setup.renderer.destroy()
    }
  }
})
