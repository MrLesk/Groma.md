import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises'
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

test('watches only architecture Markdown roots', async t => {
  const fixture = await createFixture(t)
  const fake = fakeWatchers()
  const accesses = []
  const watcher = await startMarkdownWatcher(fixture.repositoryRoot, {
    onError: error => assert.fail(error),
    onFilesystemAccess(access) {
      accesses.push({
        operation: access.operation,
        path: path.relative(fixture.repositoryRoot, access.filename),
      })
    },
    onMarkdownChange: () => {},
    watchFileSystem: fake.watchFileSystem,
  })
  t.after(() => watcher.close())

  assert.deepEqual(
    accesses
      .filter(access => access.operation === 'watch')
      .map(access => access.path)
      .sort(),
    [
      path.join('groma', 'observed'),
      path.join('groma', 'plans'),
    ],
  )
  assert.ok(accesses.every(access => {
    return access.path === path.join('groma', 'observed')
      || access.path.startsWith(path.join('groma', 'observed', path.sep))
      || access.path === path.join('groma', 'plans')
      || access.path.startsWith(path.join('groma', 'plans', path.sep))
  }))
})

test('a Markdown file event reports an architecture change', async t => {
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
  await plansRegistration.callback('change', 'test-plan/README.md')

  assert.equal(changes, 1)
})

test('non-Markdown and filename-less events are ignored directly', async t => {
  const fixture = await createFixture(t)
  const fake = fakeWatchers()
  const accesses = []
  let changes = 0
  const watcher = await startMarkdownWatcher(fixture.repositoryRoot, {
    onError: error => assert.fail(error),
    onFilesystemAccess(access) {
      accesses.push(access)
    },
    onMarkdownChange: () => {
      changes += 1
    },
    watchFileSystem: fake.watchFileSystem,
  })
  t.after(() => watcher.close())
  accesses.length = 0

  await fake.registrations[0].callback('rename', 'components')
  await fake.registrations[0].callback('change', undefined)

  assert.deepEqual(accesses, [])
  assert.equal(changes, 0)
})

test('close releases both architecture watch handles', async t => {
  const fixture = await createFixture(t)
  const fake = fakeWatchers()
  const watcher = await startMarkdownWatcher(fixture.repositoryRoot, {
    onError: error => assert.fail(error),
    onMarkdownChange: () => {},
    watchFileSystem: fake.watchFileSystem,
  })

  await watcher.close()

  assert.equal(fake.registrations.length, 2)
  assert.ok(fake.registrations.every(({ handle }) => handle.closed))
})
