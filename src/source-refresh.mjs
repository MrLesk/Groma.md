import { watch } from 'node:fs'
import path from 'node:path'

import { emitObservedComponents } from './markdown-emitter.mjs'
import { observeTypeScriptSource } from './source-observer.mjs'

const defaultSettleMilliseconds = 120

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
    observeSource = observeTypeScriptSource,
    onError = error => {
      console.error(`[groma source refresh] ${error.message}`)
    },
    onRefreshComplete = () => {},
    settleMilliseconds = defaultSettleMilliseconds,
    watchFileSystem = watch,
  } = options
  const watchScopes = [
    { directory: repositoryRoot, scope: 'repository' },
    { directory: path.join(repositoryRoot, 'src'), scope: 'source' },
    {
      directory: path.join(repositoryRoot, 'src', 'components'),
      scope: 'components',
    },
  ]
  const handles = []
  let closed = false
  let settleTimer
  let refreshQueue = Promise.resolve()

  function scheduleRefresh() {
    if (settleTimer !== undefined) clearTimeout(settleTimer)
    settleTimer = setTimeout(() => {
      settleTimer = undefined
      refreshQueue = refreshQueue.then(async () => {
        if (closed) return
        try {
          const observation = await observeSource(repositoryRoot)
          const result = await emitComponents(repositoryRoot, observation)
          await onRefreshComplete(result)
        } catch (error) {
          await onError(error)
        }
      })
    }, settleMilliseconds)
  }

  try {
    for (const { directory, scope } of watchScopes) {
      const handle = watchFileSystem(
        directory,
        { encoding: 'utf8', recursive: false },
        (_eventType, filename) => {
          if (!closed && isSupportedEvent(scope, filename)) {
            scheduleRefresh()
          }
        },
      )
      handle.on('error', error => {
        if (!closed) void onError(error)
      })
      handles.push(handle)
    }
  } catch (error) {
    closed = true
    for (const handle of handles) handle.close()
    throw error
  }

  return {
    async close() {
      if (closed) return
      closed = true
      if (settleTimer !== undefined) {
        clearTimeout(settleTimer)
        settleTimer = undefined
      }
      for (const handle of handles) handle.close()
      await refreshQueue
    },
  }
}
