import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { watch } from 'node:fs'
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
import type { TestContext } from 'node:test'
import { fileURLToPath } from 'node:url'
import type { TypeScriptScanResult } from '../src/types.ts'

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

  ref(): this {
    return this
  }

  unref(): this {
    return this
  }
}

type FakeWatchCallback = (
  eventType: 'rename' | 'change',
  filename: string | Buffer | null | undefined,
) => void

interface FakeWatchRegistration {
  callback: FakeWatchCallback
  directory: string
  handle: FakeWatchHandle
  options: { encoding: string; recursive: boolean }
}

function createFakeFilesystemWatcher() {
  const registrations: FakeWatchRegistration[] = []
  const watchFileSystem = ((
    directory: string,
    options: { encoding: string; recursive: boolean },
    callback: FakeWatchCallback,
  ) => {
    const handle = new FakeWatchHandle()
    registrations.push({ callback, directory, handle, options })
    return handle
  }) as unknown as typeof watch
  return {
    registrations,
    watchFileSystem,
  }
}

function deferred<T = void>() {
  let settle!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>(resolvePromise => {
    settle = resolvePromise
  })
  const resolve = (value?: T): void => settle(value as T)
  return { promise, resolve }
}

function notificationQueue<T>() {
  const values: T[] = []
  const waiters: Array<(value: T) => void> = []
  return {
    next(): Promise<T> {
      const value = values.shift()
      if (value !== undefined) return Promise.resolve(value)
      const next = deferred<T>()
      waiters.push(value => next.resolve(value))
      return next.promise
    },
    notify(value: T): void {
      const resolve = waiters.shift()
      if (resolve) resolve(value)
      else values.push(value)
    },
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

async function within<T>(promise: Promise<T>, milliseconds: number, label: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`Timed out waiting for ${label}`))
        }, milliseconds)
      }),
    ])
  } finally {
    if (timeout !== undefined) clearTimeout(timeout)
  }
}

async function treeHash(
  directory: string,
  options: { exclude?: (relativeFilename: string) => boolean } = {},
): Promise<string> {
  const { exclude = () => false } = options
  const hash = createHash('sha256')

  async function walk(currentDirectory: string): Promise<void> {
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

async function createSupportedRepository(t: TestContext): Promise<string> {
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

const fakeScanResult: TypeScriptScanResult = {
  contract: 'groma.scanner.typescript-bun/v1',
  containerId: 'scanner',
  entryPoints: [],
  components: [],
}

const fakeEmissionResult = {
  componentIds: [] as string[],
  outputDirectory: ownedRelativePath,
}

function failOnError(error: unknown): never {
  assert.fail(error instanceof Error ? error : String(error))
}

function requiredRegistration(
  registration: FakeWatchRegistration | undefined,
): FakeWatchRegistration {
  assert.ok(registration)
  return registration
}

test('one settled supported event burst runs one complete scan and emission', async t => {
  const { startScanner } = await import('../src/scanner.ts')
  const repositoryRoot = path.resolve('/tmp/groma-scanner-test')
  const fake = createFakeFilesystemWatcher()
  const completed = deferred<typeof fakeEmissionResult>()
  const scanResult = fakeScanResult
  const calls: unknown[][] = []
  const scanner = await startScanner(repositoryRoot, {
    settleMilliseconds: 5,
    watchFileSystem: fake.watchFileSystem,
    async scanSource(root) {
      calls.push(['scan', root])
      return scanResult
    },
    async emitComponents(root, suppliedScanResult) {
      calls.push(['emit', root, suppliedScanResult])
      return fakeEmissionResult
    },
    onError: failOnError,
    onScanComplete(result) {
      completed.resolve(result)
    },
  })
  t.after(() => scanner.close())

  const byDirectory = new Map(
    fake.registrations.map(registration => [
      registration.directory,
      registration,
    ]),
  )
  requiredRegistration(byDirectory.get(repositoryRoot)).callback('change', 'package.json')
  requiredRegistration(byDirectory.get(path.join(repositoryRoot, 'src')))
    .callback('rename', 'index.ts')
  requiredRegistration(byDirectory.get(path.join(repositoryRoot, 'src', 'components')))
    .callback('change', 'source-watcher.ts')

  await within(completed.promise, 500, 'settled scan')
  assert.deepEqual(calls, [
    ['scan', repositoryRoot],
    ['emit', repositoryRoot, scanResult],
  ])
})

test('out-of-scope and filename-less events are ignored before scanning', async t => {
  const { startScanner } = await import('../src/scanner.ts')
  const repositoryRoot = path.resolve('/tmp/groma-scanner-filter-test')
  const fake = createFakeFilesystemWatcher()
  const calls: string[] = []
  const scanner = await startScanner(repositoryRoot, {
    settleMilliseconds: 5,
    watchFileSystem: fake.watchFileSystem,
    async scanSource() {
      calls.push('scan')
      return fakeScanResult
    },
    async emitComponents() {
      calls.push('emit')
      return fakeEmissionResult
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
  requiredRegistration(byDirectory.get(repositoryRoot)).callback('change', 'README.md')
  requiredRegistration(byDirectory.get(repositoryRoot)).callback('change', 'bun.lock')
  requiredRegistration(byDirectory.get(path.join(repositoryRoot, 'src')))
    .callback('change', 'other.ts')
  requiredRegistration(byDirectory.get(path.join(repositoryRoot, 'src', 'components')))
    .callback('change', 'nested/deep.ts')
  requiredRegistration(byDirectory.get(path.join(repositoryRoot, 'src', 'components')))
    .callback('change', 'component.tsx')
  requiredRegistration(byDirectory.get(path.join(repositoryRoot, 'src', 'components')))
    .callback('change', undefined)

  await delay(20)
  assert.deepEqual(calls, [])
})

test('a supported event during scanning queues one later complete scan', async t => {
  const { startScanner } = await import('../src/scanner.ts')
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
      return fakeScanResult
    },
    async emitComponents() {
      emissions += 1
      if (emissions === 2) twoScansCompleted.resolve()
      return fakeEmissionResult
    },
    onError: failOnError,
  })
  t.after(() => scanner.close())

  const sourceRegistration = requiredRegistration(fake.registrations.find(registration => {
    return registration.directory === path.join(repositoryRoot, 'src')
  }))
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
  const { startScanner } = await import('../src/scanner.ts')
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
  type EmissionResult = typeof fakeEmissionResult
  const completions = notificationQueue<EmissionResult>()
  const completedResults: EmissionResult[] = []
  const scanner = await startScanner(repositoryRoot, {
    settleMilliseconds: 40,
    watchFileSystem: fake.watchFileSystem,
    onError: failOnError,
    onScanComplete(result) {
      completedResults.push(result)
      completions.notify(result)
    },
  })
  t.after(() => scanner.close())
  const sourceRegistration = requiredRegistration(fake.registrations.find(registration => {
    return registration.directory === path.join(repositoryRoot, 'src', 'components')
  }))

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
    error => error instanceof Error && 'code' in error && error.code === 'ENOENT',
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
      '--import=tsx',
      'src/scanner-process.ts',
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
