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

function deferred() {
  let resolve
  const promise = new Promise(resolvePromise => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function notificationQueue() {
  const values = []
  const waiters = []
  return {
    next() {
      if (values.length > 0) return Promise.resolve(values.shift())
      const next = deferred()
      waiters.push(next.resolve)
      return next.promise
    },
    notify(value) {
      const resolve = waiters.shift()
      if (resolve) resolve(value)
      else values.push(value)
    },
  }
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function within(promise, milliseconds, label) {
  return Promise.race([
    promise,
    delay(milliseconds).then(() => {
      throw new Error(`Timed out waiting for ${label}`)
    }),
  ])
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
  const completed = deferred()
  const observation = { complete: true }
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

  await within(completed.promise, 500, 'settled refresh')
  assert.deepEqual(calls, [
    ['observe', repositoryRoot],
    ['emit', repositoryRoot, observation],
  ])
})

test('out-of-scope and filename-less events are ignored before observation', async t => {
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

test('a supported event during observation queues one later complete refresh', async t => {
  const { startSourceRefresh } = await import('../src/source-refresh.mjs')
  const repositoryRoot = path.resolve('/tmp/groma-source-refresh-queue-test')
  const fake = createFakeFilesystemWatcher()
  const firstObservationStarted = deferred()
  const releaseFirstObservation = deferred()
  const twoRefreshesCompleted = deferred()
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
      return { complete: true }
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

test('real add, modify, and remove events replace only the owned subtree', async t => {
  const { startSourceRefresh } = await import('../src/source-refresh.mjs')
  const repositoryRoot = await createSupportedRepository(t)
  const observedRoot = path.join(repositoryRoot, 'groma', 'observed')
  const plansRoot = path.join(repositoryRoot, 'groma', 'plans')
  const ownedFromObserved = path.relative(
    observedRoot,
    path.join(repositoryRoot, ownedRelativePath),
  )
  const beforeManualObserved = await treeHash(observedRoot, {
    exclude(relativeFilename) {
      return relativeFilename === ownedFromObserved
        || relativeFilename.startsWith(`${ownedFromObserved}${path.sep}`)
    },
  })
  const beforePlans = await treeHash(plansRoot)
  const completions = notificationQueue()
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
      cwd: projectRoot,
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
