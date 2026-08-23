import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'

import type { WorkSource } from '../src/backlog-plugin.ts'
import { scanRepository } from '../src/scanner.ts'
import type { ActiveWorkItem } from '../src/types.ts'
import { startWebViewer } from '../src/viewers/web/server.ts'

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
  const root = await mkdtemp(path.join(tmpdir(), 'groma-web-live-'))
  await writeTree(root, {
    'package.json': JSON.stringify({ name: 'shop', bin: { shop: 'src/cli.ts' } }),
    '.gitignore': 'node_modules/\n',
    'groma/observed/README.md': '# Observed\n',
    'groma/missing/README.md': '# Missing\n',
    'backlog/tasks/.keep': '',
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

async function worldNames(url: string): Promise<string[]> {
  const payload = await (await fetch(`${url}/world.json`)).json() as {
    world: { elements: { name: string }[] }
  }
  return payload.world.elements.map(element => element.name)
}

test.concurrent('groma web does not scan on open and applies a watched fold', async () => {
  const root = await createLiveRepo()
  const server = await startWebViewer(root, { port: 0 })
  try {
    await new Promise(resolve => setTimeout(resolve, 400))
    assert.deepEqual(await observedSystems(root), [])
    assert.ok(!(await worldNames(server.url)).includes('Orders'))

    await scanRepository(root)
    await fetch(server.url)
    assert.ok((await worldNames(server.url)).includes('Cli'))
    assert.ok(!(await worldNames(server.url)).includes('Orders'))

    const events = await fetch(`${server.url}/events`)
    await writeFile(path.join(root, 'src/orders.ts'), 'export function placeOrder() {}\n')
    await writeFile(
      path.join(root, 'src/cli.ts'),
      "import { scan } from './scanner.ts'\nimport { placeOrder } from './orders.ts'\nexport function run() { placeOrder() }\n",
    )
    await waitUntil(async () => (await worldNames(server.url)).includes('Orders'))
    assert.ok((await worldNames(server.url)).includes('Cli'))
    await events.body?.cancel()
  } finally {
    server.close()
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('groma web applies an architecture Markdown change without a refresh', async () => {
  const root = await createLiveRepo()
  await scanRepository(root)
  const server = await startWebViewer(root, { port: 0 })
  try {
    await fetch(server.url)
    assert.ok((await worldNames(server.url)).includes('Shop'))

    const events = await fetch(`${server.url}/events`)
    const reader = events.body!.getReader()
    const decoder = new TextDecoder()
    let pushed = ''
    const document = path.join(root, 'groma/observed/systems/shop/system.md')
    const markdown = await Bun.file(document).text()
    await writeFile(document, markdown.replace('# Shop', '# Shopfront'))
    await waitUntil(async () => {
      const { value } = await reader.read()
      if (value) pushed += decoder.decode(value, { stream: true })
      return pushed.includes('"generation":2') && pushed.includes('Shopfront')
    })
    assert.ok((await worldNames(server.url)).includes('Shopfront'))
    assert.ok(!(await worldNames(server.url)).includes('Orders'))
    await reader.cancel()
  } finally {
    server.close()
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('groma web ships agent pins and republishes them when the work source changes', async () => {
  const root = await createLiveRepo()
  await scanRepository(root)
  let items: ActiveWorkItem[] = [{
    id: 'TASK-PIN',
    title: 'Change Shop',
    status: 'In Progress',
    assignees: ['@codex'],
    references: ['shop'],
    modifiedFiles: [],
    acceptance: { done: 1, total: 2 },
  }]
  let changed: () => void = () => {}
  const workSource: WorkSource = {
    read: async () => items,
    watch(onChange) {
      changed = onChange
      return { close() {} }
    },
  }
  const server = await startWebViewer(root, { port: 0, workSource })
  try {
    const payload = await (await fetch(`${server.url}/world.json`)).json() as {
      pins: { key: string; elementId: string; done: number; total: number }[]
    }
    assert.deepEqual(payload.pins.map(pin => [pin.key, pin.elementId, pin.done, pin.total]), [['@codex TASK-PIN', 'observed:shop', 1, 2]])

    const events = await fetch(`${server.url}/events`)
    const reader = events.body!.getReader()
    const decoder = new TextDecoder()
    let pushed = ''
    items = [{ ...items[0]!, status: 'Done', acceptance: { done: 2, total: 2 } }]
    changed()
    await waitUntil(async () => {
      const { value } = await reader.read()
      if (value) pushed += decoder.decode(value, { stream: true })
      return pushed.includes('"generation":2') && pushed.includes('"status":"Done"')
    })
    await reader.cancel()
  } finally {
    server.close()
    await rm(root, { recursive: true, force: true })
  }
})
