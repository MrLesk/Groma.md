import assert from 'node:assert/strict'
import test from 'node:test'

import { layoutArchitectureWorld } from '../src/world-layout.ts'
import type {
  AnnotatedArchitectureModel,
  Bounds,
  Point,
  WorldElement,
} from '../src/types.ts'

const elements: AnnotatedArchitectureModel['elements'] = [
  {
    representationId: 'observed:architect', id: 'architect', kind: 'actor',
    title: 'Architect', overview: 'Reviews the design.', parent: null,
    children: [], external: false, code: [], origin: 'observed',
  },
  {
    representationId: 'observed:shop', id: 'shop', kind: 'system',
    title: 'Shop', overview: 'Sells products.', parent: null,
    children: ['observed:api', 'observed:worker'], external: false, code: [],
    origin: 'observed', group: 'Platform',
  },
  {
    representationId: 'observed:api', id: 'api', kind: 'container',
    title: 'API', overview: 'Serves requests.', parent: 'observed:shop',
    children: ['planned:checkout'], external: false, code: [], origin: 'observed',
    group: 'Runtime',
  },
  {
    representationId: 'planned:checkout', id: 'checkout', kind: 'component',
    title: 'Checkout', overview: 'Places orders.', parent: 'observed:api',
    children: [], external: false, code: [], origin: 'planned', plan: 'checkout',
  },
  {
    representationId: 'observed:worker', id: 'worker', kind: 'container',
    title: 'Worker', overview: 'Runs jobs.', parent: 'observed:shop',
    children: ['missing:fulfilment'], external: false, code: [], origin: 'observed',
    group: 'Runtime',
  },
  {
    representationId: 'missing:fulfilment', id: 'fulfilment', kind: 'component',
    title: 'Fulfilment', overview: 'Ships orders.', parent: 'observed:worker',
    children: [], external: false, code: [], origin: 'missing',
  },
  {
    representationId: 'observed:payments', id: 'payments', kind: 'system',
    title: 'Payments', overview: 'Authorizes payments.', parent: null,
    children: [], external: true, code: [], origin: 'observed',
    group: 'Platform',
  },
]

const relationships: AnnotatedArchitectureModel['relationships'] = [
  {
    id: 'relationship:0',
    source: 'observed:architect', target: 'planned:checkout',
    description: 'Reviews checkout', technology: 'Terminal', origin: 'observed',
  },
  {
    id: 'relationship:1',
    source: 'planned:checkout', target: 'missing:fulfilment',
    description: 'Starts fulfilment', technology: 'Queue', origin: 'planned',
    plan: 'checkout',
  },
  {
    id: 'relationship:2',
    source: 'missing:fulfilment', target: 'observed:payments',
    description: 'Confirms payment', technology: 'HTTPS', origin: 'missing',
  },
]

const model: AnnotatedArchitectureModel = { plans: ['checkout'], elements, relationships }

function contains(outer: Bounds, inner: Bounds): boolean {
  return inner.x >= outer.x
    && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height
}

function overlaps(left: Bounds, right: Bounds): boolean {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y
}

function onBoundary(point: Point | undefined, bounds: Bounds): boolean {
  assert.ok(point)
  const tolerance = 1e-6
  const withinX = point.x >= bounds.x - tolerance
    && point.x <= bounds.x + bounds.width + tolerance
  const withinY = point.y >= bounds.y - tolerance
    && point.y <= bounds.y + bounds.height + tolerance
  const onX = Math.abs(point.x - bounds.x) < tolerance
    || Math.abs(point.x - bounds.x - bounds.width) < tolerance
  const onY = Math.abs(point.y - bounds.y) < tolerance
    || Math.abs(point.y - bounds.y - bounds.height) < tolerance
  return (onX && withinY) || (onY && withinX)
}

test('lays out one deterministic nested world without mutating the model', async () => {
  const before = structuredClone(model)
  const first = await layoutArchitectureWorld(model)
  const second = await layoutArchitectureWorld(model)

  assert.deepEqual(model, before)
  assert.deepEqual(second, first)
  assert.ok(first.bounds.width > 0)
  assert.ok(first.bounds.height > 0)

  const byId = new Map<string, WorldElement>(first.elements.map(element => [
    element.representationId,
    element,
  ]))
  for (const element of first.elements) {
    if (element.parent !== null) {
      const parent = requiredElement(byId, element.parent)
      assert.ok(
        contains(parent.bounds, element.bounds),
        `${element.representationId} must stay inside ${element.parent}`,
      )
      assert.ok(
        element.bounds.x >= parent.bounds.x + 8
          && element.bounds.y >= parent.bounds.y + 8
          && element.bounds.x + element.bounds.width <= parent.bounds.x + parent.bounds.width - 8
          && element.bounds.y + element.bounds.height <= parent.bounds.y + parent.bounds.height - 8,
        `${element.representationId} must sit inset from ${element.parent}`,
      )
    }
  }

  for (let leftIndex = 0; leftIndex < first.elements.length; leftIndex += 1) {
    const left = first.elements[leftIndex]
    for (let rightIndex = leftIndex + 1; rightIndex < first.elements.length; rightIndex += 1) {
      const right = first.elements[rightIndex]
      const nested = left.parent === right.representationId
        || right.parent === left.representationId
        || contains(left.bounds, right.bounds)
        || contains(right.bounds, left.bounds)
      if (!nested) {
        assert.equal(
          overlaps(left.bounds, right.bounds),
          false,
          `${left.representationId} must not overlap ${right.representationId}`,
        )
      }
    }
  }
})

test('routes every relationship from source boundary to target boundary', async () => {
  const world = await layoutArchitectureWorld(model)
  const byId = new Map<string, WorldElement>(world.elements.map(element => [
    element.representationId,
    element,
  ]))

  assert.equal(world.relationships.length, relationships.length)
  for (const relationship of world.relationships) {
    assert.ok(relationship.route.length >= 2)
    assert.ok(onBoundary(
      relationship.route[0],
      requiredElement(byId, relationship.source).bounds,
    ))
    assert.ok(onBoundary(
      relationship.route.at(-1),
      requiredElement(byId, relationship.target).bounds,
    ))
    assert.ok(relationship.label)
    assert.ok(relationship.label.width > 0)
  }
})

function requiredElement(elementsById: Map<string, WorldElement>, id: string): WorldElement {
  const element = elementsById.get(id)
  assert.ok(element)
  return element
}

test('clusters grouped siblings inside labeled group bounds', async () => {
  const world = await layoutArchitectureWorld(model)
  const byId = new Map<string, WorldElement>(world.elements.map(element => [
    element.representationId,
    element,
  ]))
  const platform = world.groups.find(group => group.name === 'Platform')
  const runtime = world.groups.find(group => group.name === 'Runtime')

  assert.equal(world.groups.length, 2)
  assert.ok(platform)
  assert.equal(platform.parent, null)
  assert.ok(runtime)
  assert.equal(runtime.parent, 'observed:shop')

  assert.ok(contains(platform.bounds, requiredElement(byId, 'observed:shop').bounds))
  assert.ok(contains(platform.bounds, requiredElement(byId, 'observed:payments').bounds))
  assert.equal(
    overlaps(platform.bounds, requiredElement(byId, 'observed:architect').bounds),
    false,
  )

  assert.ok(contains(requiredElement(byId, 'observed:shop').bounds, runtime.bounds))
  assert.ok(contains(runtime.bounds, requiredElement(byId, 'observed:api').bounds))
  assert.ok(contains(runtime.bounds, requiredElement(byId, 'observed:worker').bounds))
})
