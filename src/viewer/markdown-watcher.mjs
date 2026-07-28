import { watch } from 'node:fs'
import path from 'node:path'

const watchedDirectories = ['groma/observed', 'groma/plans']

export async function startMarkdownWatcher(repositoryRoot, options) {
  const {
    onFilesystemAccess,
    onError,
    onMarkdownChange,
    watchFileSystem = watch,
  } = options
  const handles = []
  let closed = false

  for (const relativeDirectory of watchedDirectories) {
    const watchRoot = path.join(repositoryRoot, relativeDirectory)
    onFilesystemAccess?.({ operation: 'watch', filename: watchRoot })
    const handle = watchFileSystem(
      watchRoot,
      { recursive: true },
      async (_eventType, filename) => {
        if (
          !closed
          && typeof filename === 'string'
          && filename.endsWith('.md')
        ) {
          await onMarkdownChange()
        }
      },
    )
    handle.on('error', error => {
      if (!closed) onError(error)
    })
    handles.push(handle)
  }

  return {
    async close() {
      if (closed) return
      closed = true
      for (const handle of handles) handle.close()
    },
  }
}
