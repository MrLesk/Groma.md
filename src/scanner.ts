import { subscribe } from '@parcel/watcher'
import { once } from 'node:events'
import { watch } from 'node:fs'
import { realpath } from 'node:fs/promises'
import path from 'node:path'

import { architectureFindingsFor, formatArchitectureFindings } from './architecture-findings.ts'
import { reconcileScanObservations } from './core.ts'
import { gromaDirectories } from './groma-filesystem.ts'
import { loadScannerRegistry } from './scanner/registry.ts'
import type { ScannerRegistry } from './scanner/registry.ts'
import type { ScanSummary } from './types.ts'

const SETTLE_MS = 150
const skippedRoots = new Set(['.git', ...gromaDirectories, 'node_modules'])

export function formatScanSummary(summary: ScanSummary): string {
  const counts = `created ${summary.created}, refreshed ${summary.refreshed}, matched ${summary.matched}`
  const findings = summary.findings ? `, findings ${summary.findings}` : ''
  const conflicts = summary.evidenceConflicts?.length ? `, evidence conflicts ${summary.evidenceConflicts.length}` : ''
  return `${counts}${findings}${conflicts}`
}

export function formatScanReport(repositoryRoot: string, summary: ScanSummary): string {
  const findings = formatArchitectureFindings(architectureFindingsFor(repositoryRoot))
  const conflicts = summary.evidenceConflicts?.map(conflict => `${conflict.code}: ${conflict.message}`) ?? []
  return [formatScanSummary(summary), ...conflicts, ...findings].join('\n')
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

async function subscribeSources(root: string, listener: (error: Error | null, files: string[]) => void) {
  if (process.platform !== 'win32') {
    return subscribe(root, (error, events) => {
      listener(error, events.map(event => path.relative(root, event.path).split(path.sep).join('/')))
    }, { ignore: [...skippedRoots] })
  }

  // Bun's Windows fs.watch registers ReadDirectoryChangesW before returning.
  // Parcel can return before its queued registration runs, losing the first edit.
  const watcher = watch(root, { recursive: true }, (_event, filename) => {
    if (filename === null) return
    const file = filename.split(path.sep).join('/')
    if (!skippedRoots.has(file.split('/')[0]!)) listener(null, [file])
  })
  watcher.on('error', error => listener(error, []))
  return {
    async unsubscribe() {
      const closed = once(watcher, 'close')
      watcher.close()
      await closed
    },
  }
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

  const watcher = await subscribeSources(root, (error, files) => {
    if (error) {
      options.onError?.(error)
      return
    }
    if (files.some(file => registry.matchesFile(file))) {
      schedule()
    }
  })

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
