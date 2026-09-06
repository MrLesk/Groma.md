import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { expect, test } from 'bun:test'
import { EMPTY_WORK_SNAPSHOT } from '@groma/work-source'
import type { WorkSource } from '@groma/work-source'

import { startWebViewer } from '../src/viewers/web/server.ts'
import { okfFixtureRoot } from './helpers.ts'

function emptyWorkSource(): WorkSource {
  return {
    read: async () => EMPTY_WORK_SNAPSHOT,
    readItem: async () => assert.fail('unexpected task detail read'),
    watch: () => ({ close() {} }),
  }
}

async function git(repositoryRoot: string, ...arguments_: string[]): Promise<string> {
  const process = Bun.spawn(['git', ...arguments_], {
    cwd: repositoryRoot,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, code] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ])
  assert.equal(code, 0, stderr)
  return stdout.trim()
}

async function commit(repositoryRoot: string, subject: string): Promise<void> {
  await git(repositoryRoot, 'add', '.')
  await git(
    repositoryRoot,
    '-c',
    'user.name=Groma Test',
    '-c',
    'user.email=groma@example.test',
    'commit',
    '-m',
    subject,
  )
}

test.concurrent('Web history rejects a pre-OKF Groma revision', async () => {
  const repositoryRoot = await mkdtemp(path.join(tmpdir(), 'groma-okf-history-'))
  let server: Awaited<ReturnType<typeof startWebViewer>> | undefined
  try {
    await mkdir(path.join(repositoryRoot, 'groma', 'observed'), { recursive: true })
    await mkdir(path.join(repositoryRoot, 'groma', 'missing'), { recursive: true })
    await mkdir(path.join(repositoryRoot, 'groma', 'plans'), { recursive: true })
    await writeFile(path.join(repositoryRoot, 'groma', 'README.md'), '# Legacy\n\nOld package.\n')
    await writeFile(path.join(repositoryRoot, 'groma', 'observed', 'README.md'), '# Observed\n')
    await writeFile(path.join(repositoryRoot, 'groma', 'missing', 'README.md'), '# Missing\n')
    await writeFile(path.join(repositoryRoot, 'groma', 'plans', 'README.md'), '# Plans\n')
    await git(repositoryRoot, 'init')
    await commit(repositoryRoot, 'Pre-OKF contract')

    await rm(path.join(repositoryRoot, 'groma'), { recursive: true })
    await cp(path.join(okfFixtureRoot, 'groma'), path.join(repositoryRoot, 'groma'), {
      recursive: true,
    })
    await commit(repositoryRoot, 'Current OKF contract')

    server = await startWebViewer(repositoryRoot, {
      port: 0,
      workSource: emptyWorkSource(),
    })
    const revisions = await (await fetch(`${server.url}/revisions.json`)).json() as { id: string; compatible: boolean }[]
    const obsolete = revisions.find(revision => !revision.compatible)
    const supported = revisions.find(revision => revision.compatible)
    expect(obsolete).toBeDefined()
    expect(supported).toBeDefined()
    const response = await fetch(`${server.url}/world.json?revision=${obsolete!.id}`)
    expect(response.status).toBe(422)
  } finally {
    await server?.close()
    await rm(repositoryRoot, { recursive: true, force: true })
  }
})
