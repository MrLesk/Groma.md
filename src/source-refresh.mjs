import { createHash } from 'node:crypto'
import { watch } from 'node:fs'
import {
  lstat,
  readFile,
  readdir,
  readlink,
  stat,
} from 'node:fs/promises'
import path from 'node:path'

import { emitObservedComponents } from './markdown-emitter.mjs'
import { observeTypeScriptSource } from './source-observer.mjs'

const defaultSettleMilliseconds = 120

class SourceWatchTopologyError extends Error {
  constructor(options) {
    super(
      'Supported source watch topology changed; restart required.',
      options,
    )
    this.name = 'SourceWatchTopologyError'
    this.code = 'GROMA_SOURCE_WATCH_TOPOLOGY_CHANGED'
  }
}

function bytewiseCompare(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'))
}

async function addFingerprintPath(hash, repositoryRoot, relativeFilename) {
  const filename = path.join(
    repositoryRoot,
    ...relativeFilename.split('/'),
  )
  hash.update(relativeFilename)
  hash.update('\0')

  let stat
  try {
    stat = await lstat(filename)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    hash.update('missing\0')
    return null
  }

  if (stat.isSymbolicLink()) {
    hash.update('symbolic-link\0')
    try {
      hash.update(await readlink(filename))
      hash.update('\0')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      hash.update('vanished\0')
    }
  } else if (stat.isFile()) {
    hash.update('file\0')
    try {
      hash.update(await readFile(filename))
      hash.update('\0')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      hash.update('vanished\0')
    }
  } else if (stat.isDirectory()) {
    hash.update('directory\0')
  } else {
    hash.update('other\0')
  }
  return stat
}

async function supportedSourceFingerprint(repositoryRoot) {
  const hash = createHash('sha256')
  await addFingerprintPath(hash, repositoryRoot, 'package.json')
  await addFingerprintPath(hash, repositoryRoot, 'src/index.ts')
  const componentsStat = await addFingerprintPath(
    hash,
    repositoryRoot,
    'src/components',
  )
  if (componentsStat?.isDirectory() && !componentsStat.isSymbolicLink()) {
    const componentDirectory = path.join(
      repositoryRoot,
      'src',
      'components',
    )
    let names
    try {
      names = (await readdir(componentDirectory))
        .filter(name => /^[^/\\]+\.ts$/.test(name))
        .sort(bytewiseCompare)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      hash.update('components-vanished\0')
      return hash.digest('hex')
    }
    for (const name of names) {
      await addFingerprintPath(
        hash,
        repositoryRoot,
        `src/components/${name}`,
      )
    }
  }
  return hash.digest('hex')
}

function isSupportedEvent(scope, filename) {
  if (typeof filename !== 'string') return false

  if (scope === 'repository') return filename === 'package.json'
  if (scope === 'source') return filename === 'index.ts'
  return /^[^/\\]+\.ts$/.test(filename)
}

function sameDirectoryIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino
}

async function readFilesystemDirectoryIdentity(directory) {
  let identity
  try {
    identity = await stat(directory, { bigint: true })
  } catch (error) {
    throw new SourceWatchTopologyError({ cause: error })
  }
  if (!identity.isDirectory()) throw new SourceWatchTopologyError()
  return identity
}

export async function startSourceRefresh(suppliedRepositoryRoot, options = {}) {
  const repositoryRoot = path.resolve(suppliedRepositoryRoot)
  const {
    emitComponents = emitObservedComponents,
    fingerprintSource = supportedSourceFingerprint,
    observeSource = observeTypeScriptSource,
    onError = error => {
      console.error(`[groma source refresh] ${error.message}`)
    },
    onRefreshComplete = () => {},
    readWatchDirectoryIdentity = readFilesystemDirectoryIdentity,
    settleMilliseconds = defaultSettleMilliseconds,
    watchFileSystem = watch,
  } = options
  const watchScopes = [
    {
      directory: repositoryRoot,
      scope: 'repository',
    },
    {
      directory: path.join(repositoryRoot, 'src'),
      scope: 'source',
    },
    {
      directory: path.join(repositoryRoot, 'src', 'components'),
      scope: 'components',
    },
  ]
  const handles = []
  const watchDirectoryIdentities = new Map()
  for (const { directory } of watchScopes) {
    watchDirectoryIdentities.set(
      directory,
      await readWatchDirectoryIdentity(directory),
    )
  }
  let fingerprint
  let hasFingerprint = false
  let initialFingerprintError
  try {
    fingerprint = await fingerprintSource(repositoryRoot)
    hasFingerprint = true
  } catch (error) {
    initialFingerprintError = error
  }
  let closed = false
  let pending = false
  let settleTimer
  let running = false
  let refreshPromise = Promise.resolve()
  let fingerprintPromise = Promise.resolve()
  let closePromise
  let resolveDone
  const done = new Promise(resolve => {
    resolveDone = resolve
  })

  async function reportError(error) {
    try {
      await onError(error)
    } catch (reportingError) {
      console.error(
        `[groma source refresh] error reporter failed: ${
          reportingError.message
        }`,
      )
    }
  }

  function terminate(failure) {
    if (closePromise !== undefined) return closePromise

    closed = true
    pending = false
    if (settleTimer !== undefined) {
      clearTimeout(settleTimer)
      settleTimer = undefined
    }
    for (const handle of handles) handle.close()
    closePromise = (async () => {
      if (failure !== null) await reportError(failure)
      await Promise.allSettled([fingerprintPromise, refreshPromise])
      resolveDone(failure)
      return failure
    })()
    return closePromise
  }

  function startPendingRefresh() {
    if (
      closed
      || running
      || !pending
      || settleTimer !== undefined
    ) {
      return
    }

    pending = false
    running = true
    refreshPromise = (async () => {
      try {
        const observation = await observeSource(repositoryRoot)
        const result = await emitComponents(repositoryRoot, observation)
        await onRefreshComplete(result)
      } catch (error) {
        await reportError(error)
      } finally {
        running = false
        if (!closed && pending && settleTimer === undefined) {
          startPendingRefresh()
        }
      }
    })()
  }

  function scheduleRefresh() {
    pending = true
    if (settleTimer !== undefined) clearTimeout(settleTimer)
    settleTimer = setTimeout(() => {
      settleTimer = undefined
      startPendingRefresh()
    }, settleMilliseconds)
  }

  async function validateWatchTopology() {
    for (const { directory } of watchScopes) {
      const expectedIdentity = watchDirectoryIdentities.get(directory)
      const currentIdentity = await readWatchDirectoryIdentity(directory)
      if (
        !sameDirectoryIdentity(currentIdentity, expectedIdentity)
      ) {
        throw new SourceWatchTopologyError()
      }
    }
  }

  async function updateSupportedSourceFingerprint(forceRefresh) {
    if (closed) return
    const nextFingerprint = await fingerprintSource(repositoryRoot)
    if (closed) return
    const changed = !hasFingerprint || nextFingerprint !== fingerprint
    fingerprint = nextFingerprint
    hasFingerprint = true
    if (forceRefresh || changed) scheduleRefresh()
  }

  function queueInspection(inspect) {
    fingerprintPromise = fingerprintPromise.then(async () => {
      if (closed) return
      await inspect()
    }).catch(async error => {
      if (error instanceof SourceWatchTopologyError) {
        queueMicrotask(() => void terminate(error))
        return
      }
      await reportError(error)
      if (!closed) scheduleRefresh()
    })
    return fingerprintPromise
  }

  function inspectSupportedSource(forceRefresh) {
    return queueInspection(
      () => updateSupportedSourceFingerprint(forceRefresh),
    )
  }

  function inspectFilesystemEvent(scope, filename) {
    return queueInspection(async () => {
      await validateWatchTopology()
      if (typeof filename !== 'string') {
        await updateSupportedSourceFingerprint(false)
      } else if (isSupportedEvent(scope, filename)) {
        await updateSupportedSourceFingerprint(true)
      }
    })
  }

  try {
    for (const { directory, scope } of watchScopes) {
      const handle = watchFileSystem(
        directory,
        { encoding: 'utf8', recursive: false },
        (_eventType, filename) => {
          if (closed) return
          void inspectFilesystemEvent(scope, filename)
        },
      )
      handle.on('error', error => {
        if (!closed) void terminate(error)
      })
      handles.push(handle)
    }
    await validateWatchTopology()
    if (initialFingerprintError === undefined) {
      await inspectSupportedSource(false)
    } else {
      await reportError(initialFingerprintError)
      if (!closed) scheduleRefresh()
    }
  } catch (error) {
    closed = true
    for (const handle of handles) handle.close()
    try {
      await validateWatchTopology()
    } catch (topologyError) {
      throw topologyError
    }
    throw error
  }

  return {
    done,
    async close() {
      await terminate(null)
    },
  }
}
