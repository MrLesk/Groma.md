import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'

import type { WorkSource } from '@groma/work-source'
import { createBacklogPlugin, createBacklogSource } from '@groma/work-source-backlog'

import type { WorkItem, WorkItemDetails, WorkSnapshot } from '../src/types.ts'
import { exportWebViewer } from '../src/viewers/web/export.ts'
import { repositoryRoot } from './helpers.ts'

const fixtureRoot = path.join(repositoryRoot, 'test', 'fixtures', 'validate')

function run(command: string, args: string[], cwd: string) {
  return new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', reject)
    child.on('close', code => resolve({ code, stderr }))
  })
}

async function createRepository(): Promise<{ parent: string; root: string }> {
  const parent = await mkdtemp(path.join(tmpdir(), 'groma-web-export-'))
  const root = path.join(parent, 'repo')
  await cp(fixtureRoot, root, { recursive: true })
  await mkdir(path.join(root, 'src'), { recursive: true })
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'shop' }))
  await writeFile(
    path.join(root, 'src/core.ts'),
    'export function loadAnnotatedArchitecture() { return "initial" }\n',
  )
  assert.equal((await run('git', ['init'], root)).code, 0)
  assert.equal((await run('git', ['add', '.'], root)).code, 0)
  const commit = await run('git', [
    '-c', 'user.name=Groma Test',
    '-c', 'user.email=groma@example.test',
    'commit', '-m', 'Initial architecture',
  ], root)
  assert.equal(commit.code, 0, commit.stderr)
  return { parent, root }
}

function workSource(): {
  source: WorkSource
  change(title: string): void
} {
  let title = 'Publish architecture'
  let changed: () => void = () => {}
  const item = (): WorkItem => ({
    id: 'TASK-PUBLIC',
    title,
    status: 'In Progress',
    assignees: ['@codex'],
    references: ['orders'],
    modifiedFiles: ['src/core.ts'],
    acceptanceCriteriaCompleted: 1,
    acceptanceCriteriaCount: 2,
    updatedAt: '2026-08-31T12:00:00Z',
  })
  const snapshot = (): WorkSnapshot => ({
    statuses: ['To Do', 'In Progress', 'Done'],
    defaultStatus: 'To Do',
    items: [item()],
  })
  const details: WorkItemDetails = {
    id: 'TASK-PUBLIC',
    description: '',
    acceptanceCriteria: [],
    definitionOfDone: [],
    implementationPlan: '',
    implementationNotes: '',
    comments: [],
  }
  return {
    source: {
      read: async () => snapshot(),
      readItem: async id => ({ ...details, id }),
      watch(onChange) {
        changed = onChange
        return { close() {} }
      },
    },
    change(nextTitle) {
      title = nextTitle
      changed()
    },
  }
}

async function waitUntil(probe: () => Promise<boolean>, timeout = 12000): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if (await probe()) return
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error('timed out')
}

test.concurrent('groma export writes the read-only browser map without a server', async () => {
  const { parent, root } = await createRepository()
  const output = path.join(parent, 'site')
  const work = workSource()
  try {
    const exported = await exportWebViewer(root, output, { workSource: work.source })
    await exported.close()
    const snapshot = await readFile(path.join(output, 'snapshot.js'), 'utf8')
    assert.match(snapshot, /"taskId":"TASK-PUBLIC"/)
    for (const filename of ['index.html', 'render.js', 'snapshot.js', 'version.js']) {
      assert.equal((await stat(path.join(output, filename))).isFile(), true)
    }
  } finally {
    await rm(parent, { recursive: true, force: true })
  }
})

test.concurrent('Backlog export reads only CLI tasks when task storage contains a README', async () => {
  const { parent, root } = await createRepository()
  const output = path.join(parent, 'site')
  const calls: string[][] = []
  const work = workSource().source
  const source = createBacklogSource(root, async (args, cwd) => {
    assert.equal(cwd, root)
    calls.push(args)
    if (args.join(' ') === 'config get statuses') return 'To Do, In Progress, Done'
    if (args.join(' ') === 'config get defaultStatus') return 'To Do'
    if (args.join(' ') === 'task list --json') {
      return JSON.stringify({ schemaVersion: 1, kind: 'task-list', tasks: (await work.read()).items })
    }
    assert.deepEqual(args, ['task', 'view', 'TASK-PUBLIC', '--json'])
    return JSON.stringify({ schemaVersion: 1, kind: 'task-view', task: await work.readItem('TASK-PUBLIC') })
  })
  try {
    const tasks = path.join(root, 'backlog', 'tasks')
    await mkdir(tasks, { recursive: true })
    await writeFile(path.join(tasks, 'README.md'), '# Task storage\n')
    const exported = await exportWebViewer(root, output, { workSource: source })
    await exported.close()
    assert.deepEqual(calls, [
      ['task', 'list', '--json'],
      ['config', 'get', 'statuses'],
      ['config', 'get', 'defaultStatus'],
      ['task', 'view', 'TASK-PUBLIC', '--json'],
    ])
    const snapshot = await readFile(path.join(output, 'snapshot.js'), 'utf8')
    assert.match(snapshot, /"tasks":\[{"id":"TASK-PUBLIC","details":/)
    assert.doesNotMatch(snapshot, /"id":""/)
  } finally {
    await rm(parent, { recursive: true, force: true })
  }
})

test.concurrent('groma export completes without a global Backlog command', async () => {
  const { parent, root } = await createRepository()
  const output = path.join(parent, 'site')
  const missing = createBacklogPlugin(() => null)
  try {
    const exported = await exportWebViewer(root, output, {
      workSource: missing.create(root),
    })
    exported.close()
    assert.doesNotMatch(await readFile(path.join(output, 'snapshot.js'), 'utf8'), /"TASK-/)
  } finally {
    await rm(parent, { recursive: true, force: true })
  }
})

test.concurrent('groma export watch replaces the complete published snapshot', async () => {
  const { parent, root } = await createRepository()
  const output = path.join(parent, 'site')
  const work = workSource()
  const exported = await exportWebViewer(root, output, { watch: true, workSource: work.source })
  const snapshot = () => readFile(path.join(output, 'snapshot.js'), 'utf8')
  try {
    work.change('Changed published task')
    await waitUntil(async () => (await snapshot()).includes('Changed published task'))

    const system = path.join(root, 'groma/systems/shop/system.md')
    await writeFile(system, (await readFile(system, 'utf8')).replace('title: Shop', 'title: Store'))
    work.change('Changed architecture snapshot')
    await waitUntil(async () => (await snapshot()).includes('"title":"Store"'))

    await writeFile(path.join(root, 'src/core.ts'), 'export function publishedSourceChange() {}\n')
    work.change('Changed source snapshot')
    await waitUntil(async () => (await snapshot()).includes('publishedSourceChange'))
  } finally {
    await exported.close()
    await rm(parent, { recursive: true, force: true })
  }
})

test.concurrent('the export command writes a static site and exits', async () => {
  const { parent, root } = await createRepository()
  const output = path.join(parent, 'cli-site')
  try {
    const result = await run('bun', [path.join(repositoryRoot, 'src/cli.ts'), 'export', output], root)
    assert.equal(result.code, 0, result.stderr)
    assert.equal((await stat(path.join(output, 'index.html'))).isFile(), true)
  } finally {
    await rm(parent, { recursive: true, force: true })
  }
})
