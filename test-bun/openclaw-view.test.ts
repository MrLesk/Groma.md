import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { loadAnnotatedArchitecture } from '../src/core.ts'
import { openclawFixtureRoot } from './helpers.ts'

test.concurrent('openclaw-view loads as a Groma 3 world without scanner leftovers', async () => {
  const model = await loadAnnotatedArchitecture(openclawFixtureRoot)
  assert.equal(model.elements.filter(element => element.kind === 'component').length, 0)
  assert.ok(model.elements.every(element => !element.id.startsWith('ent_')))
  assert.ok(model.relationships.length > 0)
})
