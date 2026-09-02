import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadAnnotatedArchitecture } from '../src/core.ts'
import { copyFixture, groma, readRelative, readTree, writeTree } from './cli-helpers.ts'

const fixtureRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'create',
)

const stockPath = 'groma/systems/shop/containers/api/components/stock.md'

const approvedStock = `---
type: C4 Component
title: Stock
status: draft
groma:
  id: stock
  parent: api
---

Checks stock before placing an order.
`

const nextDraft = `---
type: Draft
title: Next
groma:
  id: next
---

The next release adds stock checks.
`

const approvedArgs = [
  'draft',
  'component',
  'Stock',
  '--parent',
  'api',
  '--overview',
  'Checks stock before placing an order.',
]

test('a drafted container or component is a ghost at its future path under the given parent', async t => {
  const root = await copyFixture(t, fixtureRoot, 'groma-draft-')
  const component = await groma(root, approvedArgs)
  const container = await groma(root, [
    'draft',
    'container',
    'Warehouse',
    '--parent',
    'shop',
    '--overview',
    'Stores goods.',
  ])

  assert.equal(component.code, 0, component.stderr)
  assert.equal(container.code, 0, container.stderr)
  assert.equal(await readRelative(root, stockPath), approvedStock)
  const model = await loadAnnotatedArchitecture(root)
  const stock = model.elements.find(element => element.id === 'stock')
  const warehouse = model.elements.find(element => element.id === 'warehouse')
  assert.ok(stock)
  assert.equal(stock.origin, 'draft')
  assert.equal(stock.draft, undefined)
  assert.equal(stock.parent, 'api')
  assert.ok(warehouse)
  assert.equal(warehouse.origin, 'draft')
  assert.equal(warehouse.parent, 'shop')
  assert.match(
    await readRelative(root, 'groma/systems/shop/containers/warehouse/container.md'),
    /^status: draft$/m,
  )
})

test('--draft files the ghost under an existing draft record and refuses an unknown one', async t => {
  const root = await copyFixture(t, fixtureRoot, 'groma-draft-')
  await writeTree(root, { 'groma/drafts/next.md': nextDraft })
  const filed = await groma(root, [...approvedArgs, '--draft', 'next'])

  assert.equal(filed.code, 0, filed.stderr)
  assert.match(await readRelative(root, stockPath), /^ {2}draft: next$/m)
  const model = await loadAnnotatedArchitecture(root)
  assert.equal(model.elements.find(element => element.id === 'stock')?.draft, 'next')
  assert.deepEqual(model.drafts, ['next'])

  const before = await readTree(root)
  const unknown = await groma(root, [
    'draft',
    'component',
    'Pricing',
    '--parent',
    'api',
    '--overview',
    'Prices goods.',
    '--draft',
    'other',
  ])
  assert.notEqual(unknown.code, 0)
  assert.deepEqual(await readTree(root), before)
})

test('a system needs no parent, containers and components need one, and people are never drafted', async t => {
  const root = await copyFixture(t, fixtureRoot, 'groma-draft-')
  const before = await readTree(root)
  const cases: Array<{ name: string, args: string[] }> = [
    {
      name: 'component without parent',
      args: ['draft', 'component', 'Stock', '--overview', 'Checks stock.'],
    },
    {
      name: 'container without parent',
      args: ['draft', 'container', 'Warehouse', '--overview', 'Stores goods.'],
    },
    {
      name: 'system with parent',
      args: ['draft', 'system', 'Git', '--parent', 'shop', '--overview', 'Versions the Markdown.'],
    },
    {
      name: 'actor',
      args: ['draft', 'actor', 'Buyer', '--overview', 'Pays for goods.'],
    },
  ]
  for (const item of cases) {
    const result = await groma(root, item.args)
    assert.notEqual(result.code, 0, item.name)
    assert.deepEqual(await readTree(root), before, item.name)
  }

  const system = await groma(root, ['draft', 'system', 'Warehouse', '--overview', 'Stores goods.'])
  assert.equal(system.code, 0, system.stderr)
  const model = await loadAnnotatedArchitecture(root)
  const warehouse = model.elements.find(element => element.id === 'warehouse')
  assert.ok(warehouse)
  assert.equal(warehouse.origin, 'draft')
  assert.equal(warehouse.parent, null)
  assert.match(await readRelative(root, 'groma/systems/warehouse/system.md'), /^status: draft$/m)
})

test('duplicate or taken id, unknown parent, missing overview, wrong parent kind, reserved name and an occupied path fail without writes', async t => {
  const root = await copyFixture(t, fixtureRoot, 'groma-draft-')
  await writeTree(root, {
    [stockPath]: approvedStock.replace('status: draft', 'status: stable'),
    'groma/drafts/next.md': nextDraft,
    'groma/systems/shop/containers/api/components/pricing.md': approvedStock
      .replace('title: Stock', 'title: Bar')
      .replace('id: stock', 'id: bar'),
  })
  const before = await readTree(root)

  const cases: Array<{ name: string, args: string[] }> = [
    {
      name: 'duplicate id',
      args: approvedArgs,
    },
    {
      name: 'name without a letter or digit',
      args: ['draft', 'system', '!!!', '--overview', 'Nameless.'],
    },
    {
      name: 'id already naming a draft record',
      args: ['draft', 'system', 'Next', '--overview', 'Collides with the draft record.'],
    },
    {
      name: 'path occupied by another id',
      args: ['draft', 'component', 'Pricing', '--parent', 'api', '--overview', 'Prices goods.'],
    },
    {
      name: 'unknown parent',
      args: ['draft', 'component', 'Inventory', '--parent', 'nope', '--overview', 'Tracks stock.'],
    },
    {
      name: 'missing overview',
      args: ['draft', 'component', 'Inventory', '--parent', 'api'],
    },
    {
      name: 'illegal kind',
      args: ['draft', 'person', 'Inventory', '--parent', 'api', '--overview', 'Tracks stock.'],
    },
    {
      name: 'wrong parent kind',
      args: ['draft', 'component', 'Inventory', '--parent', 'shop', '--overview', 'Tracks stock.'],
    },
    {
      name: 'reserved document name',
      args: ['draft', 'component', 'Index', '--parent', 'api', '--overview', 'Tracks stock.'],
    },
  ]

  for (const item of cases) {
    const result = await groma(root, item.args)
    assert.notEqual(result.code, 0, item.name)
    assert.deepEqual(await readTree(root), before, item.name)
  }
})
