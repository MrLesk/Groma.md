import { createHash } from 'node:crypto'
import { watch } from 'node:fs'
import {
  lstat,
  readFile,
  readdir,
  readlink,
} from 'node:fs/promises'
import path from 'node:path'

import { emitObservedComponents } from './markdown-emitter.mjs'
import { observeTypeScriptSource } from './source-observer.mjs'

const defaultSettleMilliseconds = 120

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
    hash.update(
      error.code === 'ENOENT'
        ? 'missing\0'
        : `lstat-error:${error.code ?? error.name}\0`,
    )
    return null
  }

  if (stat.isSymbolicLink()) {
    hash.update('symbolic-link\0')
    try {
      hash.update(await readlink(filename))
      hash.update('\0')
    } catch (error) {
      hash.update(`readlink-error:${error.code ?? error.name}\0`)
    }
  } else if (stat.isFile()) {
    hash.update('file\0')
    try {
      hash.update(await readFile(filename))
      hash.update('\0')
    } catch (error) {
      hash.update(`read-error:${error.code ?? error.name}\0`)
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
      hash.update(`readdir-error:${error.code ?? error.name}\0`)
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
  let fingerprint = await fingerprintSource(repositoryRoot)
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

  function inspectSupportedSource(forceRefresh) {
    fingerprintPromise = fingerprintPromise.then(async () => {
      if (closed) return
      const nextFingerprint = await fingerprintSource(repositoryRoot)
      if (closed) return
      const changed = nextFingerprint !== fingerprint
      fingerprint = nextFingerprint
      if (forceRefresh || changed) scheduleRefresh()
    }).catch(async error => {
      await reportError(error)
      if (!closed) scheduleRefresh()
    })
    return fingerprintPromise
  }

  try {
    for (const { directory, scope } of watchScopes) {
      const handle = watchFileSystem(
        directory,
        { encoding: 'utf8', recursive: false },
        (_eventType, filename) => {
          if (closed) return
          if (typeof filename !== 'string') {
            void inspectSupportedSource(false)
          } else if (isSupportedEvent(scope, filename)) {
            void inspectSupportedSource(true)
          }
        },
      )
      handle.on('error', error => {
        if (!closed) void terminate(error)
      })
      handles.push(handle)
    }
    await inspectSupportedSource(false)
  } catch (error) {
    closed = true
    for (const handle of handles) handle.close()
    throw error
  }

  return {
    done,
    async close() {
      await terminate(null)
    },
  }
}
