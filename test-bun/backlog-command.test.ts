import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'

import { createBacklogPlugin, createBacklogSource } from '@groma/work-source-backlog'

test.concurrent('Backlog CLI reads do not depend on a local task directory', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-backlog-missing-'))
  const calls: string[][] = []
  const source = createBacklogSource(root, async args => {
    calls.push(args)
    if (args.join(' ') === 'task list --json') {
      return JSON.stringify({ schemaVersion: 1, kind: 'task-list', tasks: [] })
    }
    if (args.join(' ') === 'config get statuses') return 'To Do, Done'
    assert.deepEqual(args, ['config', 'get', 'defaultStatus'])
    return 'To Do'
  })
  try {
    assert.deepEqual(await source.read(), { statuses: ['To Do', 'Done'], defaultStatus: 'To Do', items: [] })
    assert.deepEqual(calls, [
      ['task', 'list', '--json'],
      ['config', 'get', 'statuses'],
      ['config', 'get', 'defaultStatus'],
    ])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('a Windows Backlog cmd shim reads summaries and details from a path with spaces', async () => {
  if (process.platform !== 'win32') return
  const root = await mkdtemp(path.join(tmpdir(), 'groma backlog command '))
  const command = path.join(root, 'backlog.cmd')
  const summary = {
    id: 'TASK-1', title: 'Read work', status: 'In Progress', assignees: [], references: [],
    modifiedFiles: [], acceptanceCriteriaCompleted: 0, acceptanceCriteriaCount: 0, updatedAt: '',
  }
  const details = {
    id: 'TASK-1', description: 'Task details', acceptanceCriteria: [], definitionOfDone: [],
    implementationPlan: '', implementationNotes: '', comments: [],
  }
  const list = JSON.stringify({ schemaVersion: 1, kind: 'task-list', tasks: [summary] })
  const view = JSON.stringify({ schemaVersion: 1, kind: 'task-view', task: details })
  await writeFile(command, [
    '@echo off',
    'if "%~1 %~2 %~3"=="config get statuses" echo To Do,In Progress,Done',
    'if "%~1 %~2 %~3"=="config get defaultStatus" echo To Do',
    `if "%~1 %~2 %~3"=="task list --json" echo ${list}`,
    `if "%~1 %~2 %~3 %~4"=="task view TASK-1 --json" echo ${view}`,
    '',
  ].join('\r\n'))
  try {
    const source = createBacklogPlugin(() => command).create(root)
    const snapshot = await source.read()
    assert.deepEqual(snapshot.statuses, ['To Do', 'In Progress', 'Done'])
    assert.equal(snapshot.defaultStatus, 'To Do')
    assert.deepEqual(snapshot.items, [summary])
    assert.deepEqual(await source.readItem(snapshot.items[0]!.id), details)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
