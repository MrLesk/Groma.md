import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadAnnotatedArchitecture } from '../src/core.ts'
import { formatPlainWorld, renderPlainWorld } from '../src/plain-world.ts'
import type { AnnotatedElement, AnnotatedRelationship } from '../src/types.ts'

const fixtureRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'plain-view',
)

const approvedWorld = `buyer  person  Buyer
  Pays for goods.
  ->  uses  shop
shop  system  Shop
  The store the buyer uses.
  api  container  Api
    HTTP API.
    orders  component  Orders  src/orders.ts
      Owns the order lifecycle.
      ->  talks to  stock
    stock  component  Stock  planned:next
      Checks stock before placing an order.
  web  container  Web
    Storefront.
git  system  Git  external
  Versions the Markdown.

plans
next
  The next release adds stock checks.
  stock

1 person, 2 systems, 2 containers, 2 components`

function element(
  fields: Partial<AnnotatedElement> & Pick<AnnotatedElement, 'id' | 'kind' | 'origin'>,
): AnnotatedElement {
  const planPrefix = fields.plan === undefined ? '' : `:${fields.plan}`
  return {
    representationId: fields.representationId ?? `${fields.origin}${planPrefix}:${fields.id}`,
    name: fields.id,
    description: '',
    parent: null,
    children: [],
    external: false,
    code: [],
    ...fields,
  }
}

test('renderPlainWorld prints the merged fixture world from core in the approved index shape', async () => {
  const model = await loadAnnotatedArchitecture(fixtureRoot)
  const printed = await renderPlainWorld(fixtureRoot)

  const buyer = model.elements.find(item => item.id === 'buyer')
  const orders = model.elements.find(item => {
    return item.id === 'orders' && item.origin === 'observed'
  })
  const stock = model.elements.find(item => {
    return item.id === 'stock' && item.origin === 'planned'
  })
  const uses = model.relationships.find(item => item.description === 'uses')
  const talksTo = model.relationships.find(item => item.description === 'talks to')

  assert.ok(buyer)
  assert.equal(buyer.name, 'Buyer')
  assert.ok(orders)
  assert.equal(orders.code[0]?.file, 'src/orders.ts')
  assert.ok(stock)
  assert.equal(stock.plan, 'next')
  assert.ok(uses)
  assert.equal(uses.source, buyer.representationId)
  assert.ok(talksTo)
  assert.equal(talksTo.source, orders.representationId)
  assert.equal(printed, approvedWorld)
  assert.doesNotMatch(printed, /placeOrder|src\/routes\/orders\.ts|Placeholder/)
})

test('formatPlainWorld omits the plans section when no plan exists', () => {
  const shop = element({
    id: 'shop',
    kind: 'system',
    origin: 'observed',
    name: 'Shop',
    description: 'The store.',
  })
  const printed = formatPlainWorld({
    plans: [],
    elements: [shop],
    relationships: [],
  })

  assert.equal(
    printed,
    [
      'shop  system  Shop',
      '  The store.',
      '',
      '0 people, 1 system, 0 containers, 0 components',
    ].join('\n'),
  )
  assert.doesNotMatch(printed, /^plans$/m)
})

test('a restated id prints once as planned and keeps only the winning source edges', () => {
  const observed = element({
    id: 'orders',
    kind: 'component',
    origin: 'observed',
    name: 'Orders',
    description: 'Places orders.',
    parent: null,
  })
  const planned = element({
    id: 'orders',
    kind: 'component',
    origin: 'planned',
    plan: 'next',
    name: 'Orders',
    description: 'Places reserved orders.',
  })
  const payments = element({
    id: 'payments',
    kind: 'system',
    origin: 'observed',
    name: 'Payments',
    description: 'Takes payment.',
  })
  const observedEdge: AnnotatedRelationship = {
    source: observed.representationId,
    target: payments.representationId,
    description: 'charges',
    technology: 'HTTPS',
    origin: 'observed',
  }
  const plannedEdge: AnnotatedRelationship = {
    source: planned.representationId,
    target: payments.representationId,
    description: 'reserves',
    technology: 'HTTPS',
    origin: 'planned',
    plan: 'next',
  }
  const printed = formatPlainWorld({
    plans: ['next'],
    elements: [observed, planned, payments],
    relationships: [observedEdge, plannedEdge],
  }, [{ id: 'next', outcome: 'Reserve stock first.' }])

  assert.equal(
    printed,
    [
      'orders  component  Orders  planned:next',
      '  Places reserved orders.',
      '  ->  reserves  payments',
      'payments  system  Payments',
      '  Takes payment.',
      '',
      'plans',
      'next',
      '  Reserve stock first.',
      '  orders',
      '',
      '0 people, 1 system, 0 containers, 1 component',
    ].join('\n'),
  )
  assert.doesNotMatch(printed, /Places orders|charges/)
})
