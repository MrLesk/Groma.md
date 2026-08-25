import { readdirSync, watch } from 'node:fs'
import type { FSWatcher } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'

import { reconcileScanObservations } from './core.ts'
import {
  isCSharpScanFile,
  scanCSharpSource,
} from './scanner/csharp/adapter.ts'
import { isTypeScriptScanFile } from './scanner/typescript/files.ts'
import { scanTypeScriptSource } from './scanner/typescript/scan.ts'
import type { ScanSummary } from './types.ts'

const SETTLE_MS = 150
const skippedRoots = new Set(['.git', 'groma', 'node_modules'])

export function formatScanSummary(summary: ScanSummary): string {
  return `created ${summary.created}, refreshed ${summary.refreshed}, matched ${summary.matched}`
}

export async function scanRepository(
  repositoryRoot: string,
): Promise<ScanSummary> {
  const observations = (await Promise.all([
    scanTypeScriptSource(repositoryRoot),
    scanCSharpSource(repositoryRoot),
  ])).filter(observation => observation !== undefined)
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

export function watchScan(
  repositoryRoot: string,
  options: {
    onFold?: (summary: ScanSummary) => void | Promise<void>
    onError?: (error: unknown) => void
  } = {},
): { close(): void } {
  const root = path.resolve(repositoryRoot)
  const startedAt = Date.now()
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false
  let pending = false
  let closed = false

  async function run(): Promise<void> {
    if (closed) return
    running = true
    try {
      const summary = await scanRepository(root)
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
    if (
      relative === undefined
      || (!isTypeScriptScanFile(relative) && !isCSharpScanFile(relative))
    ) return
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
