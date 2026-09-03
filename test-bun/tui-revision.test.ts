import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { test } from 'bun:test'
import { createTestRenderer } from '@opentui/core/testing'
import type { WorkSource } from '@groma/work-source'

import type { WorkSnapshot } from '../src/types.ts'
import { startTerminalViewer } from '../src/view-host.ts'
import { listGromaRevisions } from '../src/history/revisions.ts'
import { fixtureRoot, press } from './helpers.ts'

function run(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', reject)
    child.on('close', code => code === 0 ? resolve() : reject(new Error(stderr)))
  })
}

async function commitAll(root: string, subject: string): Promise<void> {
  await run('git', ['add', '.'], root)
  await run('git', [
    '-c', 'user.name=Groma Test',
    '-c', 'user.email=groma@example.test',
    'commit', '-m', subject,
  ], root)
}

async function revisionRepository(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-tui-revision-'))
  await cp(fixtureRoot, root, { recursive: true })
  const project = path.join(root, 'groma/project.md')
  const system = path.join(root, 'groma/systems/shop/system.md')
  const currentProject = await readFile(project, 'utf8')
  const currentSystem = await readFile(system, 'utf8')
  await run('git', ['init'], root)
  await writeFile(project, '---\ntype: Note\ntitle: Old map\n---\n')
  await commitAll(root, 'Unsupported map')
  await writeFile(project, currentProject)
  await writeFile(system, currentSystem.replace('title: Shop', 'title: Historical Shop'))
  await commitAll(root, 'Historical map')
  await writeFile(system, currentSystem.replace('title: Shop', 'title: Current Shop'))
  return root
}

function workSource(): WorkSource {
  const snapshot: WorkSnapshot = {
    statuses: ['To Do', 'In Progress', 'Done'],
    defaultStatus: 'To Do',
    items: [{
      id: 'TASK-1',
      title: 'Touch the shop',
      status: 'In Progress',
      assignees: [],
      references: ['shop'],
      modifiedFiles: [],
      acceptanceCriteriaCompleted: 0,
      acceptanceCriteriaCount: 1,
      updatedAt: '2026-09-03T12:00:00Z',
    }],
  }
  return {
    read: async () => snapshot,
    readItem: async () => assert.fail('unexpected task detail read'),
    watch: () => ({ close() {} }),
  }
}

async function waitFor(setup: Awaited<ReturnType<typeof createTestRenderer>>, pattern: RegExp): Promise<string> {
  const started = Date.now()
  while (Date.now() - started < 5000) {
    await setup.renderOnce()
    const frame = setup.captureCharFrame()
    if (pattern.test(frame)) return frame
    await Bun.sleep(20)
  }
  throw new Error(`timed out waiting for ${pattern}`)
}

test.concurrent('history lists branch revisions and switches read-only before returning to Current', async () => {
  const root = await revisionRepository()
  const setup = await createTestRenderer({ width: 120, height: 36 })
  let app: Awaited<ReturnType<typeof startTerminalViewer>> | undefined
  try {
    const revisions = await listGromaRevisions(root)
    assert.deepEqual(revisions.map(revision => revision.subject), ['Historical map', 'Unsupported map'])
    assert.deepEqual(revisions.map(revision => revision.compatible), [true, false])

    app = await startTerminalViewer(root, { renderer: setup.renderer, workSource: workSource() })
    await waitFor(setup, /Current Shop[\s\S]*Backlog/)

    const history = await press(setup, 'h')
    assert.ok(history.indexOf('Historical map') < history.indexOf('Unsupported map'))
    assert.match(history, new RegExp(revisions[0]!.shortId))
    assert.match(history, new RegExp(revisions[0]!.date.slice(0, 10)))
    assert.match(history, /Unsupported/)

    await press(setup, 'down', 'enter')
    assert.match(setup.captureCharFrame(), /History/)
    await press(setup, 'up', 'enter')
    const historical = await waitFor(setup, /Historical Shop/)
    assert.match(historical, /Historical map/)
    assert.doesNotMatch(historical, /Backlog|TASK-1/)

    assert.match(await press(setup, 'h'), /History/)
    assert.doesNotMatch(await press(setup, 'h'), /History/)
    assert.match(await press(setup, 'h'), /History/)
    assert.doesNotMatch(await press(setup, 'escape'), /History/)
    await press(setup, 'escape')
    const current = await waitFor(setup, /Current Shop[\s\S]*Backlog/)
    assert.doesNotMatch(current, /Historical map/)

    const system = path.join(root, 'groma/systems/shop/system.md')
    await writeFile(system, (await readFile(system, 'utf8')).replace('Current Shop', 'Resumed Shop'))
    assert.match(await waitFor(setup, /Resumed Shop/), /Backlog/)
  } finally {
    app?.destroy()
    if (!setup.renderer.isDestroyed) setup.renderer.destroy()
    await rm(root, { recursive: true, force: true })
  }
}, 20000)
