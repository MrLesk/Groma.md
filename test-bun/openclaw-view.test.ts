import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { loadArchitectureViewModel } from '../src/core.ts'
import { displaySize, semanticView } from '../src/semantic-view.ts'
import type { SemanticRole, SemanticView } from '../src/types.ts'
import { openclawFixtureRoot } from './helpers.ts'

function item(view: SemanticView, id: string): SemanticView['items'][number] {
  const found = view.items.find(entry => entry.id === id)
  assert.ok(found, `missing ${id}`)
  return found
}

function idsOf(view: SemanticView, role: SemanticRole): string[] {
  return view.items.filter(entry => entry.role === role).map(entry => entry.id).sort()
}

function originOf(view: SemanticView, id: string): { x: number; y: number } {
  const found = item(view, id)
  return { x: found.bounds.x, y: found.bounds.y }
}

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

test.concurrent('openclaw-view Context is a campus of named system, underlay, and marks', async () => {
  const { world } = await loadArchitectureViewModel(openclawFixtureRoot)
  const laid = world.elements.find(element => element.id === 'openclaw')
  assert.ok(laid)
  const context = semanticView(world, { level: 'context' })
  const openclaw = item(context, 'openclaw')
  assert.equal(openclaw.role, 'named')
  assert.deepEqual(openclaw.bounds, laid.bounds)
  assert.ok(openclaw.bounds.height > displaySize('OpenClaw', 'system').height)
  assert.deepEqual(idsOf(context, 'named'), ['openclaw'])
  assert.deepEqual(idsOf(context, 'underlay'), [
    'agent-runtime',
    'channels',
    'cli',
    'control-ui',
    'gateway',
    'node',
  ])
  assert.deepEqual(idsOf(context, 'mark'), ['anthropic', 'operator', 'telegram', 'whatsapp'])
  for (const id of idsOf(context, 'underlay')) {
    const wrapper = world.elements.find(element => element.id === id)
    assert.ok(wrapper)
    assert.deepEqual(item(context, id).bounds, wrapper.bounds)
  }
  const operator = item(context, 'operator')
  const laidOperator = world.elements.find(element => element.id === 'operator')
  assert.ok(laidOperator)
  assert.equal(operator.bounds.x, laidOperator.bounds.x)
  assert.equal(operator.bounds.y, laidOperator.bounds.y)
  assert.deepEqual(
    { width: operator.bounds.width, height: operator.bounds.height },
    displaySize('Operator', 'system'),
  )
})

test.concurrent('entering OpenClaw keeps the campus origins still', async () => {
  const { world } = await loadArchitectureViewModel(openclawFixtureRoot)
  const laid = world.elements.find(element => element.id === 'openclaw')
  assert.ok(laid)
  const context = semanticView(world, { level: 'context' })
  const entered = semanticView(world, { level: 'containers', focusId: laid.representationId })
  assert.equal(item(entered, 'openclaw').role, 'campus')
  assert.deepEqual(item(entered, 'openclaw').bounds, laid.bounds)
  assert.deepEqual(idsOf(entered, 'named'), [
    'agent-runtime',
    'channels',
    'cli',
    'control-ui',
    'gateway',
    'node',
  ])
  assert.deepEqual(idsOf(entered, 'underlay'), [])
  assert.deepEqual(idsOf(entered, 'mark'), ['anthropic', 'operator', 'telegram', 'whatsapp'])
  for (const id of ['openclaw', 'operator', 'whatsapp', 'telegram', 'anthropic']) {
    assert.deepEqual(originOf(entered, id), originOf(context, id), id)
  }
  const operator = item(entered, 'operator')
  assert.deepEqual(
    { width: operator.bounds.width, height: operator.bounds.height },
    displaySize('Operator', 'container'),
  )
})
