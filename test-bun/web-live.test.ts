import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'

import type { WorkSource } from '@groma/work-source'

import { scanRepository } from '../src/scanner.ts'
import type { WorkItem, WorkSnapshot } from '../src/types.ts'
import { startWebViewer } from '../src/viewers/web/server.ts'

async function removeTree(root: string): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try { await rm(root, { recursive: true, force: true }); return }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EBUSY' || attempt === 9) throw error
      await Bun.sleep(100)
    }
  }
}

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
    'groma/index.md': '---\nokf_version: "0.2"\n---\n',
    'groma/project.md': `---
type: Groma Project
title: Shop
groma:
  profile: architecture
---

Shop architecture.
`,
    'groma/observed/index.md': '# Observed\n',
    'groma/missing/index.md': '# Missing\n',
    'backlog/tasks/.keep': '',
    'groma/plans/index.md': '# Plans\n',
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
    world: { elements: { title: string }[] }
  }
  return payload.world.elements.map(element => element.title)
}

test.concurrent('groma web rejects a package whose project concept has no overview', async () => {
  const root = await createLiveRepo()
  await writeFile(path.join(root, 'groma', 'project.md'), `---
type: Groma Project
title: Shop
groma:
  profile: architecture
---
`)
  try {
    await assert.rejects(
      startWebViewer(root, { port: 0 }),
      /project body must start with overview prose/,
    )
  } finally {
    await removeTree(root)
  }
})

test.concurrent('groma web serves a selected Git snapshot without changing repository state', async () => {
  const root = await createLiveRepo()
  await writeFile(path.join(root, 'groma', 'project.md'), `---
type: Groma Project
title: Current shop
groma:
  profile: architecture
---

Current architecture.
`)
  const before = await run('git', ['status', '--porcelain=v1'], root)
  const server = await startWebViewer(root, { port: 0 })
  try {
    const current = await (await fetch(`${server.url}/world.json`)).json() as {
      project: { title: string }
      revisions: { id: string; subject: string }[]
    }
    assert.equal(current.project.title, 'Current shop')
    assert.equal(current.revisions[0]!.subject, 'Initial architecture')

    const revision = current.revisions[0]!.id
    const historical = await (await fetch(`${server.url}/world.json?revision=${revision}`)).json() as {
      project: { title: string }
      revision: { id: string }
      work: { items: unknown[] }
      pins: unknown[]
    }
    assert.equal(historical.project.title, 'Shop')
    assert.equal(historical.revision.id, revision)
    assert.deepEqual(historical.work.items, [])
    assert.deepEqual(historical.pins, [])
    assert.equal((await fetch(`${server.url}/world.json?revision=unknown`)).status, 404)

    const after = await run('git', ['status', '--porcelain=v1'], root)
    assert.equal(after.code, 0, after.stderr)
    assert.equal(after.stdout, before.stdout)
  } finally {
    await server.close()
    await removeTree(root)
  }
})

function expectedCode(version: 'current' | 'historical') {
  return [
    { file: 'src/details.ts', declarations: [
      { kind: 'function', name: `${version}Hidden`, line: 1, scope: 'internal', entry: false },
      { kind: 'class', name: 'Details', line: 4, scope: 'export', entry: true, members: [
        { name: 'run', line: 5, scope: 'public', entry: false },
        { name: 'prepare', line: 6, scope: 'protected', entry: false },
        { name: 'finish', line: 7, scope: 'private', entry: false },
      ] },
      { kind: 'function', name: `${version}Arrow`, line: 9, scope: 'internal', entry: false },
    ] },
    { file: 'src/helpers.ts', declarations: [
      { kind: 'function', name: 'helperEntry', line: 1, scope: 'export', entry: true },
      { kind: 'function', name: `${version}Helper`, line: 2, scope: 'internal', entry: false },
    ] },
  ]
}

test.concurrent('groma web reads component code on demand from the selected revision', async () => {
  const root = await createLiveRepo()
  const historicalSource = 'function historicalHidden() {\n  function nestedHistorical() {}\n}\nexport class Details {\n  run() {}\n  protected prepare() {}\n  private finish() {}\n}\nconst historicalArrow = () => true\n'
  const currentSource = 'function currentHidden() {\n  const nestedArrow = () => false\n}\nexport class Details {\n  public run() {}\n  protected prepare() {}\n  private finish() {}\n}\nconst currentArrow = () => true\n'
  const historicalHelpers = 'export function helperEntry() {}\nconst historicalHelper = function () {}\n'
  const currentHelpers = 'export function helperEntry() {}\nconst currentHelper = function () {}\n'
  await writeTree(root, {
    'groma/observed/systems/shop/system.md': '---\ntype: C4 System\ntitle: Shop\nstatus: stable\ngroma:\n  id: shop\n---\n',
    'groma/observed/systems/shop/containers/web/container.md': '---\ntype: C4 Container\ntitle: Web\nstatus: stable\ngroma:\n  id: web\n  parent: shop\n---\n',
    'groma/observed/systems/shop/containers/web/components/details.md': '---\ntype: C4 Component\ntitle: Details\nstatus: stable\ngroma:\n  id: details\n  parent: web\n  code:\n    - scanner: typescript\n      file: src/details.ts\n      symbol: Details\n    - scanner: typescript\n      file: src/helpers.ts\n      symbol: helperEntry\n---\n',
    'src/details.ts': historicalSource,
    'src/helpers.ts': historicalHelpers,
  })
  await commitAll(root, 'Versioned source component')
  await writeFile(path.join(root, 'src', 'details.ts'), currentSource)
  await writeFile(path.join(root, 'src', 'helpers.ts'), currentHelpers)
  const server = await startWebViewer(root, { port: 0 })
  try {
    const page = await (await fetch(server.url)).text()
    assert.doesNotMatch(page, /currentHidden/)
    const world = await (await fetch(`${server.url}/world.json`)).json() as {
      revisions: { id: string; subject: string }[]
    }
    const revision = world.revisions.find(candidate => candidate.subject === 'Versioned source component')!
    const selected = new URLSearchParams({ element: 'observed:details', file: 'src/details.ts' })
    const current = await (await fetch(`${server.url}/source.json?${selected}`)).json() as { source: string }
    assert.equal(current.source, currentSource)
    assert.deepEqual(await (await fetch(`${server.url}/code.json?element=observed:details`)).json(), expectedCode('current'))
    selected.set('revision', revision.id)
    const historical = await (await fetch(`${server.url}/source.json?${selected}`)).json() as { source: string }
    assert.equal(historical.source, historicalSource)
    assert.deepEqual(await (await fetch(`${server.url}/code.json?element=observed:details&revision=${revision.id}`)).json(), expectedCode('historical'))
    selected.set('file', 'src/other.ts')
    assert.equal((await fetch(`${server.url}/source.json?${selected}`)).status, 404)
  } finally {
    await server.close()
    await removeTree(root)
  }
})

test.concurrent('groma web marks obsolete Markdown revisions unsupported', async () => {
  const root = await createLiveRepo()
  const actor = path.join(root, 'groma', 'observed', 'actors', 'legacy.md')
  await mkdir(path.dirname(actor), { recursive: true })
  await writeFile(actor, '---\nid: legacy\nkind: person\n---\n\n# Legacy\n')
  await commitAll(root, 'Old person contract')
  await writeFile(actor, '---\ntype: C4 Actor\ntitle: Legacy\nstatus: stable\ngroma:\n  id: legacy\n---\n')
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
    await server.close()
    await removeTree(root)
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
    assert.match(await (await fetch(server.url)).text(), /"title":"Cli"/)
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
    await server.close()
    await removeTree(root)
  }
})

test.concurrent('groma web applies an architecture Markdown change without a refresh', async () => {
  const root = await createLiveRepo()
  await scanRepository(root)
  const server = await startWebViewer(root, { port: 0 })
  try {
    await fetch(server.url)
    assert.ok((await worldNames(server.url)).includes('Shop'))
    type MapPayload = {
      generation: number
      timings: {
        architectureLoadMilliseconds: number
        placementMilliseconds: number
        routingMilliseconds: number
        totalMilliseconds: number
      }
    }
    const initial = await (await fetch(`${server.url}/world.json`)).json() as MapPayload

    const events = await fetch(`${server.url}/events`)
    const reader = events.body!.getReader()
    const decoder = new TextDecoder()
    let pushed = ''
    const document = path.join(root, 'groma/observed/systems/shop/system.md')
    const markdown = await Bun.file(document).text()
    await writeFile(document, markdown.replace('title: Shop', 'title: Shopfront'))
    await waitUntil(async () => {
      const { value } = await reader.read()
      if (value) pushed += decoder.decode(value, { stream: true })
      return pushed.includes('"generation":2') && pushed.includes('"timings":') && pushed.includes('Shopfront')
    })
    const changed = await (await fetch(`${server.url}/world.json`)).json() as MapPayload
    assert.equal(changed.generation, initial.generation + 1)
    assert.ok(changed.timings.totalMilliseconds >= changed.timings.architectureLoadMilliseconds)
    assert.ok(changed.timings.totalMilliseconds >= changed.timings.placementMilliseconds + changed.timings.routingMilliseconds)
    assert.ok((await worldNames(server.url)).includes('Shopfront'))
    assert.ok(!(await worldNames(server.url)).includes('Orders'))
    await reader.cancel()
  } finally {
    await server.close()
    await removeTree(root)
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
      body: JSON.stringify({
        title: 'Supply map',
        description: 'A concise supply architecture summary.',
        overview: 'Shows supply responsibilities.',
      }),
    })
    assert.equal(response.status, 200)

    let pushed = ''
    await waitUntil(async () => {
      const { value } = await reader.read()
      if (value) pushed += decoder.decode(value, { stream: true })
      return pushed.includes('"generation":2') && pushed.includes('"title":"Supply map"')
    })
    const payload = await (await fetch(`${server.url}/world.json`)).json() as {
      project: { title: string; description: string; overview: string; overviewBlocks: unknown[] }
    }
    assert.equal(payload.project.title, 'Supply map')
    assert.equal(payload.project.description, 'A concise supply architecture summary.')
    assert.equal(payload.project.overview, 'Shows supply responsibilities.')
    assert.equal(payload.project.overviewBlocks.length, 1)
    assert.equal(
      await readFile(path.join(root, 'groma', 'project.md'), 'utf8'),
      `---
type: Groma Project
title: Supply map
groma:
  profile: architecture
description: A concise supply architecture summary.
---

Shows supply responsibilities.
`,
    )
    await reader.cancel()
  } finally {
    await server.close()
    await removeTree(root)
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
    references: ['shop'],
    modifiedFiles: [],
    acceptanceCriteriaCompleted: 1,
    acceptanceCriteriaCount: 2,
    updatedAt: '2026-08-30T12:00:00Z',
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
    readItem: async () => assert.fail('unexpected task detail read'),
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
      timings: {
        architectureLoadMilliseconds: number
        placementMilliseconds: number
        routingMilliseconds: number
        totalMilliseconds: number
      }
      work: { statuses: string[]; defaultStatus: string; items: { id: string }[] }
      pins: { key: string; elementId: string; done: number; total: number }[]
    }
    await waitUntil(() => reads === 1)
    const initial = await (await fetch(`${server.url}/world.json`)).json() as LivePayload
    assert.equal(initial.workGeneration, 0)
    assert.deepEqual(initial.work.items, [])
    assert.deepEqual(initial.pins, [])
    assert.ok(initial.timings.totalMilliseconds >= initial.timings.architectureLoadMilliseconds)
    assert.ok(initial.timings.totalMilliseconds >= initial.timings.placementMilliseconds + initial.timings.routingMilliseconds)

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
    assert.deepEqual(loaded.timings, initial.timings)
    assert.deepEqual(loaded.work.statuses, ['To Do', 'In Progress', 'Done'])
    assert.equal(loaded.work.defaultStatus, 'To Do')
    assert.deepEqual(loaded.work.items.map(item => item.id), ['TASK-PIN'])
    assert.deepEqual(loaded.pins.map(pin => [pin.key, pin.elementId, pin.done, pin.total]), [['@codex TASK-PIN', 'observed:shop', 1, 2]])

    await fetch(server.url)
    assert.equal(reads, 1)

    pushed = ''
    items = [{
      ...items[0]!,
      status: 'Done',
      acceptanceCriteriaCompleted: 2,
    }]
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
    await server.close()
    await removeTree(root)
  }
})
