import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const ownedRelativePath = path.join(
  'groma',
  'observed',
  'systems',
  'groma',
  'containers',
  'scanner',
  'components',
)

class FakeWatchHandle extends EventEmitter {
  closed = false

  close() {
    this.closed = true
  }
}

function createFakeFilesystemWatcher() {
  const registrations = []

  return {
    registrations,
    watchFileSystem(directory, options, callback) {
      const handle = new FakeWatchHandle()
      registrations.push({ callback, directory, handle, options })
      return handle
    },
  }
}

function waitForCompletion() {
  let resolve
  const promise = new Promise(resolvePromise => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function within(promise, milliseconds, label) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`${label} did not complete`))
      }, milliseconds)
    }),
  ]).finally(() => clearTimeout(timer))
}

function createNotificationQueue() {
  const queued = []
  const waiting = []

  return {
    notify(value) {
      const waiter = waiting.shift()
      if (waiter === undefined) queued.push(value)
      else waiter(value)
    },
    next() {
      if (queued.length > 0) return Promise.resolve(queued.shift())
      return new Promise(resolve => waiting.push(resolve))
    },
  }
}

async function treeHash(directory, options = {}) {
  const { exclude = () => false } = options
  const hash = createHash('sha256')

  async function walk(currentDirectory) {
    const entries = await readdir(currentDirectory, { withFileTypes: true })
    entries.sort((left, right) => {
      return Buffer.compare(Buffer.from(left.name), Buffer.from(right.name))
    })
    for (const entry of entries) {
      const filename = path.join(currentDirectory, entry.name)
      const relativeFilename = path.relative(directory, filename)
      if (exclude(relativeFilename)) continue

      hash.update(relativeFilename)
      hash.update('\0')
      if (entry.isDirectory()) {
        hash.update('directory\0')
        await walk(filename)
      } else {
        hash.update('file\0')
        hash.update(await readFile(filename))
        hash.update('\0')
      }
    }
  }

  await walk(directory)
  return hash.digest('hex')
}

async function createSupportedRepository(t) {
  const repositoryRoot = await mkdtemp(
    path.join(os.tmpdir(), 'groma-source-refresh-integration-'),
  )
  t.after(() => rm(repositoryRoot, { recursive: true, force: true }))
  const fixtureRoot = path.join(
    projectRoot,
    'fixtures',
    'source-observation',
    'supported',
  )
  await Promise.all([
    cp(
      path.join(fixtureRoot, 'package.json'),
      path.join(repositoryRoot, 'package.json'),
    ),
    cp(
      path.join(fixtureRoot, 'src'),
      path.join(repositoryRoot, 'src'),
      { recursive: true },
    ),
    cp(
      path.join(projectRoot, 'groma'),
      path.join(repositoryRoot, 'groma'),
      { recursive: true },
    ),
  ])
  return repositoryRoot
}

test('one settled supported event burst runs one complete observation and emission', async t => {
  const { startSourceRefresh } = await import('../src/source-refresh.mjs')
  const repositoryRoot = path.resolve('/tmp/groma-source-refresh-test')
  const fake = createFakeFilesystemWatcher()
  const completed = waitForCompletion()
  const observation = {
    contract: 'groma.typescript-bun/v1',
    containerId: 'scanner',
    entryPoints: [],
    components: [],
  }
  const calls = []
  const refresh = await startSourceRefresh(repositoryRoot, {
    settleMilliseconds: 5,
    watchFileSystem: fake.watchFileSystem,
    async observeSource(root) {
      calls.push(['observe', root])
      return observation
    },
    async emitComponents(root, suppliedObservation) {
      calls.push(['emit', root, suppliedObservation])
    },
    onError: assert.fail,
    onRefreshComplete: completed.resolve,
  })
  t.after(() => refresh.close())

  const byDirectory = new Map(
    fake.registrations.map(registration => [
      registration.directory,
      registration,
    ]),
  )
  byDirectory.get(repositoryRoot).callback('change', 'package.json')
  byDirectory.get(path.join(repositoryRoot, 'src'))
    .callback('rename', 'index.ts')
  byDirectory.get(path.join(repositoryRoot, 'src', 'components'))
    .callback('change', 'source-watcher.ts')

  await completed.promise

  assert.deepEqual(calls, [
    ['observe', repositoryRoot],
    ['emit', repositoryRoot, observation],
  ])
})

test('out-of-scope events are ignored before observation without errors', async t => {
  const { startSourceRefresh } = await import('../src/source-refresh.mjs')
  const repositoryRoot = path.resolve('/tmp/groma-source-refresh-filter-test')
  const fake = createFakeFilesystemWatcher()
  const calls = []
  const refresh = await startSourceRefresh(repositoryRoot, {
    settleMilliseconds: 5,
    watchFileSystem: fake.watchFileSystem,
    observeSource() {
      calls.push('observe')
    },
    emitComponents() {
      calls.push('emit')
    },
    onError() {
      calls.push('error')
    },
  })
  t.after(() => refresh.close())

  const byDirectory = new Map(
    fake.registrations.map(registration => [
      registration.directory,
      registration,
    ]),
  )
  byDirectory.get(repositoryRoot).callback('change', 'README.md')
  byDirectory.get(repositoryRoot).callback('change', 'bun.lock')
  byDirectory.get(path.join(repositoryRoot, 'src'))
    .callback('change', 'other.ts')
  byDirectory.get(path.join(repositoryRoot, 'src', 'components'))
    .callback('change', 'nested/deep.ts')
  byDirectory.get(path.join(repositoryRoot, 'src', 'components'))
    .callback('change', 'component.tsx')
  byDirectory.get(path.join(repositoryRoot, 'src', 'components'))
    .callback('change', undefined)

  await delay(20)

  assert.deepEqual(calls, [])
})

test('a filename-less event refreshes only when supported source changed', async t => {
  const { startSourceRefresh } = await import('../src/source-refresh.mjs')
  const repositoryRoot = path.resolve('/tmp/groma-source-refresh-fingerprint')
  const fake = createFakeFilesystemWatcher()
  const completed = waitForCompletion()
  let fingerprint = 'before'
  let observations = 0
  let emissions = 0
  const refresh = await startSourceRefresh(repositoryRoot, {
    fingerprintSource: async () => fingerprint,
    settleMilliseconds: 5,
    watchFileSystem: fake.watchFileSystem,
    async observeSource() {
      observations += 1
      return {
        contract: 'groma.typescript-bun/v1',
        containerId: 'scanner',
        entryPoints: [],
        components: [],
      }
    },
    async emitComponents() {
      emissions += 1
    },
    onError: assert.fail,
    onRefreshComplete: completed.resolve,
  })
  t.after(() => refresh.close())

  const componentsRegistration = fake.registrations.find(registration => {
    return registration.directory === path.join(
      repositoryRoot,
      'src',
      'components',
    )
  })
  componentsRegistration.callback('change', undefined)
  await delay(20)
  assert.equal(observations, 0)
  assert.equal(emissions, 0)

  fingerprint = 'after'
  componentsRegistration.callback('change', undefined)
  await within(completed.promise, 500, 'filename-less source refresh')
  assert.equal(observations, 1)
  assert.equal(emissions, 1)
})

test('a fingerprint read failure reports, observes, and remains recoverable', async t => {
  const { startSourceRefresh } = await import('../src/source-refresh.mjs')
  const repositoryRoot = path.resolve('/tmp/groma-source-refresh-read-failure')
  const fake = createFakeFilesystemWatcher()
  const errors = createNotificationQueue()
  const completed = waitForCompletion()
  const fingerprintError = new Error('temporary fingerprint read failure')
  const observationError = new Error('settled source is unsupported')
  let rejectFingerprint = false
  let rejectObservation = true
  const refresh = await startSourceRefresh(repositoryRoot, {
    fingerprintSource() {
      if (rejectFingerprint) {
        rejectFingerprint = false
        throw fingerprintError
      }
      return 'fingerprint'
    },
    settleMilliseconds: 5,
    watchFileSystem: fake.watchFileSystem,
    observeSource() {
      if (rejectObservation) throw observationError
      return {
        contract: 'groma.typescript-bun/v1',
        containerId: 'scanner',
        entryPoints: [],
        components: [],
      }
    },
    async emitComponents() {},
    onError: error => errors.notify(error),
    onRefreshComplete: completed.resolve,
  })
  t.after(() => refresh.close())

  rejectFingerprint = true
  fake.registrations[2].callback('change', undefined)
  assert.equal(
    await within(errors.next(), 500, 'fingerprint read report'),
    fingerprintError,
  )
  assert.equal(
    await within(errors.next(), 500, 'unsupported observation report'),
    observationError,
  )
  assert.ok(fake.registrations.every(({ handle }) => !handle.closed))

  rejectObservation = false
  fake.registrations[0].callback('change', 'package.json')
  await within(completed.promise, 500, 'fingerprint failure recovery')
  assert.ok(fake.registrations.every(({ handle }) => !handle.closed))
})

test('real filename-less events fingerprint only supported source', async t => {
  const { startSourceRefresh } = await import('../src/source-refresh.mjs')
  const repositoryRoot = await createSupportedRepository(t)
  const fake = createFakeFilesystemWatcher()
  const completed = waitForCompletion()
  let observations = 0
  let emissions = 0
  const refresh = await startSourceRefresh(repositoryRoot, {
    settleMilliseconds: 5,
    watchFileSystem: fake.watchFileSystem,
    async observeSource() {
      observations += 1
      return {
        contract: 'groma.typescript-bun/v1',
        containerId: 'scanner',
        entryPoints: [],
        components: [],
      }
    },
    async emitComponents() {
      emissions += 1
    },
    onError: assert.fail,
    onRefreshComplete: completed.resolve,
  })
  t.after(() => refresh.close())
  const componentsRegistration = fake.registrations[2]

  await writeFile(
    path.join(repositoryRoot, 'src', 'components', 'notes.txt'),
    'outside the supported source scope\n',
  )
  componentsRegistration.callback('change', undefined)
  await delay(20)
  assert.equal(observations, 0)
  assert.equal(emissions, 0)

  const sourceFilename = path.join(
    repositoryRoot,
    'src',
    'components',
    'source-watcher.ts',
  )
  const source = await readFile(sourceFilename, 'utf8')
  await writeFile(
    sourceFilename,
    source.replace('Source watcher', 'Settled source watcher'),
  )
  componentsRegistration.callback('change', undefined)
  await within(completed.promise, 500, 'real filename-less source refresh')
  assert.equal(observations, 1)
  assert.equal(emissions, 1)
})

test('watch failure closes every scope and terminates the service', async () => {
  const { startSourceRefresh } = await import('../src/source-refresh.mjs')
  const repositoryRoot = path.resolve('/tmp/groma-source-refresh-watch-failure')
  const fake = createFakeFilesystemWatcher()
  const errors = []
  let observations = 0
  const refresh = await startSourceRefresh(repositoryRoot, {
    fingerprintSource: async () => 'unchanged',
    watchFileSystem: fake.watchFileSystem,
    observeSource() {
      observations += 1
    },
    emitComponents: assert.fail,
    onError(error) {
      errors.push(error)
    },
  })
  const watcherError = new Error('components watch failed')

  fake.registrations[2].handle.emit('error', watcherError)
  const terminalError = await within(
    refresh.done,
    500,
    'terminal watch failure',
  )
  fake.registrations[0].callback('change', 'package.json')
  await delay(20)

  assert.equal(terminalError, watcherError)
  assert.deepEqual(errors, [watcherError])
  assert.ok(fake.registrations.every(({ handle }) => handle.closed))
  assert.equal(observations, 0)
})

test('a source event during observation waits for a second full refresh', async t => {
  const { startSourceRefresh } = await import('../src/source-refresh.mjs')
  const repositoryRoot = path.resolve('/tmp/groma-source-refresh-queue-test')
  const fake = createFakeFilesystemWatcher()
  const firstObservationStarted = waitForCompletion()
  const releaseFirstObservation = waitForCompletion()
  const twoRefreshesCompleted = waitForCompletion()
  let observations = 0
  let emissions = 0
  const refresh = await startSourceRefresh(repositoryRoot, {
    settleMilliseconds: 5,
    watchFileSystem: fake.watchFileSystem,
    async observeSource() {
      observations += 1
      if (observations === 1) {
        firstObservationStarted.resolve()
        await releaseFirstObservation.promise
      }
      return {
        contract: 'groma.typescript-bun/v1',
        containerId: 'scanner',
        entryPoints: [],
        components: [],
      }
    },
    async emitComponents() {
      emissions += 1
      if (emissions === 2) twoRefreshesCompleted.resolve()
    },
    onError: assert.fail,
  })
  t.after(() => refresh.close())

  const sourceRegistration = fake.registrations.find(registration => {
    return registration.directory === path.join(repositoryRoot, 'src')
  })
  sourceRegistration.callback('change', 'index.ts')
  await firstObservationStarted.promise
  sourceRegistration.callback('change', 'index.ts')
  await delay(10)
  releaseFirstObservation.resolve()
  await within(twoRefreshesCompleted.promise, 500, 'second source refresh')

  assert.equal(observations, 2)
  assert.equal(emissions, 2)
})

test('observer failure retains the last-good owned subtree and can recover', async t => {
  const { startSourceRefresh } = await import('../src/source-refresh.mjs')
  const repositoryRoot = await mkdtemp(
    path.join(os.tmpdir(), 'groma-source-refresh-failure-'),
  )
  t.after(() => rm(repositoryRoot, { recursive: true, force: true }))
  const ownedRoot = path.join(repositoryRoot, ownedRelativePath)
  await mkdir(ownedRoot, { recursive: true })
  await writeFile(
    path.join(ownedRoot, 'last-good.md'),
    '# Last good generated component\n',
  )
  const before = await treeHash(ownedRoot)
  const fake = createFakeFilesystemWatcher()
  const errors = createNotificationQueue()
  const completions = createNotificationQueue()
  let failObservation = true
  let emissions = 0
  const refresh = await startSourceRefresh(repositoryRoot, {
    settleMilliseconds: 5,
    watchFileSystem: fake.watchFileSystem,
    observeSource() {
      if (failObservation) throw new Error('settled source is unsupported')
      return { complete: true }
    },
    async emitComponents() {
      emissions += 1
    },
    onError: error => errors.notify(error),
    onRefreshComplete: result => completions.notify(result),
  })
  t.after(() => refresh.close())

  const rootRegistration = fake.registrations.find(registration => {
    return registration.directory === repositoryRoot
  })
  rootRegistration.callback('change', 'package.json')
  const error = await within(errors.next(), 500, 'source refresh failure')

  assert.equal(error.message, 'settled source is unsupported')
  assert.equal(emissions, 0)
  assert.equal(await treeHash(ownedRoot), before)

  failObservation = false
  rootRegistration.callback('change', 'package.json')
  await within(completions.next(), 500, 'source refresh recovery')
  assert.equal(emissions, 1)
})

test('real add, modify, and remove events replace only the owned subtree', async t => {
  const { startSourceRefresh } = await import('../src/source-refresh.mjs')
  const repositoryRoot = await createSupportedRepository(t)
  const observedRoot = path.join(repositoryRoot, 'groma', 'observed')
  const plansRoot = path.join(repositoryRoot, 'groma', 'plans')
  const beforeManualObserved = await treeHash(observedRoot, {
    exclude(relativeFilename) {
      return relativeFilename === path.relative(observedRoot, path.join(
        repositoryRoot,
        ownedRelativePath,
      )) || relativeFilename.startsWith(`${path.relative(
        observedRoot,
        path.join(repositoryRoot, ownedRelativePath),
      )}${path.sep}`)
    },
  })
  const beforePlans = await treeHash(plansRoot)
  const completions = createNotificationQueue()
  const completedResults = []
  const refresh = await startSourceRefresh(repositoryRoot, {
    settleMilliseconds: 40,
    onError: assert.fail,
    onRefreshComplete(result) {
      completedResults.push(result)
      completions.notify(result)
    },
  })
  t.after(() => refresh.close())
  await delay(50)

  const addedComponent = path.join(
    repositoryRoot,
    'src',
    'components',
    'event-recorder.ts',
  )
  await writeFile(
    addedComponent,
    [
      'export type GromaComponent = {',
      '  id: "event-recorder";',
      '  name: "Event recorder";',
      '  description: "Records settled supported changes.";',
      '  technology: "TypeScript text";',
      '};',
      '',
      'export type GromaRelationships = [];',
      '',
    ].join('\n'),
  )
  await within(completions.next(), 10_000, 'added component refresh')
  assert.match(
    await readFile(
      path.join(repositoryRoot, ownedRelativePath, 'event-recorder.md'),
      'utf8',
    ),
    /Records settled supported changes\\\./,
  )

  const modifiedSource = (
    await readFile(addedComponent, 'utf8')
  ).replace(
    'Records settled supported changes.',
    'Records one complete settled refresh.',
  )
  await writeFile(addedComponent, modifiedSource)
  await within(completions.next(), 10_000, 'modified component refresh')
  assert.match(
    await readFile(
      path.join(repositoryRoot, ownedRelativePath, 'event-recorder.md'),
      'utf8',
    ),
    /Records one complete settled refresh\\\./,
  )

  await rm(addedComponent)
  await within(completions.next(), 10_000, 'removed component refresh')
  await assert.rejects(
    readFile(
      path.join(repositoryRoot, ownedRelativePath, 'event-recorder.md'),
    ),
    error => error.code === 'ENOENT',
  )

  await delay(160)
  assert.equal(completedResults.length, 3)
  assert.deepEqual(
    completedResults.map(result => result.componentIds),
    [
      [
        'event-recorder',
        'markdown-emitter',
        'source-watcher',
        'typescript-observer',
      ],
      [
        'event-recorder',
        'markdown-emitter',
        'source-watcher',
        'typescript-observer',
      ],
      [
        'markdown-emitter',
        'source-watcher',
        'typescript-observer',
      ],
    ],
  )
  assert.equal(
    await treeHash(observedRoot, {
      exclude(relativeFilename) {
        const ownedFromObserved = path.relative(
          observedRoot,
          path.join(repositoryRoot, ownedRelativePath),
        )
        return relativeFilename === ownedFromObserved
          || relativeFilename.startsWith(`${ownedFromObserved}${path.sep}`)
      },
    }),
    beforeManualObserved,
  )
  assert.equal(await treeHash(plansRoot), beforePlans)
})

test('source refresh process closes its watchers on SIGTERM', async t => {
  const repositoryRoot = await mkdtemp(
    path.join(os.tmpdir(), 'groma-source-refresh-process-'),
  )
  await mkdir(path.join(repositoryRoot, 'src', 'components'), {
    recursive: true,
  })
  t.after(() => rm(repositoryRoot, { recursive: true, force: true }))

  const child = spawn(
    process.execPath,
    [
      'src/source-refresh-process.mjs',
      '--repository',
      repositoryRoot,
    ],
    {
      cwd: path.resolve('.'),
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  let stdout = ''
  let stderr = ''
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', chunk => {
    stdout += chunk
    if (stdout.includes('Source refresh watching')) child.kill('SIGTERM')
  })
  child.stderr.on('data', chunk => {
    stderr += chunk
  })

  const [code, signal] = await EventEmitter.once(child, 'exit')

  assert.equal(code, 0)
  assert.equal(signal, null)
  assert.match(stdout, /Source refresh watching/)
  assert.equal(stderr, '')
})

test('source refresh process reports invalid settled source and retains last good', async t => {
  const repositoryRoot = await createSupportedRepository(t)
  const ownedRoot = path.join(repositoryRoot, ownedRelativePath)
  const before = await treeHash(ownedRoot)
  const child = spawn(
    process.execPath,
    [
      'src/source-refresh-process.mjs',
      '--repository',
      repositoryRoot,
    ],
    {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  t.after(() => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL')
    }
  })
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  const ready = waitForCompletion()
  const reported = waitForCompletion()
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', chunk => {
    stdout += chunk
    if (stdout.includes('Source refresh watching')) ready.resolve()
  })
  child.stderr.on('data', chunk => {
    stderr += chunk
    if (stderr.includes('Repository does not match')) reported.resolve()
  })

  await within(ready.promise, 1_000, 'source refresh process startup')
  await writeFile(path.join(repositoryRoot, 'package.json'), '{}\n')
  await within(reported.promise, 3_000, 'invalid source report')

  assert.match(
    stderr,
    /\[groma source refresh\] Repository does not match groma\.typescript-bun\/v1\./,
  )
  assert.equal(child.exitCode, null)
  assert.equal(await treeHash(ownedRoot), before)

  child.kill('SIGTERM')
  const [code, signal] = await EventEmitter.once(child, 'exit')
  assert.equal(code, 0)
  assert.equal(signal, null)
})
