import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'

import type { WorkSource } from '@groma/work-source'
import { createBacklogPlugin } from '@groma/work-source-backlog'

import type { WorkItem, WorkItemDetails, WorkSnapshot } from '../src/types.ts'
import { startWebViewer } from '../src/viewers/web/server.ts'

const fixtureRoot = path.join(import.meta.dir, '..', 'test', 'fixtures', 'validate')

function run(command: string, args: string[], cwd: string) {
  return new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', reject)
    child.on('close', code => { resolve({ code, stderr }) })
  })
}

async function createRepository(): Promise<string> {
  const parent = await mkdtemp(path.join(tmpdir(), 'groma-web-task-live-'))
  const root = path.join(parent, 'repo')
  await cp(fixtureRoot, root, { recursive: true })
  await mkdir(path.join(root, 'src'), { recursive: true })
  await writeFile(path.join(root, 'src/cli.ts'), 'export const initial = true\n')
  const init = await run('git', ['init'], root)
  assert.equal(init.code, 0, init.stderr)
  const add = await run('git', ['add', '.'], root)
  assert.equal(add.code, 0, add.stderr)
  const commit = await run('git', [
    '-c', 'user.name=Groma Test',
    '-c', 'user.email=groma@example.test',
    'commit', '-m', 'Initial architecture',
  ], root)
  assert.equal(commit.code, 0, commit.stderr)
  return root
}

async function waitUntil(probe: () => Promise<boolean>, timeout = 8000): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if (await probe()) return
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error('timed out')
}

test.concurrent('groma web loads selected task details and diff outside the initial payload', async () => {
  const root = await createRepository()
  await writeFile(path.join(root, 'src/cli.ts'), 'export const taskDiffSentinel = 42\n')
  const task: WorkItem = {
    id: 'TASK-DIFF',
    title: 'Show task diff',
    status: 'In Progress',
    assignees: [],
    references: [],
    modifiedFiles: ['src/cli.ts'],
    acceptanceCriteriaCompleted: 0,
    acceptanceCriteriaCount: 1,
    updatedAt: '2026-08-30T12:00:00Z',
  }
  const details: WorkItemDetails = {
    id: task.id,
    description: 'Selected detail sentinel',
    acceptanceCriteria: [{ text: 'Inspect the selected task', checked: false }],
    definitionOfDone: [],
    implementationPlan: '',
    implementationNotes: '',
    comments: [],
  }
  let detailReads = 0
  const workSource: WorkSource = {
    async read() {
      return {
        statuses: ['To Do', 'In Progress', 'Done'],
        defaultStatus: 'To Do',
        items: [task],
      }
    },
    async readItem(id) {
      detailReads += 1
      assert.equal(id, task.id)
      return details
    },
    watch: () => ({ close() {} }),
  }
  const server = await startWebViewer(root, { port: 0, workSource })
  try {
    await waitUntil(async () => {
      const payload = await (await fetch(`${server.url}/world.json`)).json() as {
        work: WorkSnapshot
      }
      return payload.work.items[0]?.id === task.id
    })
    const page = await (await fetch(server.url)).text()
    assert.doesNotMatch(page, /taskDiffSentinel|Selected detail sentinel/)
    assert.equal(detailReads, 0)
    const detailResponse = await fetch(`${server.url}/task.json?task=${task.id}`)
    assert.equal(detailResponse.status, 200)
    assert.deepEqual(await detailResponse.json(), details)
    assert.equal(detailReads, 1)
    const response = await fetch(`${server.url}/task-diff.json?task=${task.id}`)
    assert.equal(response.status, 200)
    const diff = await response.json() as {
      taskId: string
      source: { kind: string; revision: string }
      files: { status: string; additions: number; hunks: unknown[] }[]
    }
    assert.equal(diff.taskId, task.id)
    assert.equal(diff.source.kind, 'working-tree')
    assert.match(diff.source.revision, /^[0-9a-f]{40}$/)
    assert.equal(diff.files[0]!.status, 'modified')
    assert.ok(diff.files[0]!.additions > 0)
    assert.ok(diff.files[0]!.hunks.length > 0)
    assert.equal((await fetch(`${server.url}/task.json?task=unknown`)).status, 404)
    assert.equal((await fetch(`${server.url}/task-diff.json?task=unknown`)).status, 404)
  } finally {
    await server.close()
    await rm(path.dirname(root), { recursive: true, force: true })
  }
})

test.concurrent('groma web opens without a global Backlog command', async () => {
  const root = await createRepository()
  const missing = createBacklogPlugin(() => null)
  const server = await startWebViewer(root, {
    port: 0,
    workSource: missing.create(root),
  })
  try {
    const response = await fetch(`${server.url}/world.json`)
    const payload = await response.json() as { work: WorkSnapshot }
    assert.equal(response.status, 200)
    assert.deepEqual(payload.work.items, [])
  } finally {
    await server.close()
    await rm(path.dirname(root), { recursive: true, force: true })
  }
})
