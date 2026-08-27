import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'

import type { WorkSource } from '../src/work/backlog.ts'
import { scanRepository } from '../src/scanner.ts'
import type { WorkItem, WorkSnapshot } from '../src/types.ts'
import { startWebViewer } from '../src/viewers/web/server.ts'

function run(command: string, args: string[], cwd: string) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => {
      stdout += chunk
    })
    child.stderr.on('data', chunk => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', code => {
      resolve({ code, stdout, stderr })
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

async function commitAll(root: string, subject: string): Promise<void> {
  assert.equal((await run('git', ['add', '.'], root)).code, 0)
  const result = await run('git', [
    '-c', 'user.name=Groma Test',
    '-c', 'user.email=groma@example.test',
    'commit', '-m', subject,
  ], root)
  assert.equal(result.code, 0, result.stderr)
}

async function createLiveRepo(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-web-live-'))
  await writeTree(root, {
    'package.json': JSON.stringify({ name: 'shop', bin: { shop: 'src/cli.ts' } }),
    '.gitignore': 'node_modules/\n',
    'groma/README.md': '# Shop\n\nShop architecture.\n',
    'groma/observed/README.md': '# Observed\n',
    'groma/missing/README.md': '# Missing\n',
    'backlog/tasks/.keep': '',
    'groma/plans/README.md': '# Plans\n',
    'src/cli.ts': "import { scan } from './scanner.ts'\nexport function run() {}\n",
    'src/scanner.ts': 'export function scan() {}\n',
  })
  const init = await run('git', ['init'], root)
  assert.equal(init.code, 0, init.stderr)
  await commitAll(root, 'Initial architecture')
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

test.concurrent('groma web omits the project profile when its README is incomplete', async () => {
  const root = await createLiveRepo()
  await writeFile(path.join(root, 'groma', 'README.md'), '# Shop\n')
  const server = await startWebViewer(root, { port: 0 })
  try {
    assert.equal((await fetch(server.url)).status, 200)
    const payload = await (await fetch(`${server.url}/world.json`)).json() as { project: unknown }
    assert.equal(payload.project, null)
  } finally {
    server.close()
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('groma web serves a selected Git snapshot without changing repository state', async () => {
  const root = await createLiveRepo()
  await writeFile(path.join(root, 'groma', 'README.md'), '# Current shop\n\nCurrent architecture.\n')
  const before = await run('git', ['status', '--porcelain=v1'], root)
  const server = await startWebViewer(root, { port: 0 })
  try {
    const current = await (await fetch(`${server.url}/world.json`)).json() as {
      project: { name: string }
      revisions: { id: string; subject: string }[]
    }
    assert.equal(current.project.name, 'Current shop')
    assert.equal(current.revisions[0]!.subject, 'Initial architecture')

    const revision = current.revisions[0]!.id
    const historical = await (await fetch(`${server.url}/world.json?revision=${revision}`)).json() as {
      project: { name: string }
      revision: { id: string }
      work: { items: unknown[] }
      pins: unknown[]
    }
    assert.equal(historical.project.name, 'Shop')
    assert.equal(historical.revision.id, revision)
    assert.deepEqual(historical.work.items, [])
    assert.deepEqual(historical.pins, [])
    assert.equal((await fetch(`${server.url}/world.json?revision=unknown`)).status, 404)

    const after = await run('git', ['status', '--porcelain=v1'], root)
    assert.equal(after.code, 0, after.stderr)
    assert.equal(after.stdout, before.stdout)
  } finally {
    server.close()
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('groma web marks obsolete Markdown revisions unsupported', async () => {
  const root = await createLiveRepo()
  const actor = path.join(root, 'groma', 'observed', 'actors', 'legacy.md')
  await mkdir(path.dirname(actor), { recursive: true })
  await writeFile(actor, '---\nid: legacy\nkind: person\n---\n\n# Legacy\n')
  await commitAll(root, 'Old person contract')
  await writeFile(actor, '---\nid: legacy\nkind: actor\n---\n\n# Legacy\n')
  await commitAll(root, 'Current actor contract')

  const server = await startWebViewer(root, { port: 0 })
  try {
    const payload = await (await fetch(`${server.url}/world.json`)).json() as {
      revisions: { id: string; subject: string; compatible: boolean }[]
    }
    const current = payload.revisions.find(revision => revision.subject === 'Current actor contract')
    const obsolete = payload.revisions.find(revision => revision.subject === 'Old person contract')
    assert.equal(current?.compatible, true)
    assert.equal(obsolete?.compatible, false)
    const response = await fetch(`${server.url}/world.json?revision=${obsolete!.id}`)
    assert.equal(response.status, 422)
    assert.equal(await response.text(), 'Unsupported Groma revision')
  } finally {
    server.close()
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('groma web does not scan on open and applies a watched fold', async () => {
  const root = await createLiveRepo()
  const server = await startWebViewer(root, { port: 0 })
  try {
    await new Promise(resolve => setTimeout(resolve, 400))
    assert.deepEqual(await observedSystems(root), [])
    assert.ok(!(await worldNames(server.url)).includes('Orders'))

    await scanRepository(root)
    await waitUntil(async () => (await worldNames(server.url)).includes('Cli'))
    assert.ok((await worldNames(server.url)).includes('Cli'))
    assert.match(await (await fetch(server.url)).text(), /"name":"Cli"/)
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

test.concurrent('groma web saves the project profile and publishes it without a refresh', async () => {
  const root = await createLiveRepo()
  const server = await startWebViewer(root, { port: 0 })
  try {
    const events = await fetch(`${server.url}/events`)
    const reader = events.body!.getReader()
    const decoder = new TextDecoder()
    await reader.read()

    const response = await fetch(`${server.url}/project`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Supply map', description: 'Shows supply responsibilities.' }),
    })
    assert.equal(response.status, 200)

    let pushed = ''
    await waitUntil(async () => {
      const { value } = await reader.read()
      if (value) pushed += decoder.decode(value, { stream: true })
      return pushed.includes('"generation":2') && pushed.includes('"name":"Supply map"')
    })
    const payload = await (await fetch(`${server.url}/world.json`)).json() as {
      project: { name: string; description: string; descriptionBlocks: unknown[] }
    }
    assert.equal(payload.project.name, 'Supply map')
    assert.equal(payload.project.description, 'Shows supply responsibilities.')
    assert.equal(payload.project.descriptionBlocks.length, 1)
    assert.equal(
      await readFile(path.join(root, 'groma', 'README.md'), 'utf8'),
      '# Supply map\n\nShows supply responsibilities.\n',
    )
    await reader.cancel()
  } finally {
    server.close()
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('groma web loads work asynchronously and updates only the work overlay', async () => {
  const root = await createLiveRepo()
  await scanRepository(root)
  let items: WorkItem[] = [{
    id: 'TASK-PIN',
    title: 'Change Shop',
    status: 'In Progress',
    assignees: ['@codex'],
    description: '',
    references: ['shop'],
    modifiedFiles: [],
    criteria: [{ text: 'a', checked: true }, { text: 'b', checked: false }],
  }]
  const snapshot = (): WorkSnapshot => ({
    statuses: ['To Do', 'In Progress', 'Done'],
    defaultStatus: 'To Do',
    items,
  })
  let reads = 0
  let resolveFirst!: (work: WorkSnapshot) => void
  const firstRead = new Promise<WorkSnapshot>(resolve => {
    resolveFirst = resolve
  })
  let changed: () => void = () => {}
  const workSource: WorkSource = {
    read: async () => {
      reads += 1
      return reads === 1 ? firstRead : snapshot()
    },
    watch(onChange) {
      changed = onChange
      return { close() {} }
    },
  }
  const server = await startWebViewer(root, { port: 0, workSource })
  try {
    type LivePayload = {
      generation: number
      workGeneration: number
      world: unknown
      sheet: unknown
      work: { statuses: string[]; defaultStatus: string; items: { id: string }[] }
      pins: { key: string; elementId: string; done: number; total: number }[]
    }
    await waitUntil(() => reads === 1)
    const initial = await (await fetch(`${server.url}/world.json`)).json() as LivePayload
    assert.equal(initial.workGeneration, 0)
    assert.deepEqual(initial.work.items, [])
    assert.deepEqual(initial.pins, [])

    const events = await fetch(`${server.url}/events`)
    const reader = events.body!.getReader()
    const decoder = new TextDecoder()
    const firstEvent = await reader.read()
    assert.match(decoder.decode(firstEvent.value), /^event: world/m)

    resolveFirst(snapshot())
    let pushed = ''
    await waitUntil(async () => {
      const { value } = await reader.read()
      if (value) pushed += decoder.decode(value, { stream: true })
      return pushed.includes('event: work') && pushed.includes('"workGeneration":1')
    })
    const loaded = await (await fetch(`${server.url}/world.json`)).json() as LivePayload
    assert.equal(loaded.generation, initial.generation)
    assert.deepEqual(loaded.world, initial.world)
    assert.deepEqual(loaded.sheet, initial.sheet)
    assert.deepEqual(loaded.work.statuses, ['To Do', 'In Progress', 'Done'])
    assert.equal(loaded.work.defaultStatus, 'To Do')
    assert.deepEqual(loaded.work.items.map(item => item.id), ['TASK-PIN'])
    assert.deepEqual(loaded.pins.map(pin => [pin.key, pin.elementId, pin.done, pin.total]), [['@codex TASK-PIN', 'observed:shop', 1, 2]])

    await fetch(server.url)
    assert.equal(reads, 1)

    pushed = ''
    items = [{ ...items[0]!, status: 'Done', criteria: items[0]!.criteria.map(criterion => ({ ...criterion, checked: true })) }]
    changed()
    await waitUntil(async () => {
      const { value } = await reader.read()
      if (value) pushed += decoder.decode(value, { stream: true })
      return pushed.includes('"workGeneration":2') && pushed.includes('"status":"Done"')
    })
    assert.doesNotMatch(pushed, /event: world/)
    assert.equal(reads, 2)
    const changedPayload = await (await fetch(`${server.url}/world.json`)).json() as LivePayload
    assert.equal(changedPayload.generation, initial.generation)
    assert.deepEqual(changedPayload.world, initial.world)
    assert.deepEqual(changedPayload.sheet, initial.sheet)
    assert.match(await (await fetch(server.url)).text(), /"workGeneration":2.*"status":"Done"/)
    assert.equal(reads, 2)
    await reader.cancel()
  } finally {
    server.close()
    await rm(root, { recursive: true, force: true })
  }
})
