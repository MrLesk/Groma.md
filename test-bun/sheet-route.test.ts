import assert from 'node:assert/strict'

import { test } from 'bun:test'

import { loadArchitectureViewModel } from '../src/core.ts'
import { LANES, SLAB_RISE } from '../src/sheet/grid.ts'
import { RING } from '../src/sheet/route.ts'
import { sheetScene } from '../src/sheet/scene.ts'
import type { CellRect, Route, RoutePoint, SheetScene } from '../src/sheet/types.ts'
import type { ArchitectureWorld, WorldElement, WorldRelationship } from '../src/types.ts'
import { box, openclawFixtureRoot, viewerFixtureRoot } from './helpers.ts'

const unit = { x: 0, y: 0, width: 1, height: 1 }

function world(elements: WorldElement[], relationships: WorldRelationship[] = []): ArchitectureWorld {
  return { bounds: unit, elements, groups: [], relationships }
}

function uses(id: string, source: string, target: string): WorldRelationship {
  return {
    id,
    source: `observed:${source}`,
    target: `observed:${target}`,
    description: 'uses',
    technology: '',
    origin: 'observed',
    route: [],
    label: null,
  }
}

function onBoundary(point: RoutePoint, rect: CellRect): boolean {
  const onX = point.gx === rect.gx || point.gx === rect.gx + rect.w
  const onY = point.gy === rect.gy || point.gy === rect.gy + rect.d
  const withinX = point.gx >= rect.gx && point.gx <= rect.gx + rect.w
  const withinY = point.gy >= rect.gy && point.gy <= rect.gy + rect.d
  return (onX && withinY) || (onY && withinX)
}

function onFrontSide(point: RoutePoint, rect: CellRect): boolean {
  return onBoundary(point, rect) && (point.gx === rect.gx + rect.w || point.gy === rect.gy + rect.d)
}

function isCorner(point: RoutePoint, rect: CellRect): boolean {
  return (point.gx === rect.gx || point.gx === rect.gx + rect.w)
    && (point.gy === rect.gy || point.gy === rect.gy + rect.d)
}

function strictlyInside(point: RoutePoint, rect: CellRect, margin = 0): boolean {
  return point.gx > rect.gx - margin && point.gx < rect.gx + rect.w + margin
    && point.gy > rect.gy - margin && point.gy < rect.gy + rect.d + margin
}

/** Every lattice node a route passes, one lane apart, risers ignored. */
function laneNodes(route: Route): RoutePoint[] {
  const nodes: RoutePoint[] = [route.points[0]!]
  for (let index = 1; index < route.points.length; index += 1) {
    const from = route.points[index - 1]!
    const to = route.points[index]!
    if (from.gx === to.gx && from.gy === to.gy) continue
    const steps = Math.round((Math.abs(to.gx - from.gx) + Math.abs(to.gy - from.gy)) * LANES)
    const dx = Math.sign(to.gx - from.gx) / LANES
    const dy = Math.sign(to.gy - from.gy) / LANES
    for (let step = 1; step <= steps; step += 1) {
      nodes.push({ gx: from.gx + dx * step, gy: from.gy + dy * step, z: to.z })
    }
  }
  return nodes
}

/** Unit lane steps of a route, ignoring risers. */
function laneEdges(route: Route): string[] {
  const nodes = laneNodes(route)
  return nodes.slice(1).map((node, index) => {
    const a = `${nodes[index]!.gx},${nodes[index]!.gy}`
    const b = `${node.gx},${node.gy}`
    return a < b ? `${a}|${b}` : `${b}|${a}`
  })
}

function rectOf(scene: SheetScene, key: string): { rect: CellRect; kind: 'island' | 'slab' | 'building' } {
  const island = scene.islands.find(item => item.key === key)
  if (island) return { rect: island.rect, kind: 'island' }
  const slab = scene.slabs.find(item => item.representationId === key)
  if (slab) return { rect: slab.rect, kind: 'slab' }
  const building = scene.buildings.find(item => item.representationId === key)
  assert.ok(building, `no footprint for ${key}`)
  return { rect: building.rect, kind: 'building' }
}

async function fixtureScene(root: string): Promise<{ scene: SheetScene; world: ArchitectureWorld }> {
  const { world: fixture } = await loadArchitectureViewModel(root)
  return { scene: sheetScene(fixture), world: fixture }
}

test.concurrent('one lattice route per authored relationship, Manhattan and on quarter lanes', async () => {
  const { scene, world: fixture } = await fixtureScene(viewerFixtureRoot)
  assert.deepEqual(scene.routes.map(route => route.id), fixture.relationships.map(item => item.id))
  for (const route of scene.routes) {
    assert.ok(route.points.length >= 2)
    for (const point of route.points) {
      assert.equal(Number.isInteger(point.gx * LANES), true)
      assert.equal(Number.isInteger(point.gy * LANES), true)
    }
    for (let index = 1; index < route.points.length; index += 1) {
      const from = route.points[index - 1]!
      const to = route.points[index]!
      const changed = [from.gx !== to.gx, from.gy !== to.gy, from.z !== to.z].filter(Boolean).length
      assert.equal(changed, 1)
    }
  }
})

test.concurrent('routes start on the source perimeter and enter 3D targets on a front side', async () => {
  const { scene } = await fixtureScene(viewerFixtureRoot)
  for (const route of scene.routes) {
    const source = rectOf(scene, route.source)
    const target = rectOf(scene, route.target)
    const first = route.points[0]!
    const last = route.points[route.points.length - 1]!
    assert.equal(onBoundary(first, source.rect), true)
    assert.equal(isCorner(first, source.rect), false)
    assert.equal(target.kind === 'island' ? onBoundary(last, target.rect) : onFrontSide(last, target.rect), true)
    assert.equal(isCorner(last, target.rect), false)
    for (const point of [first, last]) {
      assert.equal(Number.isInteger(point.gx * 2) && Number.isInteger(point.gy * 2), true)
    }
  }
})

test.concurrent('routes keep one lane clear of foreign buildings and unrelated slabs', async () => {
  for (const root of [viewerFixtureRoot, openclawFixtureRoot]) {
    const { scene } = await fixtureScene(root)
    const islandOfSlab = new Map(scene.slabs.map(slab => [slab.representationId, slab.island]))
    for (const route of scene.routes) {
      const ends = new Set([route.source, route.target])
      const related = new Set<string>()
      for (const end of ends) {
        const building = scene.buildings.find(item => item.representationId === end)
        if (building) {
          related.add(building.surface)
          related.add(islandOfSlab.get(building.surface) ?? building.surface)
        }
      }
      for (const point of laneNodes(route)) {
        for (const building of scene.buildings) {
          if (ends.has(building.representationId)) continue
          assert.equal(strictlyInside(point, building.rect, RING / LANES), false,
            `${route.id} touches ${building.id}`)
        }
        for (const slab of scene.slabs) {
          if (ends.has(slab.representationId) || related.has(slab.representationId)) continue
          assert.equal(strictlyInside(point, slab.rect, RING / LANES), false, `${route.id} crosses ${slab.id}`)
        }
      }
    }
  }
})

test.concurrent('no two routes share a port or a lane', async () => {
  const { scene } = await fixtureScene(viewerFixtureRoot)
  const ports = new Set<string>()
  const edges = new Set<string>()
  for (const route of scene.routes) {
    for (const point of [route.points[0]!, route.points[route.points.length - 1]!]) {
      const port = `${point.gx},${point.gy}`
      assert.equal(ports.has(port), false)
      ports.add(port)
    }
    for (const edge of laneEdges(route)) {
      assert.equal(edges.has(edge), false, `${route.id} shares ${edge}`)
      edges.add(edge)
    }
  }
})

test.concurrent('routes ride the slab deck and climb exactly where the slab begins', async () => {
  const { scene } = await fixtureScene(viewerFixtureRoot)
  for (const route of scene.routes) {
    for (const [index, point] of route.points.entries()) {
      const onDeck = scene.slabs.some(slab => strictlyInside(point, slab.rect))
      const sameSpot = (other: RoutePoint | undefined): boolean =>
        other !== undefined && other.gx === point.gx && other.gy === point.gy
      const riser = sameSpot(route.points[index - 1]) || sameSpot(route.points[index + 1])
      if (riser) {
        assert.equal(scene.slabs.some(slab => onBoundary(point, slab.rect)), true)
      } else {
        assert.equal(point.z, onDeck ? SLAB_RISE : 0)
      }
    }
  }
})

test.concurrent('two components of one container stay on the deck', () => {
  const scene = sheetScene(world([
    box('shop', 'system', unit),
    box('api', 'container', unit, { parent: 'observed:shop' }),
    box('orders', 'component', unit, { parent: 'observed:api' }),
    box('pricing', 'component', unit, { parent: 'observed:api' }),
  ], [uses('relationship:0', 'orders', 'pricing')]))
  const slab = scene.slabs[0]!.rect
  for (const point of scene.routes[0]!.points) {
    assert.equal(point.z, SLAB_RISE)
    assert.equal(strictlyInside(point, slab), true)
  }
})

test.concurrent('parallel routes fan out over distinct ports and lanes', () => {
  const scene = sheetScene(world([
    box('shop', 'system', unit),
    box('api', 'container', unit, { parent: 'observed:shop' }),
    box('a', 'component', unit, { parent: 'observed:api' }),
    box('b', 'component', unit, { parent: 'observed:api' }),
  ], [0, 1, 2].map(index => uses(`relationship:${index}`, 'a', 'b'))))
  const target = rectOf(scene, 'observed:b').rect
  const starts = new Set(scene.routes.map(route => `${route.points[0]!.gx},${route.points[0]!.gy}`))
  const ends = new Set(scene.routes.map(route => {
    const last = route.points[route.points.length - 1]!
    assert.equal(onFrontSide(last, target), true)
    return `${last.gx},${last.gy}`
  }))
  assert.equal(starts.size, 3)
  assert.equal(ends.size, 3)
  const edges = scene.routes.flatMap(laneEdges)
  assert.equal(new Set(edges).size, edges.length)
})

test.concurrent('a person reaches a component by climbing its container once', () => {
  const scene = sheetScene(world([
    box('buyer', 'person', unit),
    box('shop', 'system', unit),
    box('api', 'container', unit, { parent: 'observed:shop' }),
    box('orders', 'component', unit, { parent: 'observed:api' }),
  ], [uses('relationship:0', 'buyer', 'orders')]))
  const { points } = scene.routes[0]!
  const slab = scene.slabs[0]!.rect
  assert.equal(points[0]!.z, 0)
  assert.equal(points[points.length - 1]!.z, SLAB_RISE)
  const risers = points.filter((point, index) => index > 0
    && points[index - 1]!.gx === point.gx && points[index - 1]!.gy === point.gy)
  assert.equal(risers.length, 1)
  assert.equal(onBoundary(risers[0]!, slab), true)
})

test.concurrent('a system reaches an external system along the sheet', async () => {
  const { scene } = await fixtureScene(viewerFixtureRoot)
  const route = scene.routes.find(item => item.source === 'observed:shop' && item.target === 'observed:vault')!
  assert.ok(route)
  assert.equal(onBoundary(route.points[0]!, rectOf(scene, 'observed:shop').rect), true)
  assert.equal(onFrontSide(route.points[route.points.length - 1]!, rectOf(scene, 'observed:vault').rect), true)
  for (const point of route.points) assert.equal(point.z, 0)
})

test.concurrent('running out of ports fails loudly', () => {
  assert.throws(() => sheetScene(world([
    box('shop', 'system', unit),
    box('api', 'container', unit, { parent: 'observed:shop' }),
    box('a', 'component', unit, { parent: 'observed:api' }),
    box('b', 'component', unit, { parent: 'observed:api' }),
  ], [0, 1, 2, 3, 4, 5, 6].map(index => uses(`relationship:${index}`, 'a', 'b')))), /relationship:6/)
})

test.concurrent('a hub hands each route its own port', async () => {
  const { scene } = await fixtureScene(openclawFixtureRoot)
  const portsOn = (key: string): string[] => {
    const { rect } = rectOf(scene, key)
    return scene.routes.flatMap(route => [route.points[0]!, route.points[route.points.length - 1]!]
      .filter(point => onBoundary(point, rect))
      .map(point => `${point.gx},${point.gy}`))
  }
  for (const key of ['observed:operator', 'observed:gateway']) {
    const ports = portsOn(key)
    assert.equal(ports.length, 5)
    assert.equal(new Set(ports).size, 5)
  }
})
