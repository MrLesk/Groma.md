import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadAnnotatedArchitecture } from '../src/core.ts'
import {
  formatPlainRecord,
  formatPlainWorld,
  renderPlainRecord,
  renderPlainWorld,
} from '../src/plain-world.ts'
import type { AnnotatedElement } from '../src/types.ts'

const fixtureRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'validate')

function element(
  fields: Partial<AnnotatedElement> & Pick<AnnotatedElement, 'id' | 'kind' | 'origin'>,
): AnnotatedElement {
  const planPrefix = fields.plan === undefined ? '' : `:${fields.plan}`
  return {
    representationId: fields.representationId ?? `${fields.origin}${planPrefix}:${fields.id}`,
    title: fields.id,
    overview: '',
    parent: null,
    children: [],
    external: false,
    code: [],
    ...fields,
  }
}

test('the plain projection reads title and overview from the marked OKF world', async () => {
  const model = await loadAnnotatedArchitecture(fixtureRoot)
  const printed = await renderPlainWorld(fixtureRoot)
  const buyer = model.elements.find(item => item.id === 'buyer')

  assert.ok(buyer)
  assert.equal(buyer.title, 'Buyer')
  assert.equal(buyer.overview, 'Places orders in the shop.')
  assert.match(printed, /^buyer {2}actor {2}Buyer/m)
  assert.match(printed, /^ {2}Places orders in the shop\.$/m)
  assert.match(printed, /^\s+stock {2}component {2}Stock {2}planned:next$/m)
  assert.doesNotMatch(printed, /A person who places an order/)
})

test('plain output displays overview while retaining standard description only in the domain', () => {
  const shop = element({
    id: 'shop',
    kind: 'system',
    origin: 'observed',
    title: 'Shop',
    description: 'Short standard metadata.',
    overview: 'Long body overview.',
  })
  const printed = formatPlainWorld({ plans: [], elements: [shop], relationships: [] })

  assert.match(printed, /shop {2}system {2}Shop\n {2}Long body overview\./)
  assert.doesNotMatch(printed, /Short standard metadata/)
})

test('a planned replacement wins and keeps only its outgoing relationships', () => {
  const observed = element({
    id: 'orders',
    kind: 'component',
    origin: 'observed',
    title: 'Orders',
    overview: 'Places orders.',
  })
  const planned = element({
    id: 'orders',
    kind: 'component',
    origin: 'planned',
    plan: 'next',
    title: 'Reserved orders',
    overview: 'Places reserved orders.',
  })
  const payments = element({
    id: 'payments',
    kind: 'system',
    origin: 'observed',
    title: 'Payments',
    overview: 'Takes payment.',
  })
  const printed = formatPlainWorld({
    plans: ['next'],
    elements: [observed, planned, payments],
    relationships: [
      {
        id: 'relationship:0',
        source: observed.representationId,
        target: payments.representationId,
        description: 'charges',
        technology: 'HTTPS',
        origin: 'observed',
      },
      {
        id: 'relationship:1',
        source: planned.representationId,
        target: payments.representationId,
        description: 'reserves',
        technology: 'HTTPS',
        origin: 'planned',
        plan: 'next',
      },
    ],
  })

  assert.match(printed, /orders {2}component {2}Reserved orders {2}planned:next/)
  assert.match(printed, /-> {2}reserves {2}payments/)
  assert.doesNotMatch(printed, /Places orders|charges/)
})

test('a code file resolves to its one winning element record', () => {
  const orders = element({
    id: 'orders',
    kind: 'component',
    origin: 'observed',
    title: 'Orders',
    overview: 'Owns orders.',
    code: [{ scanner: 'typescript', file: 'src/orders.ts' }],
  })

  const result = formatPlainRecord(
    { plans: [], elements: [orders], relationships: [] },
    [],
    'src/orders.ts',
  )
  assert.equal(result.ok, true)
  if (result.ok) assert.match(result.text, /^orders\n/)
})

test('record lookup keeps ambiguity, unknown target, and element precedence behavior', () => {
  const first = element({
    id: 'first',
    kind: 'component',
    origin: 'observed',
    code: [{ scanner: 'typescript', file: 'src/shared.ts' }],
  })
  const second = element({
    id: 'second',
    kind: 'component',
    origin: 'observed',
    code: [{ scanner: 'typescript', file: 'src/shared.ts' }],
  })
  const next = element({ id: 'next', kind: 'system', origin: 'observed' })
  const model = { plans: ['next'], elements: [first, second, next], relationships: [] }

  assert.deepEqual(formatPlainRecord(model, [], 'src/shared.ts'), {
    ok: false,
    message: 'several elements share src/shared.ts',
  })
  assert.deepEqual(formatPlainRecord(model, [], 'unknown'), {
    ok: false,
    message: 'unknown target: unknown',
  })
  const collision = formatPlainRecord(model, [{ id: 'next', outcome: 'Plan outcome.' }], 'next')
  assert.equal(collision.ok, true)
  if (collision.ok) assert.match(collision.text, /^next\nkind: system\n/)
})

test('plan output distinguishes absent, incomplete, and complete plans', () => {
  const shop = element({ id: 'shop', kind: 'system', origin: 'observed' })
  assert.doesNotMatch(
    formatPlainWorld({ plans: [], elements: [shop], relationships: [] }),
    /^plans$/m,
  )

  const stock = element({
    id: 'stock',
    kind: 'component',
    origin: 'planned',
    plan: 'next',
  })
  const incomplete = formatPlainRecord(
    { plans: ['next'], elements: [stock], relationships: [] },
    [{ id: 'next', outcome: 'Add stock checks.' }],
    'next',
  )
  assert.equal(incomplete.ok, true)
  if (incomplete.ok) {
    assert.match(incomplete.text, /Add stock checks\./)
    assert.match(incomplete.text, /ghosts\nstock$/)
  }

  const complete = formatPlainRecord(
    { plans: ['next'], elements: [shop], relationships: [] },
    [{ id: 'next', outcome: 'Already delivered.' }],
    'next',
  )
  assert.deepEqual(complete, {
    ok: true,
    text: 'next\nkind: plan\n\ncomplete',
  })
})

test('record rendering loads the marked OKF package', async () => {
  const [code, plan] = await Promise.all([
    renderPlainRecord(fixtureRoot, 'src/core.ts'),
    renderPlainRecord(fixtureRoot, 'next'),
  ])

  assert.equal(code.ok, true)
  if (code.ok) {
    assert.match(code.text, /^orders\n/)
    assert.match(code.text, /Places and tracks customer orders\./)
  }
  assert.equal(plan.ok, true)
  if (plan.ok) assert.match(plan.text, /ghosts\nstock$/)
})
