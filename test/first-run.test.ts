import assert from 'node:assert/strict'
import { access, mkdir, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { TestContext } from 'node:test'

import { ensureInitialized } from '../src/init-command.ts'
import { initializeGroma } from '../src/initialize.ts'
import { groma } from './cli-helpers.ts'
import { initDependencies, initUi } from './init-ui-helpers.ts'

async function emptyRepository(t: TestContext): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-first-run-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

async function exists(filename: string): Promise<boolean> {
  try {
    await access(filename)
    return true
  } catch {
    return false
  }
}

test('plain view treats a Groma folder without project records as uninitialized', async t => {
  const root = await emptyRepository(t)
  await mkdir(path.join(root, '.groma'))
  const result = await groma(root, ['view', '--plain'])

  assert.equal(result.code, 1)
  assert.match(result.stderr.trim(), /^[^\n]*groma init[^\n]*$/)
  assert.doesNotMatch(result.stderr, /\n\s+at /)
  assert.equal(await exists(path.join(root, '.groma', 'project.md')), false)
})

test('groma view and a record print without a Groma directory name groma init and fail the same way', async t => {
  const root = await emptyRepository(t)
  for (const args of [['view', '--plain'], ['view', 'shop']]) {
    const result = await groma(root, args)
    assert.equal(result.code, 1, args.join(' '))
    assert.match(result.stderr.trim(), /^[^\n]*groma init[^\n]*$/)
  }
  assert.equal(await exists(path.join(root, 'groma')), false)
})

test('ensureInitialized passes straight through when the Groma directory exists', async t => {
  const root = await emptyRepository(t)
  await initializeGroma(root, { projectName: 'Shop', directory: 'groma' })
  const { events, ui } = initUi()
  const outcome = await ensureInitialized(
    { repositoryRoot: root, interactive: true, opensViewer: true },
    initDependencies(ui),
  )

  assert.equal(outcome, 'ready')
  assert.deepEqual(events, [])
})

test('declining the offer prints one line naming groma init and writes nothing', async t => {
  const root = await emptyRepository(t)
  const output: string[] = []
  const { events, ui } = initUi({ init: false })
  const outcome = await ensureInitialized(
    { repositoryRoot: root, interactive: true, opensViewer: true },
    initDependencies(ui, { output: message => output.push(message) }),
  )

  assert.equal(outcome, 'declined')
  assert.deepEqual(events, ['ask:init'])
  assert.equal(output.length, 1)
  assert.match(output[0]!, /groma init/)
  assert.equal(await exists(path.join(root, 'groma')), false)
})

test('accepting the offer runs the wizard and leaves the scan and the viewer to the caller', async t => {
  const root = await emptyRepository(t)
  const { events, ui } = initUi({ init: true, projectName: 'Fresh shop', directory: 'groma' })
  const outcome = await ensureInitialized(
    { repositoryRoot: root, interactive: true, opensViewer: true },
    initDependencies(ui),
  )

  assert.equal(outcome, 'ready')
  assert.deepEqual(events, ['ask:init', 'ask:name:', 'ask:directory'])
  assert.equal(await exists(path.join(root, 'groma', 'project.md')), true)
})

test('the terminal setup completes missing records in the existing storage location', async t => {
  const root = await emptyRepository(t)
  await mkdir(path.join(root, '.groma'))
  const { events, ui } = initUi({ init: true, projectName: 'Fresh project' })
  const outcome = await ensureInitialized(
    { repositoryRoot: root, interactive: true, opensViewer: true },
    initDependencies(ui),
  )

  assert.equal(outcome, 'ready')
  assert.deepEqual(events, ['ask:init', 'ask:name:'])
  assert.equal(await exists(path.join(root, '.groma', 'index.md')), true)
  assert.equal(await exists(path.join(root, '.groma', 'project.md')), true)
  assert.equal(await exists(path.join(root, 'groma')), false)
})

test('cancelling the offer or the wizard leaves the repository untouched', async t => {
  const root = await emptyRepository(t)
  const cancelledOffer = await ensureInitialized(
    { repositoryRoot: root, interactive: true, opensViewer: true },
    initDependencies(initUi({ init: null }).ui),
  )
  const cancelledWizard = await ensureInitialized(
    { repositoryRoot: root, interactive: true, opensViewer: true },
    initDependencies(initUi({ init: true, projectName: null }).ui),
  )

  assert.equal(cancelledOffer, 'cancelled')
  assert.equal(cancelledWizard, 'cancelled')
  assert.equal(await exists(path.join(root, 'groma')), false)
})
