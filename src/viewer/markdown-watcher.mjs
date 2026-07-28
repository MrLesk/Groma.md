import { createHash } from 'node:crypto'
import { watch } from 'node:fs'
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'

const watchedDirectories = ['groma/observed', 'groma/plans']

function recordFilesystemAccess(
  onFilesystemAccess,
  operation,
  filename,
) {
  onFilesystemAccess?.({ operation, filename })
}

async function addMarkdownToFingerprint(
  hash,
  directory,
  repositoryRoot,
  onFilesystemAccess,
) {
  recordFilesystemAccess(onFilesystemAccess, 'read-directory', directory)
  const entries = await readdir(directory, { withFileTypes: true })
  entries.sort((left, right) => left.name.localeCompare(right.name))

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      await addMarkdownToFingerprint(
        hash,
        entryPath,
        repositoryRoot,
        onFilesystemAccess,
      )
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      hash.update(path.relative(repositoryRoot, entryPath))
      hash.update('\0')
      recordFilesystemAccess(onFilesystemAccess, 'read-file', entryPath)
      hash.update(await readFile(entryPath))
      hash.update('\0')
    }
  }
}

async function markdownFingerprint(
  repositoryRoot,
  watchRoots,
  onFilesystemAccess,
) {
  const hash = createHash('sha256')
  for (const watchRoot of watchRoots) {
    await addMarkdownToFingerprint(
      hash,
      watchRoot,
      repositoryRoot,
      onFilesystemAccess,
    )
  }
  return hash.digest('hex')
}

async function directoryContainsMarkdown(directory, onFilesystemAccess) {
  recordFilesystemAccess(onFilesystemAccess, 'read-directory', directory)
  const entries = await readdir(directory, { withFileTypes: true })
  return entries.some(entry => {
    return entry.isFile() && entry.name.endsWith('.md')
  })
}

export async function startMarkdownWatcher(repositoryRoot, options) {
  const {
    fingerprintMarkdown = markdownFingerprint,
    onFilesystemAccess,
    onError,
    onMarkdownChange,
    watchFileSystem = watch,
  } = options
  const watchRoots = watchedDirectories.map(relativeDirectory => {
    return path.join(repositoryRoot, relativeDirectory)
  })
  let fingerprint = await fingerprintMarkdown(
    repositoryRoot,
    watchRoots,
    onFilesystemAccess,
  )
  let eventSequence = 0
  let closed = false
  let fingerprintQueue = Promise.resolve()
  const handles = []
  const pendingInspections = new Set()

  function waitForDirectorySettlement() {
    return new Promise(resolve => {
      const pending = {
        resolve,
        timer: setTimeout(() => {
          pendingInspections.delete(pending)
          resolve(true)
        }, 120),
      }
      pendingInspections.add(pending)
    })
  }

  function refreshFingerprint() {
    fingerprintQueue = fingerprintQueue.then(async () => {
      if (closed) return

      const nextFingerprint = await fingerprintMarkdown(
        repositoryRoot,
        watchRoots,
        onFilesystemAccess,
      )
      if (closed || nextFingerprint === fingerprint) return

      fingerprint = nextFingerprint
      await onMarkdownChange()
    }).catch(error => {
      if (!closed) onError(error)
    })
    return fingerprintQueue
  }

  async function inspectPossibleDirectory(
    watchRoot,
    filename,
    expectedSequence,
  ) {
    const settled = await waitForDirectorySettlement()
    if (!settled || closed || expectedSequence !== eventSequence) return

    const changedPath = path.join(watchRoot, filename)
    try {
      recordFilesystemAccess(onFilesystemAccess, 'stat', changedPath)
      if (
        (await stat(changedPath)).isDirectory()
        && await directoryContainsMarkdown(
          changedPath,
          onFilesystemAccess,
        )
      ) {
        await refreshFingerprint()
      }
    } catch (error) {
      if (error.code !== 'ENOENT' && !closed) onError(error)
    }
  }

  for (const watchRoot of watchRoots) {
    recordFilesystemAccess(onFilesystemAccess, 'watch', watchRoot)
    const handle = watchFileSystem(
      watchRoot,
      { recursive: true },
      async (eventType, filename) => {
        if (closed) return
        if (typeof filename !== 'string') {
          await refreshFingerprint()
        } else if (filename.endsWith('.md')) {
          eventSequence += 1
          await refreshFingerprint()
        } else if (eventType === 'rename') {
          await inspectPossibleDirectory(
            watchRoot,
            filename,
            eventSequence,
          )
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
      for (const handle of handles) {
        handle.close()
      }
      for (const pending of pendingInspections) {
        clearTimeout(pending.timer)
        pending.resolve(false)
      }
      pendingInspections.clear()
      await fingerprintQueue
    },
  }
}
