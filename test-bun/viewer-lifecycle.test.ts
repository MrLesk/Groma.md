import assert from 'node:assert/strict'
import { cp, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'

import { normalizeTerminalPalette } from '@opentui/core'
import { createTestRenderer } from '@opentui/core/testing'

import { loadArchitectureViewModel } from '../src/core.ts'
import {
  mountTerminalViewer,
  startTerminalViewer,
} from '../src/viewers/tui/terminal-viewer.ts'
import {
  fixtureRoot,
  geometry,
  press,
  repositoryRoot,
} from './helpers.ts'

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
    /node:fs|architecture-reader|world-layout|elkjs|groma\/(?:observed|missing|plans)/,
  )
})

test.concurrent('headless groma view startup releases its renderer and input handler', async () => {
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const inputListeners = setup.renderer.keyInput.listenerCount('keypress')
  const app = await startTerminalViewer(fixtureRoot, {
    renderer: setup.renderer,
    palette: normalizeTerminalPalette(),
  })

  assert.equal(
    setup.renderer.keyInput.listenerCount('keypress'),
    inputListeners + 1,
  )
  await setup.renderOnce()
  const frame = setup.captureCharFrame()
  assert.ok(frame.trim().length > 0)
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
  let app: ReturnType<typeof mountTerminalViewer> | undefined
  try {
    await cp(fixtureRoot, root, { recursive: true })
    const response = await loadArchitectureViewModel(root)
    app = mountTerminalViewer(setup.renderer, response, {
      level: 'components',
      currentId: 'missing:legacy',
      repositoryRoot: root,
    })
    await setup.renderOnce()
    assert.match(setup.captureCharFrame(), /Legacy ordering/)

    const document = path.join(
      root,
      'groma/missing/systems/shop/containers/api/components/legacy.md',
    )
    const markdown = await readFile(document, 'utf8')
    await writeFile(
      document,
      markdown.replace('# Legacy ordering', '# Legacy queue'),
    )

    setup.mockInput.pressKey('r')
    await app.refresh()
    await setup.renderOnce()
    const after = setup.captureCharFrame()
    assert.match(after, /Legacy queue/)
    assert.doesNotMatch(after, /Legacy ordering/)
  } finally {
    app?.destroy()
    if (!setup.renderer.isDestroyed) setup.renderer.destroy()
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('headless keys drive the viewer and leave world coordinates unchanged', async () => {
  const response = await loadArchitectureViewModel(repositoryRoot)
  const before = structuredClone(geometry(response.world))
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const app = mountTerminalViewer(setup.renderer, response)
  await setup.renderOnce()

  await press(setup, '+', '-', '=', '_')
  await press(setup, 'enter', 'right', 'left', 'up', 'down')
  await press(setup, 'tab', 'right', 'down', 'enter', 'escape')
  await press(setup, '[', ']', '[', ']')
  await press(setup, 'enter', 'escape')
  assert.equal(setup.renderer.isDestroyed, false)

  assert.deepEqual(geometry(response.world), before)
  app.destroy()
})
