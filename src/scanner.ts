import { readdirSync, watch } from 'node:fs'
import type { FSWatcher } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'

import { reconcileScanObservations } from './core.ts'
import { loadScannerRegistry } from './scanner/registry.ts'
import type { ScannerRegistry } from './scanner/registry.ts'
import type { ScanSummary } from './types.ts'

const SETTLE_MS = 150
const skippedRoots = new Set(['.git', 'groma', 'node_modules'])

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

function sourceRelative(directory: string, filename: string | null): string | undefined {
  if (filename === null) return undefined
  const joined = directory === ''
    ? String(filename)
    : path.join(directory, String(filename))
  return joined.split(path.sep).join('/')
}

function sourceWatchRoots(repositoryRoot: string): { directory: string; prefix: string }[] {
  const roots: { directory: string; prefix: string }[] = [
    { directory: repositoryRoot, prefix: '' },
  ]
  for (const entry of readdirSync(repositoryRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || skippedRoots.has(entry.name)) continue
    roots.push({
      directory: path.join(repositoryRoot, entry.name),
      prefix: entry.name,
    })
  }
  return roots
}

export async function watchScan(
  repositoryRoot: string,
  options: {
    onFold?: (summary: ScanSummary) => void | Promise<void>
    onError?: (error: unknown) => void
  } = {},
): Promise<{ close(): void }> {
  const root = path.resolve(repositoryRoot)
  const registry = await loadScannerRegistry(root)
  const startedAt = Date.now()
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false
  let pending = false
  let closed = false

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
        void run()
      }
    }
  }

  function schedule(): void {
    if (closed) return
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (running) pending = true
      else void run()
    }, SETTLE_MS)
  }

  function onSourceEvent(prefix: string, filename: string | null): void {
    if (closed) return
    const relative = sourceRelative(prefix, filename)
    if (relative === undefined || !registry.matchesFile(relative)) return
    void stat(path.join(root, relative)).then(info => {
      if (!closed && info.mtimeMs >= startedAt) schedule()
    }, () => {
      if (!closed) schedule()
    })
  }

  const watchers: FSWatcher[] = sourceWatchRoots(root).map(item => {
    return watch(item.directory, { recursive: item.prefix !== '' }, (_event, filename) => {
      onSourceEvent(item.prefix, filename)
    })
  })

  return {
    close() {
      if (closed) return
      closed = true
      clearTimeout(timer)
      for (const watcher of watchers) watcher.close()
    },
  }
}
