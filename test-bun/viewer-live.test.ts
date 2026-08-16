import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'

import { normalizeTerminalPalette } from '@opentui/core'
import { createTestRenderer } from '@opentui/core/testing'

import { scanRepository } from '../src/scanner.ts'
import { startTerminalViewer } from '../src/viewers/tui/terminal-viewer.ts'

function run(command: string, args: string[], cwd: string) {
  return new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', code => {
      resolve({ code, stderr })
    })
  })
}

async function writeTree(root: string, files: Record<string, string>): Promise<void> {
  for (const [relative, source] of Object.entries(files)) {
    const filename = path.join(root, ...relative.split('/'))
    await mkdir(path.dirname(filename), { recursive: true })
    await writeFile(filename, source)
  }
}

async function createLiveRepo(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-view-live-'))
  await writeTree(root, {
    'package.json': JSON.stringify({ name: 'shop', bin: { shop: 'src/cli.ts' } }),
    '.gitignore': 'node_modules/\n',
    'groma/observed/README.md': '# Observed\n',
    'groma/missing/README.md': '# Missing\n',
    'groma/plans/README.md': '# Plans\n',
    'src/cli.ts': "import { scan } from './scanner.ts'\nexport function run() {}\n",
    'src/scanner.ts': 'export function scan() {}\n',
  })
  const init = await run('git', ['init'], root)
  assert.equal(init.code, 0, init.stderr)
  return root
}

async function waitUntil(
  probe: () => Promise<boolean> | boolean,
  timeout = 8000,
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await probe()) return
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error('timed out')
}

async function observedSystems(root: string): Promise<string[]> {
  const directory = path.join(root, 'groma/observed/systems')
  try {
    return await readdir(directory)
  } catch {
    return []
  }
}

test.concurrent('groma view does not scan on open and applies a watched fold', async () => {
  const root = await createLiveRepo()
  const setup = await createTestRenderer({ width: 120, height: 36 })
  let app: Awaited<ReturnType<typeof startTerminalViewer>> | undefined
  try {
    app = await startTerminalViewer(root, {
      renderer: setup.renderer,
      palette: normalizeTerminalPalette(),
    })
    await setup.renderOnce()
    await new Promise(resolve => setTimeout(resolve, 400))
    assert.deepEqual(await observedSystems(root), [])

    await scanRepository(root)
    await app.refresh()
    app.setView({ level: 'components', currentId: 'observed:cli' })
    await setup.renderOnce()
    await setup.renderOnce()
    assert.match(setup.captureCharFrame(), /Cli/)
    assert.doesNotMatch(setup.captureCharFrame(), /Orders/)

    await writeFile(path.join(root, 'src/orders.ts'), 'export function placeOrder() {}\n')
    await writeFile(
      path.join(root, 'src/cli.ts'),
      "import { scan } from './scanner.ts'\nimport { placeOrder } from './orders.ts'\nexport function run() { placeOrder() }\n",
    )
    await waitUntil(async () => {
      await setup.renderOnce()
      return /Orders/.test(setup.captureCharFrame())
    })
    await setup.renderOnce()
    const after = setup.captureCharFrame()
    assert.match(after, /Orders/)
    assert.match(after, /Cli/)
  } finally {
    app?.destroy()
    if (!setup.renderer.isDestroyed) setup.renderer.destroy()
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('groma view applies an architecture Markdown change without R', async () => {
  const root = await createLiveRepo()
  await scanRepository(root)
  const setup = await createTestRenderer({ width: 120, height: 36 })
  let app: Awaited<ReturnType<typeof startTerminalViewer>> | undefined
  try {
    app = await startTerminalViewer(root, {
      renderer: setup.renderer,
      palette: normalizeTerminalPalette(),
    })
    app.setView({ level: 'context', currentId: 'observed:shop' })
    await setup.renderOnce()
    assert.match(setup.captureCharFrame(), /Shop/)

    const document = path.join(root, 'groma/observed/systems/shop/system.md')
    const markdown = await Bun.file(document).text()
    await writeFile(document, markdown.replace('# Shop', '# Shopfront'))
    await waitUntil(async () => {
      await setup.renderOnce()
      return /Shopfront/.test(setup.captureCharFrame())
    })
    assert.doesNotMatch(setup.captureCharFrame(), /Orders/)
  } finally {
    app?.destroy()
    if (!setup.renderer.isDestroyed) setup.renderer.destroy()
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('R reloads Markdown without scanning while the watch is running', async () => {
  const root = await createLiveRepo()
  await scanRepository(root)
  const setup = await createTestRenderer({ width: 120, height: 36 })
  let app: Awaited<ReturnType<typeof startTerminalViewer>> | undefined
  try {
    app = await startTerminalViewer(root, {
      renderer: setup.renderer,
      palette: normalizeTerminalPalette(),
    })
    app.setView({ level: 'context', currentId: 'observed:shop' })
    await setup.renderOnce()
    assert.match(setup.captureCharFrame(), /Shop/)

    const document = path.join(root, 'groma/observed/systems/shop/system.md')
    const markdown = await Bun.file(document).text()
    await writeFile(document, markdown.replace('# Shop', '# Shopfront'))
    setup.mockInput.pressKey('r')
    await app.refresh()
    await setup.renderOnce()
    assert.match(setup.captureCharFrame(), /Shopfront/)
    assert.doesNotMatch(setup.captureCharFrame(), /Orders/)
  } finally {
    app?.destroy()
    if (!setup.renderer.isDestroyed) setup.renderer.destroy()
    await rm(root, { recursive: true, force: true })
  }
})
