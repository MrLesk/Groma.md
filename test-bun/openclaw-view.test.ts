import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { loadArchitectureViewModel } from '../src/core.ts'
import { openclawFixtureRoot } from './helpers.ts'

test.concurrent('openclaw-view loads as a Groma 3 world without scanner leftovers', async () => {
  const { world } = await loadArchitectureViewModel(openclawFixtureRoot)
  const titles = world.elements.map(element => element.title).sort()
  assert.deepEqual(titles, [
    'Agent Runtime',
    'Anthropic',
    'CLI',
    'Channels',
    'Control UI',
    'Gateway',
    'Node',
    'OpenClaw',
    'Operator',
    'Telegram',
    'WhatsApp',
  ])
  assert.equal(world.elements.filter(element => element.kind === 'component').length, 0)
  assert.ok(world.elements.every(element => !element.id.startsWith('ent_')))
  assert.ok(world.relationships.length > 0)
})
