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

async function within(promise, milliseconds, label) {
  let timeout
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`Timed out waiting for ${label}`))
        }, milliseconds)
      }),
    ])
  } finally {
    clearTimeout(timeout)
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
    path.join(os.tmpdir(), 'groma-scanner-integration-'),
  )
  t.after(() => rm(repositoryRoot, { recursive: true, force: true }))
  const fixtureRoot = path.join(
    projectRoot,
    'fixtures',
    'scanners',
    'typescript',
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

test('one settled supported event burst runs one complete scan and emission', async t => {
  const { startScanner } = await import('../src/scanner.mjs')
  const repositoryRoot = path.resolve('/tmp/groma-scanner-test')
  const fake = createFakeFilesystemWatcher()
  const completed = deferred()
  const scanResult = { complete: true }
  const calls = []
  const scanner = await startScanner(repositoryRoot, {
    settleMilliseconds: 5,
    watchFileSystem: fake.watchFileSystem,
    async scanSource(root) {
      calls.push(['scan', root])
      return scanResult
    },
    async emitComponents(root, suppliedScanResult) {
      calls.push(['emit', root, suppliedScanResult])
    },
    onError: assert.fail,
    onScanComplete: completed.resolve,
  })
  t.after(() => scanner.close())

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

  await within(completed.promise, 500, 'settled scan')
  assert.deepEqual(calls, [
    ['scan', repositoryRoot],
    ['emit', repositoryRoot, scanResult],
  ])
})

test('out-of-scope and filename-less events are ignored before scanning', async t => {
  const { startScanner } = await import('../src/scanner.mjs')
  const repositoryRoot = path.resolve('/tmp/groma-scanner-filter-test')
  const fake = createFakeFilesystemWatcher()
  const calls = []
  const scanner = await startScanner(repositoryRoot, {
    settleMilliseconds: 5,
    watchFileSystem: fake.watchFileSystem,
    scanSource() {
      calls.push('scan')
    },
    emitComponents() {
      calls.push('emit')
    },
    onError() {
      calls.push('error')
    },
  })
  t.after(() => scanner.close())

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

test('a supported event during scanning queues one later complete scan', async t => {
  const { startScanner } = await import('../src/scanner.mjs')
  const repositoryRoot = path.resolve('/tmp/groma-scanner-queue-test')
  const fake = createFakeFilesystemWatcher()
  const firstScanStarted = deferred()
  const releaseFirstScan = deferred()
  const twoScansCompleted = deferred()
  let scans = 0
  let emissions = 0
  const scanner = await startScanner(repositoryRoot, {
    settleMilliseconds: 5,
    watchFileSystem: fake.watchFileSystem,
    async scanSource() {
      scans += 1
      if (scans === 1) {
        firstScanStarted.resolve()
        await releaseFirstScan.promise
      }
      return { complete: true }
    },
    async emitComponents() {
      emissions += 1
      if (emissions === 2) twoScansCompleted.resolve()
    },
    onError: assert.fail,
  })
  t.after(() => scanner.close())

  const sourceRegistration = fake.registrations.find(registration => {
    return registration.directory === path.join(repositoryRoot, 'src')
  })
  sourceRegistration.callback('change', 'index.ts')
  await firstScanStarted.promise
  sourceRegistration.callback('change', 'index.ts')
  await delay(10)
  releaseFirstScan.resolve()
  await within(twoScansCompleted.promise, 500, 'second scanner')

  assert.equal(scans, 2)
  assert.equal(emissions, 2)
})

test('add, modify, and remove events replace only the owned subtree', async t => {
  const { startScanner } = await import('../src/scanner.mjs')
  const repositoryRoot = await createSupportedRepository(t)
  const fake = createFakeFilesystemWatcher()
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
  const scanner = await startScanner(repositoryRoot, {
    settleMilliseconds: 40,
    watchFileSystem: fake.watchFileSystem,
    onError: assert.fail,
    onScanComplete(result) {
      completedResults.push(result)
      completions.notify(result)
    },
  })
  t.after(() => scanner.close())
  const sourceRegistration = fake.registrations.find(registration => {
    return registration.directory === path.join(repositoryRoot, 'src', 'components')
  })

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
  sourceRegistration.callback('rename', 'event-recorder.ts')
  await within(completions.next(), 10_000, 'added component scan')
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
    'Records one complete settled scan.',
  )
  await writeFile(addedComponent, modifiedSource)
  sourceRegistration.callback('change', 'event-recorder.ts')
  await within(completions.next(), 10_000, 'modified component scan')
  assert.match(
    await readFile(
      path.join(repositoryRoot, ownedRelativePath, 'event-recorder.md'),
      'utf8',
    ),
    /Records one complete settled scan\\\./,
  )

  await rm(addedComponent)
  sourceRegistration.callback('rename', 'event-recorder.ts')
  await within(completions.next(), 10_000, 'removed component scan')
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
        'scanner-plugin',
        'source-watcher',
      ],
      [
        'event-recorder',
        'markdown-emitter',
        'scanner-plugin',
        'source-watcher',
      ],
      [
        'markdown-emitter',
        'scanner-plugin',
        'source-watcher',
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

test('scanner process closes its watchers on SIGTERM', async t => {
  const repositoryRoot = await mkdtemp(
    path.join(os.tmpdir(), 'groma-scanner-process-'),
  )
  await mkdir(path.join(repositoryRoot, 'src', 'components'), {
    recursive: true,
  })
  t.after(() => rm(repositoryRoot, { recursive: true, force: true }))

  const child = spawn(
    process.execPath,
    [
      'src/scanner-process.mjs',
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
    if (stdout.includes('Scanner watching')) child.kill('SIGTERM')
  })
  child.stderr.on('data', chunk => {
    stderr += chunk
  })

  const [code, signal] = await EventEmitter.once(child, 'exit')
  assert.equal(code, 0)
  assert.equal(signal, null)
  assert.match(stdout, /Scanner watching/)
  assert.equal(stderr, '')
})
