import assert from 'node:assert/strict'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'

import { repositoryRoot } from './helpers.ts'

async function repository(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-web-shutdown-'))
  for (const fixture of ['empty-project', 'startup-source']) {
    await cp(path.join(repositoryRoot, 'test', 'fixtures', fixture), root, { recursive: true })
  }
  const git = Bun.spawn(['git', 'init', '--quiet'], { cwd: root, stdout: 'ignore', stderr: 'ignore' })
  assert.equal(await git.exited, 0)
  return root
}

async function freePort(): Promise<number> {
  const reservation = Bun.serve({ port: 0, fetch: () => new Response() })
  const { port } = reservation
  await reservation.stop(true)
  if (port === undefined) throw new Error('expected an ephemeral port')
  return port
}

async function waitForReady(url: string, child: Bun.Subprocess): Promise<void> {
  while (child.exitCode === null) {
    try {
      if ((await fetch(`${url}/ready`)).status === 204) return
    } catch {
      // Listening has not started yet.
    }
    await Bun.sleep(50)
  }
  throw new Error(`groma web exited ${child.exitCode} before it was ready`)
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  test.concurrent(`${signal} closes groma web, exits 0, and releases the port`, async () => {
    const root = await repository()
    const port = await freePort()
    const child = Bun.spawn([
      process.execPath, path.join(repositoryRoot, 'src', 'cli.ts'), 'web', '--port', String(port),
    ], { cwd: root, stdin: 'ignore', stdout: 'ignore', stderr: 'pipe' })
    try {
      await waitForReady(`http://127.0.0.1:${port}`, child)
      child.kill(signal)
      const exit = await Promise.race([child.exited, Bun.sleep(10_000).then(() => 'timeout' as const)])
      assert.equal(exit, 0, await new Response(child.stderr).text())
      const reuse = Bun.serve({ port, fetch: () => new Response() })
      await reuse.stop(true)
    } finally {
      if (child.exitCode === null) child.kill('SIGKILL')
      await rm(root, { recursive: true, force: true })
    }
  })
}
