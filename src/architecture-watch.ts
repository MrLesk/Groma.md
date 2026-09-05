import { GromaFileSystem } from './groma-filesystem.ts'

const SETTLE_MS = 150

export async function watchArchitecture(
  repositoryRoot: string,
  options: { onChange?: () => void | Promise<void> } = {},
): Promise<{ close(): Promise<void> }> {
  const filesystem = GromaFileSystem.open(repositoryRoot)
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false
  let pending = false
  let closed = false
  let active = Promise.resolve()

  function launch(): void {
    active = run()
    void active.catch(() => {})
  }

  async function run(): Promise<void> {
    if (closed) return
    running = true
    try {
      if (!closed) await options.onChange?.()
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

  const watcher = await filesystem.watch(filename => {
    if (!closed && filename.endsWith('.md')) schedule()
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
