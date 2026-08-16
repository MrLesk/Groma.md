import { existsSync, watch } from 'node:fs'
import type { FSWatcher } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'

const SETTLE_MS = 150
const architectureRoots = ['groma/observed', 'groma/plans', 'groma/missing']

export function watchArchitecture(
  repositoryRoot: string,
  options: { onChange?: () => void | Promise<void> } = {},
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
      if (!closed) await options.onChange?.()
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

  function onEvent(directory: string, filename: string | null): void {
    if (closed || filename === null || !String(filename).endsWith('.md')) return
    void stat(path.join(directory, String(filename))).then(info => {
      if (!closed && info.mtimeMs >= startedAt) schedule()
    }, () => {
      if (!closed) schedule()
    })
  }

  const watchers: FSWatcher[] = []
  for (const relative of architectureRoots) {
    const directory = path.join(root, relative)
    if (!existsSync(directory)) continue
    watchers.push(watch(directory, { recursive: true }, (_event, filename) => {
      onEvent(directory, filename)
    }))
  }

  return {
    close() {
      if (closed) return
      closed = true
      clearTimeout(timer)
      for (const watcher of watchers) watcher.close()
    },
  }
}
