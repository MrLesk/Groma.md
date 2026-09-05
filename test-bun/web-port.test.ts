import assert from 'node:assert/strict'
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'
import { EMPTY_WORK_SOURCE } from '@groma/work-source'

import { startWebViewer } from '../src/viewers/web/server.ts'
import { repositoryRoot } from './helpers.ts'

async function repository(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-busy-port-'))
  for (const fixture of ['empty-project', 'startup-source']) {
    await cp(path.join(repositoryRoot, 'test', 'fixtures', fixture), root, { recursive: true })
  }
  const git = Bun.spawn(['git', 'init', '--quiet'], { cwd: root, stdout: 'ignore', stderr: 'ignore' })
  assert.equal(await git.exited, 0)
  return root
}

test.concurrent('a busy Web port fails before scanning or starting live subscriptions', async () => {
  const root = await repository()
  const holder = Bun.serve({ port: 0, fetch: () => new Response('occupied') })
  let workStarted = false
  try {
    const before = await readdir(path.join(root, 'groma'), { recursive: true })
    await assert.rejects(startWebViewer(root, {
      port: holder.port,
      scan: true,
      workSource: {
        ...EMPTY_WORK_SOURCE,
        watch: () => { workStarted = true; return { close() {} } },
      },
    }), { code: 'EADDRINUSE' })
    assert.equal(workStarted, false)
    assert.deepEqual(await readdir(path.join(root, 'groma'), { recursive: true }), before)
    assert.equal(await (await fetch(holder.url)).text(), 'occupied')
  } finally {
    await holder.stop(true)
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('noninteractive Web startup on a busy port exits with an available-port command', async () => {
  const root = await repository()
  const holder = Bun.serve({ port: 0, fetch: () => new Response('occupied') })
  try {
    const child = Bun.spawn([
      process.execPath, path.join(repositoryRoot, 'src', 'cli.ts'), 'web', '--port', String(holder.port),
    ], { cwd: root, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' })
    const [exit, output, error] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    assert.equal(exit, 1)
    assert.equal(output, '')
    assert.ok(error.includes('groma web --port 0'))
    assert.equal(await (await fetch(holder.url)).text(), 'occupied')
  } finally {
    await holder.stop(true)
    await rm(root, { recursive: true, force: true })
  }
})
