export function createReloadStatus() {
  let modelError = null
  let watcherError = null

  return {
    get error() {
      return watcherError ?? modelError
    },
    recordModelFailure(message) {
      modelError = message
    },
    recordModelSuccess() {
      modelError = null
    },
    recordWatcherFailure(detail) {
      watcherError = [
        `Architecture Markdown watcher failed: ${detail}.`,
        'Restart the viewer.',
      ].join(' ')
    },
  }
}
