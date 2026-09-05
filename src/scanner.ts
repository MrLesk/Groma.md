import { subscribe } from '@parcel/watcher'
import { realpath } from 'node:fs/promises'
import path from 'node:path'

import { reconcileScanObservations } from './core.ts'
import { gromaDirectories } from './groma-filesystem.ts'
import { loadScannerRegistry } from './scanner/registry.ts'
import type { ScannerRegistry } from './scanner/registry.ts'
import type { ScanSummary } from './types.ts'

const SETTLE_MS = 150
const skippedRoots = new Set(['.git', ...gromaDirectories, 'node_modules'])

export function formatScanSummary(summary: ScanSummary): string {
  return `created ${summary.created}, refreshed ${summary.refreshed}, matched ${summary.matched}`
}

export async function scanRepository(
  repositoryRoot: string,
): Promise<ScanSummary> {
  const registry = await loadScannerRegistry(repositoryRoot)
  return scanWithRegistry(repositoryRoot, registry)
}

async function scanWithRegistry(
  repositoryRoot: string,
  registry: ScannerRegistry,
): Promise<ScanSummary> {
  const observations = await registry.collectObservations(repositoryRoot)
  return reconcileScanObservations(repositoryRoot, observations)
}

export async function watchScan(
  repositoryRoot: string,
  options: {
    onFold?: (summary: ScanSummary) => void | Promise<void>
    onError?: (error: unknown) => void
  } = {},
): Promise<{ close(): Promise<void> }> {
  const root = await realpath(repositoryRoot)
  const registry = await loadScannerRegistry(root)
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false
  let pending = false
  let closed = false
  let active = Promise.resolve()

  function launch(): void {
    active = run()
  }

  async function run(): Promise<void> {
    if (closed) return
    running = true
    try {
      const summary = await scanWithRegistry(root, registry)
      if (!closed) await options.onFold?.(summary)
    } catch (error) {
      if (!closed) options.onError?.(error)
    } finally {
      running = false
      if (pending && !closed) {
        pending = false
        launch()
      }
    }
  }

  function schedule(): void {
    if (closed) return
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (running) pending = true
      else launch()
    }, SETTLE_MS)
  }

  const watcher = await subscribe(root, (error, events) => {
    if (error) {
      options.onError?.(error)
      return
    }
    if (events.some(event => registry.matchesFile(path.relative(root, event.path).split(path.sep).join('/')))) {
      schedule()
    }
  }, { ignore: [...skippedRoots] })

  return {
    async close() {
      if (closed) return
      closed = true
      clearTimeout(timer)
      await watcher.unsubscribe()
      await active
    },
  }
}
