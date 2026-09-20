import assert from 'node:assert/strict'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'
import type { WorkSnapshot, WorkSource } from '@groma/work-source'
import { exportWebViewer } from '../src/viewers/web/export.ts'
import type { WebBootPayload } from '../src/viewers/web/payload.ts'

test.concurrent('export bounds task reads and keeps every task detail and diff', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-export-work-'))
  const output = path.join(root, 'site')
  let active = 0, peak = 0
  const work: WorkSnapshot = {
    statuses: ['To Do', 'In Progress', 'Done'], defaultStatus: 'To Do',
    items: ['first', 'second', 'third'].map(id => ({
      id, title: id, status: 'In Progress', assignees: [], references: ['orders'],
      modifiedFiles: ['src/orders.ts'], acceptanceCriteriaCompleted: 0,
      acceptanceCriteriaCount: 0, updatedAt: '',
    })),
  }
  const workSource: WorkSource = {
    async read() { return work },
    async readItem(id) {
      active++; peak = Math.max(peak, active)
      await Promise.resolve()
      active--
      return { id, description: id, acceptanceCriteria: [], definitionOfDone: [],
        implementationPlan: '', implementationNotes: '', comments: [] }
    },
    watch() { return { close() {} } },
  }
  const git = async (...args: string[]) => {
    const process = Bun.spawn(['git', ...args], { cwd: root, stdout: 'ignore', stderr: 'pipe' })
    assert.equal(await process.exited, 0, await new Response(process.stderr).text())
  }
  try {
    await cp(path.resolve(import.meta.dir, '../test/fixtures/source-view'), root, { recursive: true })
    await git('init', '--quiet')
    await git('add', '.')
    await git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '--quiet', '-m', 'Fixture')
    await writeFile(path.join(root, 'src/orders.ts'), 'export function cancelOrder() {}\n')
    const exported = await exportWebViewer(root, output, { workSource })
    await exported.close()
    let json = ''
    await new HTMLRewriter().on('script#world', { text(chunk) { json += chunk.text } })
      .transform(new Response(await readFile(path.join(output, 'index.html'), 'utf8'))).text()
    const payload = JSON.parse(json) as WebBootPayload
    assert(payload.delivery.kind === 'published')
    const { tasks, taskDiffs } = payload.delivery.reads
    assert.deepEqual(tasks.map(task => task.details.id), work.items.map(item => item.id))
    assert.deepEqual(taskDiffs.map(task => task.id), work.items.map(item => item.id))
    for (const task of taskDiffs) {
      assert('diff' in task)
      assert.equal(task.diff.files.length, 1)
      assert(task.diff.files[0]!.hunks.flatMap(hunk => hunk.lines)
        .some(line => line.kind === 'added' && line.text.includes('cancelOrder')))
    }
    assert.equal(peak, 1, 'Export must finish each task read before starting another subprocess-backed read')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
