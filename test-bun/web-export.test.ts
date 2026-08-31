import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'

import type { WorkSource } from '../src/work/backlog.ts'
import type { WorkItem, WorkItemDetails, WorkSnapshot } from '../src/types.ts'
import { exportWebViewer } from '../src/viewers/web/export.ts'
import { repositoryRoot } from './helpers.ts'

const fixtureRoot = path.join(repositoryRoot, 'test', 'fixtures', 'validate')

function run(command: string, args: string[], cwd: string) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', reject)
    child.on('close', code => resolve({ code, stdout, stderr }))
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
    items: [item(), {
      ...item(),
      id: 'TASK-MISSING-COMMIT',
      title: 'Unavailable historical diff',
      status: 'Done',
    }],
  })
  const details: WorkItemDetails = {
    id: 'TASK-PUBLIC',
    description: 'Published task detail sentinel',
    acceptanceCriteria: [{ text: 'Publish the view', checked: true }],
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
  await writeFile(
    path.join(root, 'src/core.ts'),
    'export function loadAnnotatedArchitecture() { return "published source sentinel" }\n',
  )
  const work = workSource()
  try {
    const exported = await exportWebViewer(root, output, { workSource: work.source })
    exported.close()
    const [page, renderer, snapshot, version] = await Promise.all([
      readFile(path.join(output, 'index.html'), 'utf8'),
      readFile(path.join(output, 'render.js'), 'utf8'),
      readFile(path.join(output, 'snapshot.js'), 'utf8'),
      readFile(path.join(output, 'version.js'), 'utf8'),
    ])
    assert.match(page, /data-delivery="published"/)
    assert.match(page, /<script src="\.\/render\.js"><\/script>/)
    assert.match(page, /"title":"Shop"/)
    assert.match(renderer, /createElementNS/)
    assert.match(snapshot, /Published task detail sentinel/)
    assert.match(snapshot, /published source sentinel/)
    assert.match(snapshot, /"taskId":"TASK-PUBLIC"/)
    assert.match(snapshot, /"kind":"working-tree"/)
    assert.match(snapshot, /Commit not found for TASK-MISSING-COMMIT/)
    assert.match(version, /groma:published-version/)
    assert.match(version, /detail: \d+/)
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

    const system = path.join(root, 'groma/observed/systems/shop/system.md')
    await writeFile(system, (await readFile(system, 'utf8')).replace('title: Shop', 'title: Store'))
    work.change('Changed architecture snapshot')
    await waitUntil(async () => (await snapshot()).includes('"title":"Store"'))

    await writeFile(path.join(root, 'src/core.ts'), 'export function publishedSourceChange() {}\n')
    work.change('Changed source snapshot')
    await waitUntil(async () => (await snapshot()).includes('publishedSourceChange'))
  } finally {
    exported.close()
    await rm(parent, { recursive: true, force: true })
  }
})

test.concurrent('the export command writes a static site and exits', async () => {
  const { parent, root } = await createRepository()
  const output = path.join(parent, 'cli-site')
  try {
    const result = await run('bun', [path.join(repositoryRoot, 'src/cli.ts'), 'export', output], root)
    assert.equal(result.code, 0, result.stderr)
    assert.match(result.stdout, new RegExp(`groma export at ${output.replaceAll('\\', '\\\\')}`))
    assert.match(await readFile(path.join(output, 'index.html'), 'utf8'), /data-delivery="published"/)
  } finally {
    await rm(parent, { recursive: true, force: true })
  }
})
