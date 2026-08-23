import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { displaySize, semanticView } from '../src/semantic-view.ts'
import type {
  ArchitectureWorld,
  Bounds,
  Point,
  SemanticRole,
  SemanticView,
  WorldElement,
  WorldRelationship,
} from '../src/types.ts'
import { box } from './helpers.ts'

function link(
  id: string,
  source: string,
  target: string,
  description: string,
  route: Point[] = [],
  label: Bounds | null = null,
): WorldRelationship {
  return {
    id,
    source,
    target,
    description,
    technology: '',
    origin: 'observed',
    route,
    label,
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
  const soon = box('soon', 'container', { x: 120, y: 370, width: 60, height: 20 }, {
    parent: 'observed:shop',
    name: 'Soon',
    origin: 'planned',
    representationId: 'planned:soon',
  })
  const shop = box('shop', 'system', { x: 100, y: 0, width: 200, height: 400 }, {
    children: [api.representationId, web.representationId, soon.representationId],
    name: 'Shop',
  })
  const yard = box('yard', 'system', { x: 500, y: 0, width: 48, height: 40 }, {
    name: 'Yard',
  })
  const buyer = box('buyer', 'actor', { x: 0, y: 200, width: 20, height: 20 }, {
    name: 'Buyer',
  })
  const git = box('git', 'system', { x: 400, y: 0, width: 40, height: 40 }, {
    name: 'Git',
    external: true,
  })
  return {
    bounds: { x: 0, y: 0, width: 560, height: 400 },
    groups: [],
    elements: [shop, api, web, soon, orders, pay, page, scene, yard, buyer, git],
    relationships: [
      link(
        'runs',
        buyer.representationId,
        orders.representationId,
        'Runs a checkout',
        [{ x: 20, y: 210 }, { x: 100, y: 210 }],
        { x: 50, y: 210, width: 10, height: 1 },
      ),
      link(
        'uses',
        orders.representationId,
        page.representationId,
        'Uses the page',
        [{ x: 150, y: 58 }, { x: 150, y: 220 }],
        { x: 150, y: 130, width: 10, height: 1 },
      ),
      link(
        'versions',
        shop.representationId,
        git.representationId,
        'Versions architecture',
        [{ x: 300, y: 20 }, { x: 400, y: 20 }],
        { x: 340, y: 20, width: 10, height: 1 },
      ),
    ],
  }
}

function item(view: SemanticView, id: string): SemanticView['items'][number] {
  const found = view.items.find(entry => entry.id === id)
  assert.ok(found, `missing ${id}`)
  return found
}

function idsOf(view: SemanticView, role: SemanticRole): string[] {
  return view.items.filter(entry => entry.role === role).map(entry => entry.id).sort()
}

function originOf(view: SemanticView, id: string): { x: number; y: number } {
  const found = item(view, id)
  return { x: found.bounds.x, y: found.bounds.y }
}

function worldOf(world: ArchitectureWorld, id: string): WorldElement {
  const found = world.elements.find(element => element.id === id)
  assert.ok(found, `missing world ${id}`)
  return found
}

function route(view: SemanticView, id: string): SemanticView['routes'][number] {
  const found = view.routes.find(entry => entry.id === id)
  assert.ok(found, `missing route ${id}`)
  return found
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== 'object') return
  Object.freeze(value)
  for (const child of Object.values(value)) deepFreeze(child)
}

test.concurrent('context keeps a system campus wrapper size from world-layout', () => {
  const world = shopWorld()
  const shopEl = worldOf(world, 'shop')
  const view = semanticView(world, { level: 'context' })
  const shop = item(view, 'shop')
  assert.equal(shop.role, 'named')
  assert.deepEqual(shop.bounds, shopEl.bounds)
  assert.ok(shop.bounds.height > displaySize('Shop', 'system').height)
})

test.concurrent('context names systems, keeps containers as underlay, and marks actors', () => {
  const world = shopWorld()
  const view = semanticView(world, { level: 'context' })
  assert.deepEqual(idsOf(view, 'named'), ['shop', 'yard'])
  assert.deepEqual(idsOf(view, 'underlay'), ['api', 'soon', 'web'])
  assert.deepEqual(idsOf(view, 'mark'), ['buyer', 'git'])
  assert.deepEqual(idsOf(view, 'campus'), [])
  const soon = item(view, 'soon')
  assert.equal(soon.role, 'underlay')
  assert.equal(worldOf(world, 'soon').origin, 'planned')
  assert.deepEqual(item(view, 'api').bounds, worldOf(world, 'api').bounds)
})

test.concurrent('marks keep their world origin and follow the named level size', () => {
  const world = shopWorld()
  const buyerEl = worldOf(world, 'buyer')
  const context = semanticView(world, { level: 'context' })
  const entered = semanticView(world, { level: 'containers', focusId: 'observed:shop' })
  const deeper = semanticView(world, { level: 'components', focusId: 'observed:web' })
  const contextBuyer = item(context, 'buyer')
  const enteredBuyer = item(entered, 'buyer')
  const deeperBuyer = item(deeper, 'buyer')
  assert.equal(contextBuyer.role, 'mark')
  assert.equal(enteredBuyer.role, 'mark')
  assert.equal(deeperBuyer.role, 'mark')
  assert.equal(contextBuyer.bounds.x, buyerEl.bounds.x)
  assert.equal(contextBuyer.bounds.y, buyerEl.bounds.y)
  assert.equal(enteredBuyer.bounds.x, buyerEl.bounds.x)
  assert.equal(enteredBuyer.bounds.y, buyerEl.bounds.y)
  assert.deepEqual(
    { width: contextBuyer.bounds.width, height: contextBuyer.bounds.height },
    displaySize('Buyer', 'system'),
  )
  assert.deepEqual(
    { width: enteredBuyer.bounds.width, height: enteredBuyer.bounds.height },
    displaySize('Buyer', 'container'),
  )
  assert.deepEqual(
    { width: deeperBuyer.bounds.width, height: deeperBuyer.bounds.height },
    displaySize('Buyer', 'component'),
  )
})

test.concurrent('entering a system does not move that system, its actors, or siblings', () => {
  const world = shopWorld()
  const context = semanticView(world, { level: 'context' })
  const entered = semanticView(world, { level: 'containers', focusId: 'observed:shop' })
  for (const id of ['shop', 'yard', 'buyer', 'git']) {
    assert.deepEqual(originOf(entered, id), originOf(context, id), id)
    const laid = worldOf(world, id)
    assert.deepEqual(originOf(context, id), { x: laid.bounds.x, y: laid.bounds.y }, id)
  }
  assert.equal(item(entered, 'shop').role, 'campus')
  assert.deepEqual(item(entered, 'shop').bounds, worldOf(world, 'shop').bounds)
  assert.equal(item(entered, 'yard').role, 'campus')
})

test.concurrent('containers name the focused system containers and underlay their components', () => {
  const world = shopWorld()
  const view = semanticView(world, { level: 'containers', focusId: 'observed:shop' })
  assert.deepEqual(idsOf(view, 'named'), ['api', 'soon', 'web'])
  assert.deepEqual(idsOf(view, 'underlay'), ['orders', 'page', 'pay', 'scene'])
  assert.deepEqual(item(view, 'web').bounds, worldOf(world, 'web').bounds)
  assert.deepEqual(item(view, 'page').bounds, worldOf(world, 'page').bounds)
})

test.concurrent('components name the focused container and have no underlay', () => {
  const world = shopWorld()
  const view = semanticView(world, { level: 'components', focusId: 'observed:web' })
  assert.deepEqual(idsOf(view, 'named'), ['page', 'scene'])
  assert.deepEqual(idsOf(view, 'underlay'), [])
  assert.equal(item(view, 'web').role, 'campus')
  assert.deepEqual(item(view, 'page').bounds, worldOf(world, 'page').bounds)
})

test.concurrent('relationships attach to named, mark, or campus items, never underlay', () => {
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
  for (const view of [context, containers]) {
    for (const edge of view.edges) {
      const source = view.items.find(entry => entry.representationId === edge.source)
      const target = view.items.find(entry => entry.representationId === edge.target)
      assert.ok(source)
      assert.ok(target)
      assert.notEqual(source.role, 'underlay')
      assert.notEqual(target.role, 'underlay')
    }
  }
})

test.concurrent('context exposes stable selection targets and direct route geometry', () => {
  const world = shopWorld()
  const before = structuredClone(world)
  const view = semanticView(world, { level: 'context' })

  assert.deepEqual(view.focusScope, { level: 'context', focusId: null })
  assert.deepEqual(
    view.selectionTargets.map(target => target.id).sort(),
    ['buyer', 'git', 'shop', 'yard'],
  )
  assert.ok(view.selectionTargets.every(target => target.role !== 'underlay'))

  const versions = route(view, 'versions')
  assert.equal(versions.source, 'observed:shop')
  assert.equal(versions.target, 'observed:git')
  assert.deepEqual(versions.route[0], world.relationships[2]!.route[0])
  assert.equal(versions.route.at(-1)?.x, item(view, 'git').bounds.x - 1)
  assert.deepEqual(versions.label, world.relationships[2]!.label)
  assert.deepEqual(world, before)
})

test.concurrent('containers promote endpoints once and route labels stay in world geometry', () => {
  const world = shopWorld()
  const view = semanticView(world, {
    level: 'containers',
    focusId: 'observed:shop',
  })

  assert.deepEqual(view.focusScope, {
    level: 'containers',
    focusId: 'observed:shop',
  })
  assert.ok(view.selectionTargets.some(target => target.id === 'api'))
  assert.ok(view.selectionTargets.every(target => target.role !== 'underlay'))

  const uses = route(view, 'uses')
  assert.deepEqual(
    [uses.source, uses.target],
    ['observed:api', 'observed:web'],
  )
  assert.notDeepEqual(uses.route, world.relationships[1]!.route)
  assert.ok(uses.route.length >= 2)
  assert.ok(uses.label)
  assert.ok(view.routes.every(entry => {
    return view.selectionTargets.some(target => target.representationId === entry.source)
      && view.selectionTargets.some(target => target.representationId === entry.target)
  }))
})

test.concurrent('components keep the entered boundary anchor and promote to the visible component', () => {
  const world = shopWorld()
  const view = semanticView(world, {
    level: 'components',
    focusId: 'observed:web',
  })
  const web = item(view, 'web')
  assert.equal(web.role, 'campus')
  assert.deepEqual(web.bounds, worldOf(world, 'web').bounds)
  assert.ok(view.selectionTargets.some(target => target.id === 'page'))
  assert.ok(view.selectionTargets.every(target => target.role !== 'underlay'))

  const uses = route(view, 'uses')
  assert.deepEqual(
    [uses.source, uses.target],
    ['observed:shop', 'observed:page'],
  )
  assert.ok(uses.route.length >= 2)
  for (let index = 1; index < uses.route.length; index += 1) {
    const previous = uses.route[index - 1]!
    const point = uses.route[index]!
    assert.ok(previous.x === point.x || previous.y === point.y)
  }
})

test.concurrent('semantic city reads a frozen fixture without changing world geometry', () => {
  const world = shopWorld()
  const before = structuredClone(world)
  deepFreeze(world)

  const context = semanticView(world, { level: 'context' })
  const containers = semanticView(world, {
    level: 'containers',
    focusId: 'observed:shop',
  })
  const components = semanticView(world, {
    level: 'components',
    focusId: 'observed:web',
  })

  assert.ok(context.routes.length > 0)
  assert.ok(containers.routes.length > 0)
  assert.ok(components.routes.length > 0)
  assert.deepEqual(world, before)
})
