import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'

import type { WorkItem, WorkSnapshot } from '../src/types.ts'
import { readTaskDiff } from '../src/viewers/web/task-diff/read.ts'

function git(root: string, ...arguments_: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', arguments_, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', reject)
    child.on('close', code => code === 0 ? resolve(stdout) : reject(new Error(stderr)))
  })
}

async function write(root: string, file: string, source: string): Promise<void> {
  const filename = path.join(root, file)
  await mkdir(path.dirname(filename), { recursive: true })
  await writeFile(filename, source)
}

async function commit(root: string, subject: string): Promise<void> {
  await git(root, 'add', '-A')
  await git(root, '-c', 'user.name=Groma Test', '-c', 'user.email=groma@example.test', 'commit', '-m', subject)
}

async function repository(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-task-diff-'))
  await git(root, 'init')
  for (const [file, source] of Object.entries(files)) await write(root, file, source)
  await commit(root, 'Initial files')
  return root
}

function item(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: 'TASK-7',
    title: 'Show changes',
    status: 'Done',
    assignees: [],
    description: '',
    references: [],
    modifiedFiles: [],
    criteria: [],
    ...overrides,
  }
}

function snapshot(items: WorkItem[]): WorkSnapshot {
  return { statuses: ['To Do', 'In Progress', 'Done'], defaultStatus: 'To Do', items }
}

test.concurrent('completed task diff reads only its exact task commit', async () => {
  const root = await repository({
    'src/changed.ts': 'const value = 1\nconst stable = true\n',
    'src/removed.ts': 'export const removed = true\n',
  })
  try {
    await write(root, 'src/changed.ts', 'const value = 2\nconst stable = true\n')
    await write(root, 'src/added.ts', 'export const added = true\n')
    await rm(path.join(root, 'src/removed.ts'))
    await commit(root, 'TASK-7 - Show changes')
    await write(root, 'src/changed.ts', 'const value = 99\n')
    const task = item({ modifiedFiles: ['src/changed.ts', 'src/added.ts', 'src/removed.ts'] })
    const result = await readTaskDiff(root, task, snapshot([task]))
    assert.equal(result.source.kind, 'commit')
    assert.match(result.source.revision, /^[0-9a-f]{40}$/)
    assert.match(result.source.base, /^[0-9a-f]{40}$/)
    assert.deepEqual(result.files.map(file => file.status), ['modified', 'added', 'deleted'])
    assert.deepEqual(
      result.files[0]!.hunks[0]!.lines.map(line => [line.kind, line.oldLine, line.newLine, line.text]),
      [
        ['removed', 1, undefined, 'const value = 1'],
        ['added', undefined, 1, 'const value = 2'],
        ['context', 2, 2, 'const stable = true'],
      ],
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('active task diff labels files recorded by another active task as shared', async () => {
  const root = await repository({
    'src/own.ts': 'export const own = 1\n',
    'src/shared.ts': 'export const shared = 1\n',
    'src/unchanged.ts': 'export const unchanged = true\n',
  })
  try {
    await write(root, 'src/own.ts', 'export const own = 2\n')
    await write(root, 'src/shared.ts', 'export const shared = 2\n')
    const selected = item({
      id: 'TASK-8', status: 'In Progress',
      modifiedFiles: ['src/own.ts', 'src/shared.ts', 'src/unchanged.ts'],
    })
    const other = item({ id: 'TASK-9', status: 'In Progress', modifiedFiles: ['src/shared.ts'] })
    const result = await readTaskDiff(root, selected, snapshot([selected, other]))
    assert.equal(result.source.kind, 'working-tree')
    assert.equal(result.source.base, result.source.revision)
    assert.deepEqual(result.files.map(file => [file.status, file.shared]), [
      ['modified', false],
      ['modified', true],
      ['unchanged', false],
    ])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
