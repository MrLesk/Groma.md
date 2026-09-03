import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'

import { loadAnnotatedArchitecture } from '../src/core.ts'
import { copyFixture, groma, projectRoot, readRelative, readTree } from './cli-helpers.ts'

const fixtureRoot = path.join(projectRoot, 'test', 'fixtures', 'plain-view')

test('groma add writes a stable person and a stable external at their folders', async t => {
  const root = await copyFixture(t, fixtureRoot, 'groma-add-')
  const actor = await groma(root, ['add', 'actor', 'Support agent', '--overview', 'Answers tickets.'])
  const external = await groma(root, [
    'add', 'external', 'Stripe', '--technology', 'REST', '--description', 'Payments', '--overview', 'Charges cards.',
  ])

  assert.equal(actor.code, 0, actor.stderr)
  assert.equal(external.code, 0, external.stderr)
  assert.equal(await readRelative(root, 'groma/actors/support-agent.md'), `---
type: C4 Actor
title: Support agent
status: stable
groma:
  id: support-agent
---

Answers tickets.
`)
  assert.equal(await readRelative(root, 'groma/externals/stripe.md'), `---
type: C4 System
title: Stripe
description: Payments
status: stable
groma:
  id: stripe
  technology: REST
---

Charges cards.
`)
  const model = await loadAnnotatedArchitecture(root)
  const agent = model.elements.find(element => element.id === 'support-agent')
  const stripe = model.elements.find(element => element.id === 'stripe')
  assert.equal(agent?.kind, 'actor')
  assert.equal(agent?.origin, 'observed')
  assert.equal(stripe?.kind, 'system')
  assert.equal(stripe?.external, true)
  assert.equal(stripe?.technology, 'REST')
})

test('groma add draft writes the draft record with its outcome', async t => {
  const root = await copyFixture(t, fixtureRoot, 'groma-add-')
  const result = await groma(root, ['add', 'draft', 'Checkout v2', '--overview', 'Customers pay with a saved card.'])

  assert.equal(result.code, 0, result.stderr)
  assert.equal(await readRelative(root, 'groma/drafts/checkout-v2.md'), `---
type: Draft
title: Checkout v2
groma:
  id: checkout-v2
---

Customers pay with a saved card.
`)
  assert.deepEqual((await loadAnnotatedArchitecture(root)).drafts, ['checkout-v2', 'next'])
})

test('groma add refuses scanned kinds with the sentence that names groma draft, and writes nothing', async t => {
  const root = await copyFixture(t, fixtureRoot, 'groma-add-')
  const before = await readTree(root)
  for (const kind of ['system', 'container', 'component']) {
    const result = await groma(root, ['add', kind, 'Pricing', '--overview', 'Prices goods.'])
    assert.notEqual(result.code, 0, kind)
    assert.match(result.stderr, new RegExp(`groma draft ${kind} "Pricing"`), kind)
  }
  assert.deepEqual(await readTree(root), before)
})

test('unknown things, taken or reserved ids, missing overview and technology on a person fail without writes', async t => {
  const root = await copyFixture(t, fixtureRoot, 'groma-add-')
  const before = await readTree(root)
  const cases: Array<{ name: string, args: string[] }> = [
    { name: 'unknown thing', args: ['add', 'widget', 'Thing', '--overview', 'Nope.'] },
    { name: 'id of an element', args: ['add', 'actor', 'Buyer', '--overview', 'Nope.'] },
    { name: 'id of a draft record', args: ['add', 'actor', 'Next', '--overview', 'Nope.'] },
    { name: 'reserved name', args: ['add', 'actor', 'Index', '--overview', 'Nope.'] },
    { name: 'name without a letter or digit', args: ['add', 'external', '!!!', '--overview', 'Nope.'] },
    { name: 'missing overview', args: ['add', 'draft', 'Later'] },
    { name: 'technology on a person', args: ['add', 'actor', 'Clerk', '--technology', 'Human', '--overview', 'Nope.'] },
  ]
  for (const item of cases) {
    const result = await groma(root, item.args)
    assert.notEqual(result.code, 0, item.name)
    assert.deepEqual(await readTree(root), before, item.name)
  }
})
