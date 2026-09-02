import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadAnnotatedArchitecture } from '../src/core.ts'
import { copyFixture, groma, readRelative, readTree, writeTree } from './cli-helpers.ts'

const fixtureRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'edit',
)

const ordersPath = 'groma/systems/shop/containers/api/components/orders.md'
const draftPath = 'groma/drafts/next.md'

const editedOrders = `---
type: C4 Component
title: Orders
status: stable
groma:
  id: orders
  parent: api
  code:
    - scanner: typescript
      file: src/orders.ts
      symbol: placeOrder
---

Places and tracks customer orders.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Stock](stock.md) | talks to | Function call |
`

const emptyDraft = `---
type: Draft
title: Next
groma:
  id: next
---
`

test('groma edit element --overview replaces only the owning lead prose', async t => {
  const root = await copyFixture(t, fixtureRoot, 'groma-edit-')
  const result = await groma(root, [
    'edit',
    'orders',
    '--overview',
    'Places and tracks customer orders.',
  ])

  assert.equal(result.code, 0, result.stderr)
  assert.equal(await readRelative(root, ordersPath), editedOrders)
})

test('groma edit element --draft tags a stable element with the draft that touches it', async t => {
  const root = await copyFixture(t, fixtureRoot, 'groma-edit-')
  await writeTree(root, { [draftPath]: emptyDraft })
  const original = await readRelative(root, ordersPath)
  const tagged = await groma(root, ['edit', 'orders', '--draft', 'next'])

  assert.equal(tagged.code, 0, tagged.stderr)
  const source = await readRelative(root, ordersPath)
  assert.match(source, /^ {2}draft: next$/m)
  assert.match(source, /^status: stable$/m)
  assert.match(source, /Owns the order lifecycle\./)
  assert.match(source, /\[Stock\]\(stock\.md\)/)
  const orders = (await loadAnnotatedArchitecture(root)).elements.find(element => element.id === 'orders')
  assert.equal(orders?.origin, 'observed')
  assert.equal(orders?.draft, 'next')

  const before = await readTree(root)
  const unknown = await groma(root, ['edit', 'orders', '--draft', 'other'])
  assert.notEqual(unknown.code, 0)
  assert.deepEqual(await readTree(root), before)
  assert.notEqual(source, original)
})

test('groma edit <draft-id> --overview sets and replaces the draft outcome', async t => {
  const root = await copyFixture(t, fixtureRoot, 'groma-edit-')
  await writeTree(root, { [draftPath]: emptyDraft })
  const created = await groma(root, [
    'edit',
    'next',
    '--overview',
    'The next release adds stock checks.',
  ])

  assert.equal(created.code, 0, created.stderr)
  assert.equal(
    await readRelative(root, draftPath),
    `${emptyDraft}\nThe next release adds stock checks.\n`,
  )

  const replaced = await groma(root, ['edit', 'next', '--overview', 'Stock checks ship next.'])
  assert.equal(replaced.code, 0, replaced.stderr)
  assert.equal(await readRelative(root, draftPath), `${emptyDraft}\nStock checks ship next.\n`)
})

test('unknown ids, empty edits, element flags on a draft record, and a tag with structure fail without writes', async t => {
  const root = await copyFixture(t, fixtureRoot, 'groma-edit-')
  await writeTree(root, { [draftPath]: emptyDraft })
  const before = await readTree(root)

  const cases: Array<{ name: string, args: string[] }> = [
    {
      name: 'unknown id',
      args: ['edit', 'nope', '--overview', 'Missing.'],
    },
    {
      name: 'unknown id without overview',
      args: ['edit', 'nope'],
    },
    {
      name: 'nothing to change on an element',
      args: ['edit', 'orders'],
    },
    {
      name: 'nothing to change on a draft record',
      args: ['edit', 'next'],
    },
    {
      name: '--description on a draft record',
      args: ['edit', 'next', '--description', 'Nope.'],
    },
    {
      name: '--draft on a draft record',
      args: ['edit', 'next', '--draft', 'next'],
    },
    {
      name: 'structure on a draft record',
      args: ['edit', 'next', '--group', 'Commerce'],
    },
    {
      name: '--draft combined with structure',
      args: ['edit', 'orders', '--draft', 'next', '--group', 'Commerce'],
    },
  ]

  for (const item of cases) {
    const result = await groma(root, item.args)
    assert.notEqual(result.code, 0, item.name)
    assert.deepEqual(await readTree(root), before, item.name)
  }
})
