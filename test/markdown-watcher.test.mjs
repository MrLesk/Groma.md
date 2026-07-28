import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { emitObservedComponents } from '../src/markdown-emitter.mjs'
import { startMarkdownWatcher } from '../src/viewer/markdown-watcher.mjs'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

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

function deferred() {
  let resolve
  const promise = new Promise(resolvePromise => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

test('reports only architecture fingerprint and watch scope', async t => {
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

test('detects Markdown removed with its containing directory', async t => {
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

  await rm(fixture.planRoot, { recursive: true })
  const plansRegistration = fake.registrations.find(registration => {
    return registration.root.endsWith(path.join('groma', 'plans'))
  })
  await plansRegistration.callback('rename', 'test-plan')

  assert.equal(changes, 1)
})

test('ignores a removed directory that contained no Markdown', async t => {
  const fixture = await createFixture(t)
  const notesRoot = path.join(fixture.observedRoot, 'notes')
  await mkdir(notesRoot)
  await writeFile(path.join(notesRoot, 'details.txt'), 'not architecture\n')
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

  await rm(notesRoot, { recursive: true })
  const observedRegistration = fake.registrations.find(registration => {
    return registration.root.endsWith(path.join('groma', 'observed'))
  })
  await observedRegistration.callback('rename', 'notes')

  assert.equal(changes, 0)
})

test('detects a real emitter transaction from its coalesced vanished-directory event', async t => {
  const repositoryRoot = await mkdtemp(
    path.join(os.tmpdir(), 'groma-markdown-watcher-emitter-'),
  )
  t.after(() => rm(repositoryRoot, { recursive: true, force: true }))
  await cp(
    path.join(projectRoot, 'groma'),
    path.join(repositoryRoot, 'groma'),
    { recursive: true },
  )
  const fake = fakeWatchers()
  let changes = 0
  const watcher = await startMarkdownWatcher(repositoryRoot, {
    onError: error => assert.fail(error),
    onMarkdownChange: () => {
      changes += 1
    },
    watchFileSystem: fake.watchFileSystem,
  })
  t.after(() => watcher.close())

  const observation = JSON.parse(await readFile(
    path.join(
      projectRoot,
      'fixtures',
      'source-observation',
      'supported.expected.json',
    ),
    'utf8',
  ))
  let transactionPath
  await emitObservedComponents(repositoryRoot, observation, {
    onFilesystemAccess(access) {
      if (
        transactionPath === undefined
        && access.operation === 'rename-destination'
        && access.filename.includes('.groma-components-transaction-')
      ) {
        const observedRoot = path.join(repositoryRoot, 'groma', 'observed')
        const relativeParts = path
          .relative(observedRoot, access.filename)
          .split(path.sep)
        const transactionIndex = relativeParts.findIndex(name => {
          return name.startsWith('.groma-components-transaction-')
        })
        transactionPath = relativeParts
          .slice(0, transactionIndex + 1)
          .join(path.sep)
      }
    },
  })

  assert.match(transactionPath, /\.groma-components-transaction-/)
  const observedRoot = path.join(repositoryRoot, 'groma', 'observed')
  await assert.rejects(
    lstat(path.join(observedRoot, transactionPath)),
    error => error.code === 'ENOENT',
  )
  const observedRegistration = fake.registrations.find(registration => {
    return registration.root === observedRoot
  })
  await observedRegistration.callback('rename', transactionPath)

  assert.equal(changes, 1)
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

test('does not report an in-flight fingerprint change after close', async t => {
  const fixture = await createFixture(t)
  const fake = fakeWatchers()
  const scanStarted = deferred()
  const scanFinished = deferred()
  let scans = 0
  let changes = 0
  const watcher = await startMarkdownWatcher(fixture.repositoryRoot, {
    fingerprintMarkdown: async () => {
      scans += 1
      if (scans === 1) return 'initial'

      scanStarted.resolve()
      return scanFinished.promise
    },
    onError: error => assert.fail(error),
    onMarkdownChange: () => {
      changes += 1
    },
    watchFileSystem: fake.watchFileSystem,
  })

  const pendingEvent = fake.registrations[0].callback('change', undefined)
  let scanTimeout
  await Promise.race([
    scanStarted.promise,
    new Promise((_, reject) => {
      scanTimeout = setTimeout(() => {
        reject(new Error('fingerprint scan did not start'))
      }, 200)
    }),
  ])
  clearTimeout(scanTimeout)
  const pendingClose = watcher.close()
  scanFinished.resolve('changed')
  await Promise.all([pendingEvent, pendingClose])

  assert.equal(changes, 0)
})
