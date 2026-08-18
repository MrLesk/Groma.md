import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { loadArchitectureViewModel } from '../src/core.ts'
import { displaySize, semanticView } from '../src/semantic-view.ts'
import { letterName } from '../src/viewers/tui/projection-display.ts'
import { projectWorld } from '../src/viewers/tui/projection.ts'
import {
  initialState,
  reduceViewer,
} from '../src/viewers/tui/navigation.ts'
import type { SemanticRole, SemanticView } from '../src/types.ts'
import {
  containersFixtureRoot,
  mapViewportOf,
  openclawFixtureRoot,
  projectedById,
  requiredElement,
} from './helpers.ts'

function idsOf(view: SemanticView, role: SemanticRole): string[] {
  return view.items.filter(entry => entry.role === role).map(entry => entry.id).sort()
}

function item(view: SemanticView, id: string): SemanticView['items'][number] {
  const found = view.items.find(entry => entry.id === id)
  assert.ok(found, `missing ${id}`)
  return found
}

test.concurrent('OpenClaw Context paints named systems, marks, and untitled underlay', async () => {
  const { world } = await loadArchitectureViewModel(openclawFixtureRoot)
  const context = semanticView(world, { level: 'context' })
  const projection = projectWorld(world, {
    viewport: mapViewportOf({ width: 120, height: 36 }),
    level: 'context',
    currentId: 'observed:openclaw',
  })
  const byId = projectedById(projection.elements)

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

  for (const semantic of context.items) {
    const painted = requiredElement(byId, semantic.representationId)
    assert.notEqual(painted.display, 'hidden', semantic.id)
    if (semantic.role === 'underlay') {
      assert.equal(letterName(painted, 'context'), false, semantic.id)
      assert.equal(painted.display, 'container-boundary', semantic.id)
    } else {
      assert.equal(letterName(painted, 'context'), true, semantic.id)
    }
  }
  assert.ok(projection.elements.every(element => {
    return context.items.some(entry => {
      return entry.representationId === element.representationId
    }) || element.display === 'hidden'
  }))

  const campus = requiredElement(byId, 'observed:openclaw')
  const operator = requiredElement(byId, 'observed:operator')
  assert.equal(campus.display, 'system-boundary')
  assert.equal(operator.display, 'card')
  assert.ok(
    campus.cellBounds.width * campus.cellBounds.height
      > operator.cellBounds.width * operator.cellBounds.height,
  )
  assert.ok(campus.cellBounds.width >= 'OpenClaw'.length + 2)
  assert.ok(operator.cellBounds.width >= operator.name.length + 7)
})

test.concurrent('OpenClaw wrappers keep campus size and marks follow named-level size', async () => {
  const { world } = await loadArchitectureViewModel(openclawFixtureRoot)
  const laid = world.elements.find(element => element.id === 'openclaw')
  const laidOperator = world.elements.find(element => element.id === 'operator')
  assert.ok(laid)
  assert.ok(laidOperator)
  const context = semanticView(world, { level: 'context' })
  const mark = item(context, 'operator')
  assert.deepEqual(
    { width: mark.bounds.width, height: mark.bounds.height },
    displaySize('Operator', 'system'),
  )
  const projection = projectWorld(world, {
    viewport: mapViewportOf({ width: 200, height: 60 }),
    level: 'context',
    currentId: 'observed:openclaw',
    camera: { zoom: 1, centerX: laid.bounds.x, centerY: laid.bounds.y },
    lockCamera: true,
  })
  const byId = projectedById(projection.elements)
  const campus = requiredElement(byId, 'observed:openclaw')
  const operator = requiredElement(byId, 'observed:operator')
  assert.equal(campus.cellBounds.width, laid.bounds.width)
  assert.notEqual(operator.cellBounds.width, laidOperator.bounds.width)
  assert.equal(operator.cellBounds.width, mark.bounds.width)
})

test.concurrent('entering OpenClaw keeps campus wrappers and names its containers', async () => {
  const { world } = await loadArchitectureViewModel(openclawFixtureRoot)
  let state = initialState(world)
  assert.equal(state.level, 'context')
  assert.equal(state.currentId, 'observed:openclaw')
  state = reduceViewer(world, state, 'enter')
  assert.equal(state.level, 'containers')
  assert.ok(state.currentId)

  const projection = projectWorld(world, {
    viewport: mapViewportOf({ width: 120, height: 36 }),
    level: state.level,
    currentId: state.currentId,
  })
  const byId = projectedById(projection.elements)
  const campus = requiredElement(byId, 'observed:openclaw')
  assert.equal(campus.display, 'system-boundary')
  assert.equal(letterName(campus, 'containers'), true)

  const entered = semanticView(world, {
    level: 'containers',
    focusId: 'observed:openclaw',
  })
  for (const semantic of entered.items) {
    const painted = requiredElement(byId, semantic.representationId)
    if (semantic.role === 'named') {
      assert.equal(painted.display, 'container-boundary', semantic.id)
      assert.equal(letterName(painted, 'containers'), true, semantic.id)
    }
    if (semantic.role === 'mark') {
      assert.equal(painted.display, 'card', semantic.id)
      assert.equal(letterName(painted, 'containers'), true, semantic.id)
    }
  }

  const moved = reduceViewer(world, state, 'right')
  assert.equal(moved.level, 'containers')
  assert.notEqual(moved.currentId, state.currentId)
  const selected = requiredElement(
    projectedById(projectWorld(world, {
      viewport: mapViewportOf({ width: 120, height: 36 }),
      level: moved.level,
      currentId: moved.currentId,
    }).elements),
    moved.currentId!,
  )
  assert.equal(selected.display, 'container-boundary')
  assert.equal(letterName(selected, 'containers'), true)
})

test.concurrent('Containers underlay components stay untitled and do not take routes', async () => {
  const { world } = await loadArchitectureViewModel(containersFixtureRoot)
  const projection = projectWorld(world, {
    viewport: mapViewportOf({ width: 120, height: 36 }),
    level: 'containers',
    currentId: 'observed:shop',
  })
  const byId = projectedById(projection.elements)
  const page = requiredElement(byId, 'observed:page')
  const orders = requiredElement(byId, 'observed:orders')
  const web = requiredElement(byId, 'observed:web')
  const api = requiredElement(byId, 'observed:api')
  assert.equal(page.display, 'card')
  assert.equal(orders.display, 'card')
  assert.equal(letterName(page, 'containers'), false)
  assert.equal(letterName(orders, 'containers'), false)
  assert.equal(letterName(web, 'containers'), true)
  assert.equal(letterName(api, 'containers'), true)
  const route = projection.relationships.find(relationship => {
    return relationship.source === 'observed:page'
      && relationship.target === 'observed:orders'
  })
  assert.ok(route)
  assert.equal(route.displaySource, 'observed:web')
  assert.equal(route.displayTarget, 'observed:api')
})
