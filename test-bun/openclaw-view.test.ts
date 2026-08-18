import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { loadArchitectureViewModel } from '../src/core.ts'
import {
  itemBounds,
  layoutSemanticView,
  originOf,
  preserveSemanticAnchors,
} from '../src/semantic-layout.ts'
import { semanticView } from '../src/semantic-view.ts'
import { openclawFixtureRoot } from './helpers.ts'

test.concurrent('openclaw-view loads as a Groma 3 world without scanner leftovers', async () => {
  const { world } = await loadArchitectureViewModel(openclawFixtureRoot)
  const names = world.elements.map(element => element.name).sort()
  assert.deepEqual(names, [
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

test.concurrent('openclaw-view Context collapses OpenClaw and pin keeps neighbors', async () => {
  const { world } = await loadArchitectureViewModel(openclawFixtureRoot)
  const laid = world.elements.find(element => element.id === 'openclaw')
  assert.ok(laid)
  const context = await layoutSemanticView(semanticView(world, { level: 'context' }), world)
  const openclaw = itemBounds(context, 'openclaw')
  assert.ok(openclaw)
  assert.equal(openclaw.height, 40)
  assert.ok(openclaw.height < laid.bounds.height)
  const entered = await preserveSemanticAnchors(
    context,
    semanticView(world, { level: 'containers', focusId: laid.representationId }),
    world,
  )
  for (const id of ['openclaw', 'operator', 'whatsapp', 'telegram', 'anthropic']) {
    assert.deepEqual(originOf(entered, id), originOf(context, id), id)
  }
})
