import assert from 'node:assert/strict'
import test from 'node:test'

import { createReloadStatus } from '../src/viewer/reload-status.mjs'

test('clears a transient model failure after a successful model reload', () => {
  const status = createReloadStatus()

  status.recordModelFailure('Invalid architecture Markdown')
  status.recordModelSuccess()

  assert.equal(status.error, null)
})
