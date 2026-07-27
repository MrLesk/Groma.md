import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { startMarkdownWatcher } from '../src/viewer/markdown-watcher.mjs'

class FakeWatcher extends EventEmitter {
  closed = false

  close() {
    this.closed = true
  }
}

async function createFixture(t) {
  const repositoryRoot = await mkdtemp(
    path.join(os.tmpdir(), 'groma-markdown-watcher-'),
  )
  t.after(() => rm(repositoryRoot, { recursive: true, force: true }))

  const observedRoot = path.join(repositoryRoot, 'groma', 'observed')
  const plansRoot = path.join(repositoryRoot, 'groma', 'plans')
  await mkdir(path.join(plansRoot, 'test-plan'), { recursive: true })
  await mkdir(observedRoot, { recursive: true })
  await writeFile(path.join(observedRoot, 'README.md'), '# Observed\n')
  await writeFile(
    path.join(plansRoot, 'test-plan', 'README.md'),
    '# Test plan\n',
  )

  return {
    observedRoot,
    planRoot: path.join(plansRoot, 'test-plan'),
    repositoryRoot,
  }
}

function fakeWatchers() {
  const registrations = []

  return {
    registrations,
    watchFileSystem(root, _options, callback) {
      const handle = new FakeWatcher()
      registrations.push({ callback, handle, root })
      return handle
    },
  }
}

test('detects a Markdown change when fs.watch omits the filename', async t => {
  const fixture = await createFixture(t)
  const fake = fakeWatchers()
  let changes = 0
  const watcher = await startMarkdownWatcher(fixture.repositoryRoot, {
    onError: error => assert.fail(error),
    onMarkdownChange: () => {
      changes += 1
    },
    watchFileSystem: fake.watchFileSystem,
  })
  t.after(() => watcher.close())

  await writeFile(
    path.join(fixture.planRoot, 'README.md'),
    '# Changed test plan\n',
  )
  const plansRegistration = fake.registrations.find(registration => {
    return registration.root.endsWith(path.join('groma', 'plans'))
  })
  await plansRegistration.callback('change', undefined)

  assert.equal(changes, 1)
})

test('ignores a filename-less event when only non-Markdown changed', async t => {
  const fixture = await createFixture(t)
  const fake = fakeWatchers()
  let changes = 0
  const watcher = await startMarkdownWatcher(fixture.repositoryRoot, {
    onError: error => assert.fail(error),
    onMarkdownChange: () => {
      changes += 1
    },
    watchFileSystem: fake.watchFileSystem,
  })
  t.after(() => watcher.close())

  await writeFile(path.join(fixture.planRoot, 'notes.txt'), 'not architecture\n')
  const plansRegistration = fake.registrations.find(registration => {
    return registration.root.endsWith(path.join('groma', 'plans'))
  })
  await plansRegistration.callback('change', undefined)

  assert.equal(changes, 0)
})

test('reports watcher errors and closes every retained handle', async t => {
  const fixture = await createFixture(t)
  const fake = fakeWatchers()
  let changes = 0
  const errors = []
  const watcher = await startMarkdownWatcher(fixture.repositoryRoot, {
    onError: error => errors.push(error.message),
    onMarkdownChange: () => {
      changes += 1
    },
    watchFileSystem: fake.watchFileSystem,
  })

  fake.registrations[0].handle.emit('error', new Error('watch handle failed'))
  assert.deepEqual(errors, ['watch handle failed'])

  const newDirectory = path.join(fixture.observedRoot, 'new-directory')
  await mkdir(newDirectory)
  await writeFile(path.join(newDirectory, 'person.md'), '# Person\n')
  const pendingEvent = fake.registrations[0].callback(
    'rename',
    'new-directory',
  )
  await watcher.close()
  await pendingEvent

  assert.equal(fake.registrations.length, 2)
  assert.ok(fake.registrations.every(({ handle }) => handle.closed))
  assert.equal(changes, 0)
})
