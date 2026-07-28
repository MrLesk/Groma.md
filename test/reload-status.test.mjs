import assert from 'node:assert/strict'
import test from 'node:test'

import { createReloadStatus } from '../src/viewer/reload-status.mjs'

test('keeps a terminal watcher failure after a successful model reload', () => {
  const status = createReloadStatus()
  const watcherFailure = [
    'Architecture Markdown watcher failed: watch handle failed.',
    'Restart the viewer.',
  ].join(' ')

  status.recordWatcherFailure('watch handle failed')
  status.recordModelSuccess()

  assert.equal(status.error, watcherFailure)
})

test('clears a transient model failure after a successful model reload', () => {
  const status = createReloadStatus()

  status.recordModelFailure('Invalid architecture Markdown')
  status.recordModelSuccess()

  assert.equal(status.error, null)
})
