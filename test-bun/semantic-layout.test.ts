import assert from 'node:assert/strict'
import { test } from 'bun:test'

import {
  itemBounds,
  layoutSemanticView,
  originOf,
  preserveSemanticAnchors,
} from '../src/semantic-layout.ts'
import { semanticView } from '../src/semantic-view.ts'
import type { ArchitectureWorld, WorldRelationship } from '../src/types.ts'
import { loadArchitectureViewModel } from '../src/core.ts'
import { box, viewerFixtureRoot } from './helpers.ts'

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

function shopWorld(): ArchitectureWorld {
  const orders = box('orders', 'component', { x: 120, y: 30, width: 40, height: 16 }, {
    parent: 'observed:api',
    name: 'Orders',
  })
  const page = box('page', 'component', { x: 120, y: 220, width: 40, height: 16 }, {
    parent: 'observed:web',
    name: 'Page',
  })
  const scene = box('scene', 'component', { x: 120, y: 360, width: 40, height: 16 }, {
    parent: 'observed:web',
    name: 'Scene',
  })
  const api = box('api', 'container', { x: 110, y: 20, width: 80, height: 80 }, {
    parent: 'observed:shop',
    children: [orders.representationId],
    name: 'Api',
  })
  const web = box('web', 'container', { x: 110, y: 200, width: 80, height: 200 }, {
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
    elements: [shop, api, web, orders, page, scene, buyer, git],
    relationships: [
      link('runs', buyer.representationId, orders.representationId, 'Runs a checkout'),
      link('uses', orders.representationId, page.representationId, 'Uses the page'),
      link('versions', shop.representationId, git.representationId, 'Versions architecture'),
    ],
  }
}

test.concurrent('ELK context uses collapsed sizes instead of the nested stack', async () => {
  const world = shopWorld()
  const shop = world.elements.find(element => element.id === 'shop')
  assert.ok(shop)
  const view = await layoutSemanticView(semanticView(world, { level: 'context' }), world)
  const bounds = itemBounds(view, 'shop')
  assert.ok(bounds)
  assert.equal(bounds.height, 40)
  assert.ok(bounds.height < shop.bounds.height)
  assert.ok(bounds.width >= 'Shop'.length * 3 + 6)
})

test.concurrent('fresh ELK records origin movement when Enter adds containers', async () => {
  const world = shopWorld()
  const context = await layoutSemanticView(semanticView(world, { level: 'context' }), world)
  const entered = await layoutSemanticView(
    semanticView(world, { level: 'containers', focusId: 'observed:shop' }),
    world,
  )
  const shop = itemBounds(entered, 'shop')
  assert.ok(shop)
  assert.ok(shop.height < 400)
  const moved = ['shop', 'buyer', 'git'].map(id => {
    const from = originOf(context, id)
    const to = originOf(entered, id)
    assert.ok(from)
    assert.ok(to)
    return {
      id,
      dx: to.x - from.x,
      dy: to.y - from.y,
    }
  })
  assert.ok(moved.some(item => item.dx !== 0 || item.dy !== 0))
})

test.concurrent('preserving anchors keeps Shop, Buyer, and Git origins across Enter', async () => {
  const world = shopWorld()
  const context = await layoutSemanticView(semanticView(world, { level: 'context' }), world)
  const entered = await preserveSemanticAnchors(
    context,
    semanticView(world, { level: 'containers', focusId: 'observed:shop' }),
    world,
  )
  for (const id of ['shop', 'buyer', 'git']) {
    assert.deepEqual(originOf(entered, id), originOf(context, id))
  }
  const shop = itemBounds(entered, 'shop')
  const web = itemBounds(entered, 'web')
  assert.ok(shop)
  assert.ok(web)
  assert.ok(shop.height < 400)
  assert.ok(web.x >= shop.x)
  assert.ok(web.y >= shop.y)
  assert.ok(web.x + web.width <= shop.x + shop.width)
  assert.ok(web.y + web.height <= shop.y + shop.height)
})

test.concurrent('viewer-view Shop loses the nested world height at Context', async () => {
  const { world } = await loadArchitectureViewModel(viewerFixtureRoot)
  const laid = world.elements.find(element => element.id === 'shop')
  assert.ok(laid)
  const view = await layoutSemanticView(semanticView(world, { level: 'context' }), world)
  const shop = itemBounds(view, 'shop')
  assert.ok(shop)
  assert.equal(shop.height, 40)
  assert.ok(shop.height < laid.bounds.height)
})
