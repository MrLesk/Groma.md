import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'

import { loadAnnotatedArchitecture } from '../src/core.ts'
import { copyFixture, groma, projectRoot, readTree } from './cli-helpers.ts'

const fixtureRoot = path.join(projectRoot, 'test', 'fixtures', 'plain-view')

async function groupsOf(root: string): Promise<Record<string, string | undefined>> {
  const world = await loadAnnotatedArchitecture(root)
  return Object.fromEntries(world.elements.filter(element => element.kind === 'component').map(element => [element.id, element.group]))
}

test('groma add group names sibling components, edit group renames every member, remove group takes members out or dissolves it', async t => {
  const root = await copyFixture(t, fixtureRoot, 'groma-group-')
  const added = await groma(root, ['add', 'group', 'Checkout', 'orders', 'stock'])
  assert.equal(added.code, 0, added.stderr)
  assert.deepEqual(await groupsOf(root), { orders: 'Checkout', stock: 'Checkout' })

  const renamed = await groma(root, ['edit', 'group', 'api/checkout', '--title', 'Order flow'])
  assert.equal(renamed.code, 0, renamed.stderr)
  assert.deepEqual(await groupsOf(root), { orders: 'Order flow', stock: 'Order flow' })

  const left = await groma(root, ['remove', 'group', 'api/order-flow', 'stock'])
  assert.equal(left.code, 0, left.stderr)
  assert.deepEqual(await groupsOf(root), { orders: 'Order flow', stock: undefined })

  const dissolved = await groma(root, ['remove', 'group', 'api/order-flow'])
  assert.equal(dissolved.code, 0, dissolved.stderr)
  assert.deepEqual(await groupsOf(root), { orders: undefined, stock: undefined })
})

test('group verbs refuse other kinds, mixed containers, unknown addresses and strangers without writes', async t => {
  const root = await copyFixture(t, fixtureRoot, 'groma-group-')
  assert.equal((await groma(root, ['draft', 'component', 'Cart', '--parent', 'web', '--overview', 'Holds items.'])).code, 0)
  assert.equal((await groma(root, ['add', 'group', 'Checkout', 'orders'])).code, 0)
  const before = await readTree(root)
  const cases: Array<{ name: string, args: string[] }> = [
    { name: 'a system as a member', args: ['add', 'group', 'Core', 'shop', 'orders'] },
    { name: 'members of two containers', args: ['add', 'group', 'Core', 'orders', 'cart'] },
    { name: 'no members', args: ['add', 'group', 'Core'] },
    { name: 'an unknown address', args: ['edit', 'group', 'api/nope', '--title', 'X'] },
    { name: 'an element id after the word group', args: ['edit', 'group', 'orders', '--title', 'X'] },
    { name: 'an external after the word group', args: ['remove', 'group', 'git'] },
    { name: 'a stranger leaving', args: ['remove', 'group', 'api/checkout', 'stock'] },
    { name: 'an overview on a group', args: ['edit', 'group', 'api/checkout', '--overview', 'X'] },
  ]
  for (const item of cases) {
    const result = await groma(root, item.args)
    assert.notEqual(result.code, 0, item.name)
    assert.deepEqual(await readTree(root), before, item.name)
  }
})
