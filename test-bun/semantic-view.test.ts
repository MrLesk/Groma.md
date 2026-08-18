import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { displaySize, semanticView } from '../src/semantic-view.ts'
import type { ArchitectureWorld, WorldElement, WorldRelationship } from '../src/types.ts'
import { box } from './helpers.ts'

function link(
  id: string,
  source: string,
  target: string,
  description: string,
): WorldRelationship {
  return {
    id,
    source,
    target,
    description,
    technology: '',
    origin: 'observed',
    route: [],
    label: null,
  }
}

/** A shop inflated the way ELK inflates a parent around a tall nested stack. */
function shopWorld(): ArchitectureWorld {
  const orders = box('orders', 'component', { x: 120, y: 30, width: 40, height: 16 }, {
    parent: 'observed:api',
    name: 'Orders',
  })
  const pay = box('pay', 'component', { x: 120, y: 50, width: 40, height: 16 }, {
    parent: 'observed:api',
    name: 'Pay',
  })
  const page = box('page', 'component', { x: 120, y: 220, width: 40, height: 16 }, {
    parent: 'observed:web',
    name: 'Page',
  })
  const scene = box('scene', 'component', { x: 120, y: 300, width: 40, height: 16 }, {
    parent: 'observed:web',
    name: 'Scene',
  })
  const api = box('api', 'container', { x: 110, y: 20, width: 80, height: 80 }, {
    parent: 'observed:shop',
    children: [orders.representationId, pay.representationId],
    name: 'Api',
  })
  const web = box('web', 'container', { x: 110, y: 200, width: 80, height: 180 }, {
    parent: 'observed:shop',
    children: [page.representationId, scene.representationId],
    name: 'Web',
  })
  const shop = box('shop', 'system', { x: 100, y: 0, width: 200, height: 400 }, {
    children: [api.representationId, web.representationId],
    name: 'Shop',
  })
  const buyer = box('buyer', 'person', { x: 0, y: 200, width: 20, height: 20 }, {
    name: 'Buyer',
  })
  const git = box('git', 'system', { x: 400, y: 0, width: 40, height: 40 }, {
    name: 'Git',
    external: true,
  })
  return {
    bounds: { x: 0, y: 0, width: 500, height: 400 },
    groups: [],
    elements: [shop, api, web, orders, pay, page, scene, buyer, git],
    relationships: [
      link('runs', buyer.representationId, orders.representationId, 'Runs a checkout'),
      link('uses', orders.representationId, page.representationId, 'Uses the page'),
      link('versions', shop.representationId, git.representationId, 'Versions architecture'),
    ],
  }
}

function item(
  view: ReturnType<typeof semanticView>,
  id: string,
): ReturnType<typeof semanticView>['items'][number] {
  const found = view.items.find(entry => entry.id === id)
  assert.ok(found, `missing ${id}`)
  return found
}

function ids(view: ReturnType<typeof semanticView>): string[] {
  return view.items.map(entry => entry.id).sort()
}

test.concurrent('context sizes a nested system for its name, not its stacked children', () => {
  const world = shopWorld()
  const shopEl = world.elements.find(element => element.id === 'shop') as WorldElement
  const view = semanticView(world, { level: 'context' })
  const shop = item(view, 'shop')
  const needed = displaySize('Shop', 'system')
  assert.deepEqual(ids(view), ['buyer', 'git', 'shop'])
  assert.equal(shop.collapsed, true)
  assert.equal(shop.bounds.x, shopEl.bounds.x)
  assert.equal(shop.bounds.y, shopEl.bounds.y)
  assert.equal(shop.bounds.width, needed.width)
  assert.equal(shop.bounds.height, needed.height)
  assert.ok(shop.bounds.height < shopEl.bounds.height)
  assert.ok(shop.bounds.width >= 'Shop'.length * 3 + 6)
})

test.concurrent('entering containers keeps the system origin and hides components', () => {
  const world = shopWorld()
  const context = semanticView(world, { level: 'context' })
  const entered = semanticView(world, { level: 'containers', focusId: 'observed:shop' })
  const before = item(context, 'shop')
  const after = item(entered, 'shop')
  assert.equal(after.bounds.x, before.bounds.x)
  assert.equal(after.bounds.y, before.bounds.y)
  assert.deepEqual(ids(entered), ['api', 'buyer', 'git', 'shop', 'web'])
  assert.equal(item(entered, 'api').collapsed, true)
  assert.equal(item(entered, 'web').collapsed, true)
  assert.equal(after.collapsed, false)
  for (const entry of entered.items) {
    const needed = displaySize(entry.name, entry.kind)
    assert.equal(entry.bounds.width, needed.width)
    assert.equal(entry.bounds.height, needed.height)
  }
})

test.concurrent('components stay inside the entered container and keep names sized', () => {
  const world = shopWorld()
  const view = semanticView(world, { level: 'components', focusId: 'observed:web' })
  assert.deepEqual(ids(view), ['api', 'page', 'scene', 'web'])
  assert.equal(item(view, 'web').collapsed, false)
  for (const entry of view.items) {
    assert.ok(entry.bounds.width >= entry.name.length * 3 + 6)
  }
})

test.concurrent('nested relationships promote to the visible items at each level', () => {
  const world = shopWorld()
  const context = semanticView(world, { level: 'context' })
  assert.deepEqual(
    context.edges.map(edge => [edge.source, edge.target, edge.description]).sort(),
    [
      ['observed:buyer', 'observed:shop', 'Runs a checkout'],
      ['observed:shop', 'observed:git', 'Versions architecture'],
    ],
  )
  const containers = semanticView(world, { level: 'containers', focusId: 'observed:shop' })
  assert.deepEqual(
    containers.edges.map(edge => [edge.source, edge.target, edge.description]).sort(),
    [
      ['observed:api', 'observed:web', 'Uses the page'],
      ['observed:buyer', 'observed:api', 'Runs a checkout'],
      ['observed:shop', 'observed:git', 'Versions architecture'],
    ],
  )
  const components = semanticView(world, { level: 'components', focusId: 'observed:web' })
  assert.deepEqual(
    components.edges.map(edge => [edge.source, edge.target, edge.description]).sort(),
    [
      ['observed:api', 'observed:page', 'Uses the page'],
    ],
  )
})
