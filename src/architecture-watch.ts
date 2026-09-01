import path from 'node:path'

import { GromaFileSystem } from './groma-filesystem.ts'

const SETTLE_MS = 150
const architectureRoots = ['observed', 'plans', 'missing']

export function watchArchitecture(
  repositoryRoot: string,
  options: { onChange?: () => void | Promise<void> } = {},
): { close(): void } {
  const filesystem = GromaFileSystem.open(repositoryRoot)
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
    void filesystem.modifiedAt(path.posix.join(directory, filename)).then(mtimeMs => {
      if (!closed && mtimeMs >= startedAt) schedule()
    }, () => {
      if (!closed) schedule()
    })
  }

  const watchers: { close(): void }[] = []
  for (const relative of architectureRoots) {
    if (!filesystem.exists(relative)) continue
    watchers.push(filesystem.watch(relative, { recursive: true }, filename => {
      onEvent(relative, filename)
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
