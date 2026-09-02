import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { loadArchitectureViewModel } from '../src/core.ts'
import { openclawFixtureRoot } from './helpers.ts'

test.concurrent('openclaw-view loads as a Groma 3 world without scanner leftovers', async () => {
  const { world } = await loadArchitectureViewModel(openclawFixtureRoot)
  assert.equal(world.elements.filter(element => element.kind === 'component').length, 0)
  assert.ok(world.elements.every(element => !element.id.startsWith('ent_')))
  assert.ok(world.relationships.length > 0)
})
