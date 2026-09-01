import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { expect, test } from 'bun:test'
import { createTestRenderer } from '@opentui/core/testing'
import { EMPTY_WORK_SNAPSHOT } from '@groma/work-source'
import type { WorkSource } from '@groma/work-source'

import { loadArchitectureViewModel } from '../src/core.ts'
import { loadProjectProfile } from '../src/project-profile.ts'
import { sheetScene } from '../src/sheet/scene.ts'
import { mountTerminalViewer } from '../src/viewers/tui/terminal-viewer.ts'
import { inspectDetails } from '../src/viewers/web/organisms/details.ts'
import { projectScene } from '../src/viewers/web/iso/project.ts'
import { startWebViewer } from '../src/viewers/web/server.ts'
import { okfFixtureRoot, terminalModel } from './helpers.ts'

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

test.concurrent('Web projections use project and element title plus body overview', async () => {
  const [model, profile] = await Promise.all([
    loadArchitectureViewModel(okfFixtureRoot),
    loadProjectProfile(okfFixtureRoot),
  ])
  expect(profile).toBeDefined()
  const buyer = model.elements.find(element => element.id === 'buyer')!
  const details = inspectDetails(buyer, model)
  const scene = projectScene(sheetScene(model), profile)

  expect(details.title).toBe('Buyer')
  expect(details.overview).toBe('Places orders in the shop.')
  expect(Object.hasOwn(details, 'description')).toBe(false)
  expect(scene.projectPlate?.title.lines).toEqual(['Example architecture'])
  expect(scene.projectPlate?.overview.lines.length).toBeGreaterThan(0)
})

test.concurrent('the TUI details pane shows body overview for the selected OKF element', async () => {
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const app = mountTerminalViewer(setup.renderer, await terminalModel(okfFixtureRoot), {
    currentId: 'observed:buyer',
  })
  try {
    await setup.renderOnce()
    const frame = setup.captureCharFrame()
    expect(frame).toContain('Buyer')
    expect(frame).toContain('Places orders in the shop.')
    expect(frame).not.toContain('A person who places an order.')
  } finally {
    app.destroy()
  }
})

test.concurrent('Web history reports a pre-OKF Groma revision as unsupported', async () => {
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
    const current = await (await fetch(`${server.url}/world.json`)).json() as {
      project: { title: string }
      revisions: { id: string; subject: string; compatible: boolean }[]
    }
    expect(current.project.title).toBe('Example architecture')
    const obsolete = current.revisions.find(revision => revision.subject === 'Pre-OKF contract')!
    const supported = current.revisions.find(revision => revision.subject === 'Current OKF contract')!
    expect(obsolete.compatible).toBe(false)
    expect(supported.compatible).toBe(true)
    const response = await fetch(`${server.url}/world.json?revision=${obsolete.id}`)
    expect(response.status).toBe(422)
    expect(await response.text()).toBe('Unsupported Groma revision')
  } finally {
    server?.close()
    await rm(repositoryRoot, { recursive: true, force: true })
  }
})
