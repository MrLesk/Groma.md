import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'

import { createBacklogPlugin, createBacklogSource } from '@groma/work-source-backlog'

test.concurrent('a missing task directory starts no Backlog subprocesses', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-backlog-missing-'))
  const calls: string[][] = []
  const source = createBacklogSource(root, async args => {
    calls.push(args)
    return ''
  })
  try {
    await assert.rejects(source.read(), { code: 'ENOENT' })
    assert.deepEqual(calls, [])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('a Windows Backlog cmd shim reads configuration from a path with spaces', async () => {
  if (process.platform !== 'win32') return
  const root = await mkdtemp(path.join(tmpdir(), 'groma backlog command '))
  const command = path.join(root, 'backlog.cmd')
  await mkdir(path.join(root, 'backlog', 'tasks'), { recursive: true })
  await writeFile(command, '@echo off\r\nif "%~3"=="statuses" echo To Do,In Progress,Done\r\nif "%~3"=="defaultStatus" echo To Do\r\n')
  try {
    const source = createBacklogPlugin(() => command).create(root)
    const snapshot = await source.read()
    assert.deepEqual(snapshot.statuses, ['To Do', 'In Progress', 'Done'])
    assert.equal(snapshot.defaultStatus, 'To Do')
    assert.deepEqual(snapshot.items, [])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
