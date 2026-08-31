import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'

import { listGitRevisions, withGitRevision } from '../src/history/git.ts'

function projectSource(title: string, overview: string): string {
  return `---
type: Groma Project
title: ${title}
groma:
  profile: architecture
---

${overview}
`
}

function git(root: string, ...arguments_: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', arguments_, { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) resolve()
      else reject(new Error(stderr.trim() || `git exited ${code}`))
    })
  })
}

async function commit(root: string, subject: string, body?: string): Promise<void> {
  await git(root, 'add', '.')
  const message = body === undefined ? ['-m', subject] : ['-m', subject, '-m', body]
  await git(
    root,
    '-c',
    'user.name=Groma Test',
    '-c',
    'user.email=groma@example.test',
    'commit',
    ...message,
  )
}

test.concurrent('Git history lists only current-branch commits that changed groma', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-git-history-'))
  try {
    await git(root, 'init')
    await mkdir(path.join(root, 'groma'), { recursive: true })
    await writeFile(path.join(root, 'groma', 'index.md'), '---\nokf_version: "0.2"\n---\n')
    await writeFile(path.join(root, 'groma', 'project.md'), projectSource('First', 'First map.'))
    await commit(root, 'First architecture')
    await writeFile(path.join(root, 'source.ts'), 'export const current = true\n')
    await commit(root, 'Source only')
    await writeFile(path.join(root, 'groma', 'project.md'), projectSource('Second', 'Second map.'))
    await commit(root, 'Second architecture', 'Complete second map.')
    await git(root, 'tag', 'v2.0.0')

    const revisions = await listGitRevisions(root)

    assert.deepEqual(revisions.map(revision => revision.subject), [
      'Second architecture',
      'First architecture',
    ])
    assert.ok(revisions.every(revision => /^[0-9a-f]{40}$/.test(revision.id)))
    assert.ok(revisions.every(revision => revision.shortId.length > 0 && !Number.isNaN(Date.parse(revision.date))))
    assert.equal(revisions[0]!.body, 'Complete second map.')
    assert.equal(revisions[0]!.tag, 'v2.0.0')
    assert.equal(revisions[1]!.body, '')
    assert.equal(revisions[1]!.tag, undefined)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('a Git revision loads a complete isolated repository snapshot', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-git-snapshot-'))
  try {
    await git(root, 'init')
    await mkdir(path.join(root, 'groma'), { recursive: true })
    await writeFile(path.join(root, 'groma', 'index.md'), '---\nokf_version: "0.2"\n---\n')
    await writeFile(path.join(root, 'groma', 'project.md'), projectSource('Historical', 'Historical map.'))
    await writeFile(path.join(root, 'source.ts'), 'old source\n')
    await commit(root, 'Historical architecture')
    const [revision] = await listGitRevisions(root)
    await writeFile(path.join(root, 'groma', 'project.md'), projectSource('Current', 'Current map.'))
    await writeFile(path.join(root, 'source.ts'), 'current source\n')

    const snapshot = await withGitRevision(root, revision!.id, async snapshotRoot => ({
      architecture: await readFile(path.join(snapshotRoot, 'groma', 'project.md'), 'utf8'),
      source: await readFile(path.join(snapshotRoot, 'source.ts'), 'utf8'),
      root: snapshotRoot,
    }))

    assert.equal(snapshot.architecture, projectSource('Historical', 'Historical map.'))
    assert.equal(snapshot.source, 'old source\n')
    await assert.rejects(access(snapshot.root))
    assert.equal(
      await readFile(path.join(root, 'groma', 'project.md'), 'utf8'),
      projectSource('Current', 'Current map.'),
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
