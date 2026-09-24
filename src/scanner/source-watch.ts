import { subscribe } from '@parcel/watcher'
import { once } from 'node:events'
import { watch } from 'node:fs'
import { realpath } from 'node:fs/promises'
import path from 'node:path'

import { gromaDirectories } from '../groma-filesystem.ts'
import type { ScannerRegistry, ScanBatch, ScanEvent } from './registry.ts'

const SETTLE_MS = 150

/** Top-level folders no scan reads: Git's and Groma's own, and node_modules while Git's ignore rules apply. */
function skippedRoots(useGitignore: boolean): Set<string> {
  return new Set(['.git', ...gromaDirectories, ...(useGitignore ? ['node_modules'] : [])])
}

async function subscribeSources(root: string, skipped: Set<string>, listener: (error: Error | null, files: string[]) => void) {
  if (process.platform !== 'win32') {
    return subscribe(root, (error, events) => {
      listener(error, events.map(event => path.relative(root, event.path).split(path.sep).join('/')))
    }, { ignore: [...skipped] })
  }

  // Bun's Windows fs.watch registers ReadDirectoryChangesW before returning.
  // Parcel can return before its queued registration runs, losing the first edit.
  const watcher = watch(root, { recursive: true }, (_event, filename) => {
    if (filename === null) return
    const file = filename.split(path.sep).join('/')
    if (!skipped.has(file.split('/')[0]!)) listener(null, [file])
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

/** Owns source watching and emits evidence; architecture storage belongs to the caller. */
export async function watchObservations(
  repositoryRoot: string,
  registry: ScannerRegistry,
  options: {
    scan?: boolean
    onScan?: (event: ScanEvent) => void
    watchesFile?: (file: string) => boolean
    onObservations: (batch: ScanBatch, files: string[]) => void | Promise<void>
    onError?: (error: unknown) => void | Promise<void>
  },
): Promise<{ close(): Promise<void> }> {
  const root = await realpath(repositoryRoot)
  const changed = new Set<string>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false
  let closed = false
  let active = Promise.resolve()

  function launch(): void {
    active = run()
  }

  async function run(): Promise<void> {
    if (closed) return
    running = true
    const files = [...changed]
    changed.clear()
    try {
      const observations = await registry.collectObservations(root, files, options.onScan)
      if (!closed) await options.onObservations(observations, files)
    } catch (error) {
      if (!closed) await options.onError?.(error)
    } finally {
      running = false
      if (changed.size && !closed && timer === undefined) launch()
    }
  }

  function schedule(): void {
    clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      if (!running && !closed) launch()
    }, SETTLE_MS)
  }

  const watcher = await subscribeSources(root, skippedRoots(registry.useGitignore), (error, files) => {
    if (closed) return
    if (error) {
      options.onError?.(error)
      return
    }
    const relevant = files.filter(file => file !== '' && (registry.watchesFile(file) || options.watchesFile?.(file)))
    if (!relevant.length) return
    for (const file of relevant) changed.add(file)
    schedule()
  })

  // Subscribe before the first scan so edits during startup enter the same queue.
  if (options.scan) {
    launch()
    await active
  }

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
