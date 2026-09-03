import assert from 'node:assert/strict'
import { cp, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'

import { createTestRenderer } from '@opentui/core/testing'
import { EMPTY_WORK_SNAPSHOT } from '@groma/work-source'
import type { WorkSource } from '@groma/work-source'

import { startTerminalViewer } from '../src/view-host.ts'
import { mountTerminalViewer } from '../src/viewers/tui/terminal-viewer.ts'
import {
  fixtureRoot,
  press,
  repositoryRoot,
  terminalModel,
  viewerFixtureRoot,
} from './helpers.ts'

function emptyWorkSource(): WorkSource {
  return {
    read: async () => EMPTY_WORK_SNAPSHOT,
    readItem: async () => assert.fail('unexpected task detail read'),
    watch: () => ({ close() {} }),
  }
}

async function listTypeScript(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await listTypeScript(entryPath))
    else if (entry.name.endsWith('.ts')) files.push(entryPath)
  }
  return files
}

test.concurrent('viewer modules consume only the core response and fixed world', async () => {
  const sources = await Promise.all(
    (await listTypeScript(path.join(repositoryRoot, 'src/viewers/tui')))
      .map(filename => readFile(filename, 'utf8')),
  )
  const viewerSource = sources.join('\n')

  assert.doesNotMatch(
    viewerSource,
    /node:fs|node:child_process|architecture-reader|architecture-watch|work\/backlog|loadArchitectureViewModel|repositoryRoot|watchScan|world-layout|elkjs|groma\/(?:observed|missing|plans)/,
  )
})

test.concurrent('headless groma view startup releases its renderer and input handler', async () => {
  const setup = await createTestRenderer({ width: 120, height: 36 })
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
})

test.concurrent('R reloads the world from core and keeps the current view', async () => {
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

    setup.mockInput.pressKey('r')
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
  const app = mountTerminalViewer(setup.renderer, response)
  await setup.renderOnce()

  await press(setup, 'enter', 'right', 'left', 'up', 'down')
  await press(setup, 'tab', 'right', 'down', 'enter', 'escape')
  await press(setup, '[', ']', '[', ']')
  await press(setup, 'enter', 'escape')
  assert.equal(setup.renderer.isDestroyed, false)

  assert.deepEqual(response.sheet, before)
  app.destroy()
}, 20000)
