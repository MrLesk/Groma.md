import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadArchitectureViewModel } from '../src/core.ts'
import type {
  AnnotatedElement,
  ArchitectureViewModel,
} from '../src/types.ts'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const fixtureRoot = path.join(repositoryRoot, 'test', 'fixtures', 'core-view')

function elementByRepresentation(
  model: ArchitectureViewModel,
  representationId: string,
): AnnotatedElement {
  const element = model.elements.find(element => {
    return element.representationId === representationId
  })
  assert.ok(element)
  return element
}

test('returns every independently annotated architecture representation', async () => {
  const model = await loadArchitectureViewModel(fixtureRoot)

  assert.deepEqual(model.plans, ['checkout', 'inventory'])
  assert.equal(model.elements.length, 9)
  assert.deepEqual(
    model.elements.map(element => element.representationId),
    [
      'observed:api',
      'observed:orders',
      'observed:payments',
      'observed:shop',
      'missing:legacy',
      'planned:checkout:orders',
      'planned:inventory:api',
      'planned:inventory:inventory',
      'planned:inventory:orders',
    ],
  )

  assert.deepEqual(elementByRepresentation(model, 'observed:shop'), {
    representationId: 'observed:shop',
    id: 'shop',
    kind: 'system',
    name: 'Shop',
    description: 'Lets customers place orders.',
    parent: null,
    children: ['observed:api', 'planned:inventory:api'],
    external: false,
    code: [],
    codeLines: 0,
    origin: 'observed',
  })
  assert.deepEqual(elementByRepresentation(model, 'observed:orders').code, [
    {
      scanner: 'typescript',
      file: 'src/orders.ts',
      symbol: 'placeOrder',
      lines: 0,
    },
    {
      scanner: 'routes',
      file: 'src/routes/orders.ts',
      lines: 0,
    },
  ])
  assert.deepEqual(
    elementByRepresentation(model, 'observed:api').children,
    [
      'missing:legacy',
      'observed:orders',
      'planned:checkout:orders',
    ],
  )
  assert.deepEqual(elementByRepresentation(model, 'missing:legacy'), {
    representationId: 'missing:legacy',
    id: 'legacy',
    kind: 'component',
    name: 'Legacy ordering',
    description: 'Retains the last known legacy ordering responsibility.',
    parent: 'observed:api',
    children: [],
    external: false,
    code: [{ scanner: 'typescript', file: 'src/legacy.ts', lines: 0 }],
    codeLines: 0,
    origin: 'missing',
  })
  assert.deepEqual(elementByRepresentation(model, 'planned:checkout:orders'), {
    representationId: 'planned:checkout:orders',
    id: 'orders',
    kind: 'component',
    name: 'Checkout orders',
    description: 'Places an order through a guided checkout.',
    parent: 'observed:api',
    children: [],
    external: false,
    code: [{
      scanner: 'typescript',
      file: 'src/checkout-orders.ts',
      symbol: 'checkout',
      lines: 0,
    }],
    codeLines: 0,
    origin: 'planned',
    plan: 'checkout',
  })
  assert.deepEqual(elementByRepresentation(model, 'planned:inventory:api'), {
    representationId: 'planned:inventory:api',
    id: 'api',
    kind: 'container',
    name: 'Inventory-aware API',
    description: 'Coordinates ordering and inventory operations.',
    parent: 'observed:shop',
    children: [
      'planned:inventory:inventory',
      'planned:inventory:orders',
    ],
    external: false,
    code: [],
    codeLines: 0,
    origin: 'planned',
    plan: 'inventory',
  })

  const plannedOrders = model.elements.filter(element => element.id === 'orders')
  assert.deepEqual(
    plannedOrders.map(element => ({
      representationId: element.representationId,
      name: element.name,
      origin: element.origin,
      plan: element.plan,
    })),
    [
      {
        representationId: 'observed:orders',
        name: 'Orders',
        origin: 'observed',
        plan: undefined,
      },
      {
        representationId: 'planned:checkout:orders',
        name: 'Checkout orders',
        origin: 'planned',
        plan: 'checkout',
      },
      {
        representationId: 'planned:inventory:orders',
        name: 'Inventory-aware orders',
        origin: 'planned',
        plan: 'inventory',
      },
    ],
  )
  assert.ok(model.elements.every(element => {
    return ['observed', 'planned', 'missing'].includes(element.origin)
      && !Object.hasOwn(element, 'annotations')
  }))

  assert.deepEqual(model.relationships, [
    {
      id: 'relationship:0',
      source: 'observed:orders',
      target: 'observed:payments',
      description: 'Requests payment authorization',
      technology: 'HTTPS',
      origin: 'observed',
    },
    {
      id: 'relationship:1',
      source: 'missing:legacy',
      target: 'observed:orders',
      description: 'Delegates current orders',
      technology: 'Function call',
      origin: 'missing',
    },
    {
      id: 'relationship:2',
      source: 'planned:checkout:orders',
      target: 'observed:payments',
      description: 'Authorizes checkout payment',
      technology: 'HTTPS',
      origin: 'planned',
      plan: 'checkout',
    },
    {
      id: 'relationship:3',
      source: 'planned:inventory:inventory',
      target: 'planned:inventory:orders',
      description: 'Reports reserved stock',
      technology: 'Function call',
      origin: 'planned',
      plan: 'inventory',
    },
    {
      id: 'relationship:4',
      source: 'planned:inventory:orders',
      target: 'observed:payments',
      description: 'Authorizes reserved orders',
      technology: 'HTTPS',
      origin: 'planned',
      plan: 'inventory',
    },
  ])
  assert.doesNotThrow(() => JSON.stringify(model))
})
