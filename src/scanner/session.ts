import { reconcileScanObservations } from '../core.ts'
import { loadScannerRegistry, type ScanBatch, type ScanEvent } from './registry.ts'
import { watchObservations } from './source-watch.ts'
import { readScannerConfig } from './modules/config.ts'
import type { ProjectReadiness } from './modules/readiness.ts'
import { changeScannerSettings, readScannerSettings, type ScannerSettings, type ScannerSettingsAction } from './modules/settings.ts'
import type { ScannerInstallOptions } from './modules/inventory.ts'

export type ScannerProgress =
  | { phase: 'preparing-scanners' | 'updating-architecture' }
  | { phase: 'scanning'; scanners: readonly string[] }

/** Owns scanner execution, settings state and the one source-adapter subscription for an open viewer. */
export async function createScannerSession(root: string, options: {
  scan?: boolean
  onProgress?: (progress: ScannerProgress) => void
  onSettings?: (settings: ScannerSettings) => void
  onFold?: () => void | Promise<void>
  watchesFile?: (file: string) => boolean
} & ScannerInstallOptions = {}) {
  options.onProgress?.({ phase: 'preparing-scanners' })
  let state = await readScannerSettings(root, [], options)
  let checks: ProjectReadiness[] = []
  let watcher: Awaited<ReturnType<typeof watchObservations>> | undefined
  let config = ''
  let closed = false
  let serial = Promise.resolve()
  const listeners = new Set<(state: ScannerSettings) => void>()
  const activeScanners = new Set<string>()

  function scanProgress(event: ScanEvent) {
    if (event.type === 'start') activeScanners.add(event.scanner)
    else activeScanners.delete(event.scanner)
    options.onProgress?.(activeScanners.size
      ? { phase: 'scanning', scanners: [...activeScanners] } : { phase: 'preparing-scanners' })
  }
  function publish(next: ScannerSettings) {
    if (closed) return
    state = next
    options.onSettings?.(state)
    for (const listener of listeners) listener(state)
  }
  async function report(error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const next = await readScannerSettings(root, checks, options)
    publish({ ...next, notice: { tone: 'error', message } })
  }
  async function fold({ observations, failures }: ScanBatch, files: string[]) {
    if (observations.length) options.onProgress?.({ phase: 'updating-architecture' })
    await reconcileScanObservations(root, observations)
    checks = [
      ...observations.map((observation): ProjectReadiness => ({ id: observation.scanner.id, package: 'found', project: 'ready', message: 'Scan completed.' })),
      ...failures.map((failure): ProjectReadiness => ({ id: failure.scanner, package: 'found', project: 'blocked', message: failure.message })),
    ]
    publish(await readScannerSettings(root, checks, options))
    if (observations.length || files.some(file => options.watchesFile?.(file))) await options.onFold?.()
  }
  async function start(scan: boolean) {
    await watcher?.close()
    watcher = undefined
    if (closed) return
    config = JSON.stringify(await readScannerConfig(root))
    checks = []
    publish(await readScannerSettings(root, checks, options))
    const registry = await loadScannerRegistry(root, options)
    if (closed) return
    // With no selected scanner, only declaration matching runs; no scan evidence is written.
    watcher = await watchObservations(root, registry, {
      scan, onScan: scanProgress, onObservations: fold, onError: report, watchesFile: options.watchesFile,
    })
  }
  function enqueue(action: () => Promise<void>, propagate = false): Promise<void> {
    const next = serial.then(async () => { if (!closed) await action() }).catch(async error => {
      await report(error)
      if (propagate) throw error
    })
    serial = next.catch(() => {})
    return next
  }
  const ready = enqueue(() => start(options.scan !== false))

  return {
    /** Resolves after the initial scan, including its architecture update and failure reporting. */
    ready,
    get state() { return state },
    subscribe(listener: (state: ScannerSettings) => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    async refresh() { publish(await readScannerSettings(root, checks, options)); return state },
    reconfigure() {
      return enqueue(async () => {
        if (JSON.stringify(await readScannerConfig(root)) !== config) await start(true)
      })
    },
    change(action: ScannerSettingsAction) {
      return enqueue(async () => {
        // Stop in-flight evidence before a new selection can own source updates.
        await watcher?.close()
        watcher = undefined
        try { await changeScannerSettings(root, action, options) }
        catch (error) { await start(true); throw error }
        await start(true)
      }, true)
    },
    async close() {
      closed = true
      await serial
      await watcher?.close()
    },
  }
}
export type ScannerSession = Awaited<ReturnType<typeof createScannerSession>>
