import { watch } from 'node:fs'
import type { FSWatcher } from 'node:fs'
import path from 'node:path'

import { emitObservedComponents } from './markdown-emitter.ts'
import { scanTypeScriptSource } from './typescript-scanner.ts'

const defaultSettleMilliseconds = 120

type WatchScope = 'repository' | 'source' | 'components'
type EmissionResult = Awaited<ReturnType<typeof emitObservedComponents>>

interface ScannerOptions {
  emitComponents?: typeof emitObservedComponents
  scanSource?: typeof scanTypeScriptSource
  onError?: (error: unknown) => void | Promise<void>
  onScanComplete?: (result: EmissionResult) => void | Promise<void>
  settleMilliseconds?: number
  watchFileSystem?: typeof watch
}

function isSupportedEvent(scope: WatchScope, filename: string | Buffer | null): boolean {
  if (typeof filename !== 'string') return false
  if (scope === 'repository') return filename === 'package.json'
  if (scope === 'source') return filename === 'index.ts'
  return /^[^/\\]+\.ts$/.test(filename)
}

export async function startScanner(
  suppliedRepositoryRoot: string,
  options: ScannerOptions = {},
) {
  const repositoryRoot = path.resolve(suppliedRepositoryRoot)
  const {
    emitComponents = emitObservedComponents,
    scanSource = scanTypeScriptSource,
    onError = error => {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[groma scanner] ${message}`)
    },
    onScanComplete = () => {},
    settleMilliseconds = defaultSettleMilliseconds,
    watchFileSystem = watch,
  } = options
  const watchScopes: Array<{ directory: string; scope: WatchScope }> = [
    { directory: repositoryRoot, scope: 'repository' },
    { directory: path.join(repositoryRoot, 'src'), scope: 'source' },
    {
      directory: path.join(repositoryRoot, 'src', 'components'),
      scope: 'components',
    },
  ]
  const handles: FSWatcher[] = []
  let closed = false
  let settleTimer: NodeJS.Timeout | undefined
  let scanQueue: Promise<void> = Promise.resolve()

  function scheduleScan(): void {
    if (settleTimer !== undefined) clearTimeout(settleTimer)
    settleTimer = setTimeout(() => {
      settleTimer = undefined
      scanQueue = scanQueue.then(async () => {
        if (closed) return
        try {
          const scanResult = await scanSource(repositoryRoot)
          const result = await emitComponents(repositoryRoot, scanResult)
          await onScanComplete(result)
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
            scheduleScan()
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
      await scanQueue
    },
  }
}
