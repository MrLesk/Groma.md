import assert from 'node:assert/strict'

import { test } from 'bun:test'

import { loadArchitectureViewModel } from '../src/core.ts'
import { RING } from '../src/sheet/forces.ts'
import { LANES, ROOF_SHADOW } from '../src/sheet/grid.ts'
import { routeAll } from '../src/sheet/route.ts'
import type { Endpoint } from '../src/sheet/route.ts'
import { sheetScene } from '../src/sheet/scene.ts'
import type { CellRect, Route, RoutePoint, SheetScene } from '../src/sheet/types.ts'
import type { ArchitectureWorld, WorldElement } from '../src/types.ts'
import { box, openclawFixtureRoot, uses, viewerFixtureRoot, worldOf } from './helpers.ts'

const unit = { x: 0, y: 0, width: 1, height: 1 }

function onBoundary(point: RoutePoint, rect: CellRect): boolean {
  const onX = point.gx === rect.gx || point.gx === rect.gx + rect.w
  const onY = point.gy === rect.gy || point.gy === rect.gy + rect.d
  const withinX = point.gx >= rect.gx && point.gx <= rect.gx + rect.w
  const withinY = point.gy >= rect.gy && point.gy <= rect.gy + rect.d
  return (onX && withinY) || (onY && withinX)
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
      nodes.push({ gx: from.gx + dx * step, gy: from.gy + dy * step })
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

/** Whether a route turns back through the one-cell band around its fixed half-cell departure. */
function reentersDepartureBand(route: Route): boolean {
  const nodes = laneNodes(route)
  const dx = Math.sign(nodes[1]!.gx - nodes[0]!.gx)
  const dy = Math.sign(nodes[1]!.gy - nodes[0]!.gy)
  const departure = nodes[LANES / 2]!
  const fixed = new Set(nodes.slice(0, LANES / 2).map(node => `${node.gx},${node.gy}`))
  let leftBand = false
  return nodes.slice(LANES / 2 + 1).some((node, index) => {
    if (fixed.has(`${node.gx},${node.gy}`)) return true
    const previous = nodes[index + LANES / 2]!
    const opposite = Math.sign(node.gx - previous.gx) === -dx && Math.sign(node.gy - previous.gy) === -dy
    const behind = dx > 0 ? node.gx <= departure.gx : dx < 0 ? node.gx >= departure.gx
      : dy > 0 ? node.gy <= departure.gy : node.gy >= departure.gy
    const across = dx === 0 ? Math.abs(node.gx - departure.gx) : Math.abs(node.gy - departure.gy)
    const distance = Math.max(Math.abs(node.gx - departure.gx), Math.abs(node.gy - departure.gy))
    if (distance > 1) leftBand = true
    return (opposite && behind && across <= 1) || (leftBand && distance <= 1)
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

test.concurrent('one lattice route per authored relationship, Manhattan, on quarter lanes and without retracing', async () => {
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
      const changed = [from.gx !== to.gx, from.gy !== to.gy].filter(Boolean).length
      assert.equal(changed, 1)
    }
    const edges = laneEdges(route)
    assert.equal(new Set(edges).size, edges.length, `${route.id} retraces a lane`)
  }
})

/** The ground point whose screen position is the middle of a roof edge lies this far behind the edge along both axes. */
function roofShadow(building: { floors: number }): number {
  return Math.floor(building.floors * ROOF_SHADOW * LANES) / LANES
}

/** The port a route end stands for: the point itself on the boundary, or the back-side port whose roof shadow it lies in. */
function portOf(scene: SheetScene, point: RoutePoint, key: string): RoutePoint {
  const { rect } = rectOf(scene, key)
  if (onBoundary(point, rect)) return point
  const building = scene.buildings.find(item => item.representationId === key)
  const shadow = building === undefined ? 0 : roofShadow(building)
  return { gx: point.gx + shadow, gy: point.gy + shadow }
}

test.concurrent('routes start and end on a side of their ends, back sides just behind the roof edge', async () => {
  const { scene } = await fixtureScene(viewerFixtureRoot)
  for (const route of scene.routes) {
    const source = rectOf(scene, route.source).rect
    const target = rectOf(scene, route.target).rect
    const first = route.points[0]!
    const last = route.points[route.points.length - 1]!
    const start = portOf(scene, first, route.source)
    const end = portOf(scene, last, route.target)
    assert.equal(onBoundary(start, source), true, `${route.id} starts off its source`)
    assert.equal(onBoundary(end, target), true, `${route.id} ends off its target`)
    if (start !== first) assert.ok(start.gx === source.gx || start.gy === source.gy)
    if (end !== last) assert.ok(end.gx === target.gx || end.gy === target.gy)
    assert.equal(isCorner(start, source), false)
    assert.equal(isCorner(end, target), false)
    for (const point of [start, end]) {
      assert.equal(Number.isInteger(point.gx * 2) && Number.isInteger(point.gy * 2), true)
    }
  }
})

test.concurrent('a route arrives pointing into the side it enters', async () => {
  const { scene } = await fixtureScene(viewerFixtureRoot)
  for (const route of scene.routes) {
    const { rect } = rectOf(scene, route.target)
    const points = route.points
    const last = points[points.length - 1]!
    const before = points[points.length - 2]!
    const end = portOf(scene, last, route.target)
    const inward = end.gx === rect.gx ? [1, 0] : end.gx === rect.gx + rect.w ? [-1, 0] : end.gy === rect.gy ? [0, 1] : [0, -1]
    assert.deepEqual([Math.sign(last.gx - before.gx), Math.sign(last.gy - before.gy)], inward, route.id)
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
    const ends = [portOf(scene, route.points[0]!, route.source), portOf(scene, route.points[route.points.length - 1]!, route.target)]
    for (const point of ends) {
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

test.concurrent('two components of one container stay inside it', () => {
  const scene = sheetScene(worldOf([
    box('shop', 'system', unit),
    box('api', 'container', unit, { parent: 'observed:shop' }),
    box('orders', 'component', unit, { parent: 'observed:api' }),
    box('pricing', 'component', unit, { parent: 'observed:api' }),
  ], [uses('relationship:0', 'orders', 'pricing')]))
  const slab = scene.slabs[0]!.rect
  for (const point of scene.routes[0]!.points) assert.equal(strictlyInside(point, slab), true)
})

test.concurrent('parallel routes fan out over distinct ports and lanes', () => {
  const scene = sheetScene(worldOf([
    box('shop', 'system', unit),
    box('api', 'container', unit, { parent: 'observed:shop' }),
    box('a', 'component', unit, { parent: 'observed:api' }),
    box('b', 'component', unit, { parent: 'observed:api' }),
  ], [0, 1, 2].map(index => uses(`relationship:${index}`, 'a', 'b'))))
  const target = rectOf(scene, 'observed:b').rect
  const starts = new Set(scene.routes.map(route => `${route.points[0]!.gx},${route.points[0]!.gy}`))
  const ends = new Set(scene.routes.map(route => {
    const last = portOf(scene, route.points[route.points.length - 1]!, 'observed:b')
    assert.equal(onBoundary(last, target), true)
    return `${last.gx},${last.gy}`
  }))
  assert.equal(starts.size, 3)
  assert.equal(ends.size, 3)
  const edges = scene.routes.flatMap(laneEdges)
  assert.equal(new Set(edges).size, edges.length)
})

test.concurrent('a route leaves its source on the side facing the target', () => {
  const scene = sheetScene(worldOf([
    box('shop', 'system', unit),
    box('api', 'container', unit, { parent: 'observed:shop' }),
    box('a', 'component', unit, { parent: 'observed:api' }),
    box('b', 'component', unit, { parent: 'observed:api' }),
  ], [uses('relationship:0', 'b', 'a'), uses('relationship:1', 'a', 'b')]))
  const a = rectOf(scene, 'observed:a').rect
  const b = rectOf(scene, 'observed:b').rect
  assert.ok(b.gx >= a.gx + a.w)
  const shadow = roofShadow(scene.buildings.find(item => item.id === 'b')!)
  assert.ok(shadow > 0)
  const westward = scene.routes[0]!.points
  assert.equal(westward[0]!.gx, b.gx - shadow)
  assert.equal(westward[0]!.gy, b.gy + b.d / 2 - shadow)
  const arrival = westward[westward.length - 1]!
  assert.equal(arrival.gx, a.gx + a.w)
  assert.ok(Math.abs(arrival.gy - (a.gy + a.d / 2)) <= shadow)
  const eastward = scene.routes[1]!.points[0]!
  assert.equal(eastward.gx, a.gx + a.w)
  assert.ok(Math.abs(eastward.gy - (a.gy + a.d / 2)) <= 0.5)
})

test.concurrent('route repulsion cannot bend a route back through its departure band', () => {
  const endpoints = new Map<string, Endpoint>([
    ['source', { key: 'source', kind: 'building', rect: { gx: 11, gy: 6, w: 2, d: 2 }, within: [], roof: 1 }],
    ['target', { key: 'target', kind: 'building', rect: { gx: 11, gy: 3, w: 2, d: 2 }, within: [], roof: 1 }],
    ['repeller', { key: 'repeller', kind: 'building', rect: { gx: 8, gy: 6, w: 2, d: 2 }, within: [], roof: 1 }],
    ['far', { key: 'far', kind: 'building', rect: { gx: 2, gy: 9, w: 2, d: 2 }, within: [], roof: 1 }],
  ])
  const requests = [['repeller', 'far'], ['source', 'target'], ['source', 'target']].map(([source, target], index) => ({
    id: `relationship:${index}`, source: source!, target: target!, description: 'uses', origin: 'observed' as const,
  }))
  for (const route of routeAll({ gx: 0, gy: 0, w: 16, d: 16 }, endpoints, requests)) {
    assert.equal(reentersDepartureBand(route), false, `${route.id} re-enters its departure band`)
  }
})

test.concurrent('a full-cell departure guards the band around its fixed half-cell approach', () => {
  const endpoints = new Map<string, Endpoint>([
    ['source', { key: 'source', kind: 'building', rect: { gx: 5, gy: 7, w: 3, d: 2 }, within: [], roof: 2 }],
    ['target', { key: 'target', kind: 'building', rect: { gx: 10, gy: 7, w: 3, d: 2 }, within: [], roof: 2 }],
    ['north', { key: 'north', kind: 'building', rect: { gx: 6, gy: 3, w: 4, d: 2 }, within: [], roof: 3 }],
    ['south', { key: 'south', kind: 'building', rect: { gx: 5, gy: 11, w: 2, d: 2 }, within: [], roof: 1 }],
  ])
  const [route] = routeAll({ gx: 0, gy: 0, w: 20, d: 16 }, endpoints, [
    { id: 'relationship:0', source: 'source', target: 'target', description: '', origin: 'observed' },
  ])
  assert.equal(reentersDepartureBand(route!), false)
})

test.concurrent('a fixed departure cannot be entered from its side and retraced', () => {
  const endpoints = new Map<string, Endpoint>([
    ['source', { key: 'source', kind: 'building', rect: { gx: 9, gy: 5, w: 3, d: 4 }, within: [], roof: 1, centrePorts: true }],
    ['south', { key: 'south', kind: 'building', rect: { gx: 4, gy: 15, w: 3, d: 3 }, within: [], roof: 1 }],
    ['east', { key: 'east', kind: 'building', rect: { gx: 13, gy: 9, w: 3, d: 2 }, within: [], roof: 1 }],
  ])
  const routes = routeAll({ gx: 0, gy: 0, w: 20, d: 20 }, endpoints, ['south', 'east'].map((target, index) => ({
    id: `relationship:${index}`, source: 'source', target, description: 'uses', origin: 'observed' as const,
  })))
  for (const route of routes) {
    assert.equal(reentersDepartureBand(route), false)
    assert.equal(new Set(laneEdges(route)).size, laneEdges(route).length)
  }
})

test.concurrent('a route holds a cell off a building it only passes, when it has the room', () => {
  // the wall stands between a and b with the whole south of the sheet free, so the route rounds it with room to spare
  const wall = { gx: 8, gy: 4, w: 2, d: 6 }
  const endpoints = new Map<string, Endpoint>([
    ['a', { key: 'a', kind: 'building', rect: { gx: 2, gy: 9, w: 2, d: 2 }, within: [], roof: 1 }],
    ['b', { key: 'b', kind: 'building', rect: { gx: 16, gy: 9, w: 2, d: 2 }, within: [], roof: 1 }],
    ['wall', { key: 'wall', kind: 'building', rect: wall, within: [], roof: 1 }],
  ])
  const [route] = routeAll({ gx: 0, gy: 0, w: 20, d: 20 }, endpoints, [
    { id: 'relationship:0', source: 'a', target: 'b', description: 'uses', origin: 'observed' },
  ])
  for (const point of laneNodes(route!)) {
    assert.equal(strictlyInside(point, wall, 1), false, 'the route grazes the wall it passes')
  }
})

test.concurrent('passing clearance does not push parallel routes off their own facing side', () => {
  const endpoints = new Map<string, Endpoint>([
    ['a', { key: 'a', kind: 'building', rect: { gx: 8, gy: 8, w: 2, d: 2 }, within: [], roof: 1 }],
    ['b', { key: 'b', kind: 'building', rect: { gx: 12, gy: 8, w: 2, d: 2 }, within: [], roof: 1 }],
  ])
  const routes = routeAll({ gx: 0, gy: 0, w: 22, d: 22 }, endpoints, [0, 1, 2].map(index => ({
    id: `relationship:${index}`, source: 'a', target: 'b', description: '', origin: 'observed',
  })))
  for (const route of routes) assert.equal(route.points[0]!.gx, 10)
})

test.concurrent('a crowded facing corridor lets a clear departure run one cell before turning', () => {
  const endpoints = new Map<string, Endpoint>([
    ['source', { key: 'source', kind: 'building', rect: { gx: 4, gy: 14, w: 4, d: 4 }, within: [], roof: 1 }],
    ['north', { key: 'north', kind: 'building', rect: { gx: 4, gy: 9, w: 4, d: 4 }, within: [], roof: 1 }],
    ['east', { key: 'east', kind: 'building', rect: { gx: 9, gy: 14, w: 2, d: 4 }, within: [], roof: 1 }],
    ['target', { key: 'target', kind: 'building', rect: { gx: 14, gy: 1, w: 2, d: 2 }, within: [], roof: 1 }],
  ])
  const [route] = routeAll({ gx: 0, gy: 0, w: 20, d: 18 }, endpoints, [
    { id: 'relationship:0', source: 'source', target: 'target', description: '', origin: 'observed' },
  ])
  const [start, turn, north] = route!.points
  assert.ok(start!.gx < 4)
  assert.deepEqual(turn, { gx: start!.gx - 1, gy: start!.gy })
  assert.ok(north!.gx === turn!.gx && north!.gy < turn!.gy)
})

test.concurrent('a busy target keeps one full cell straight after its final bend', () => {
  const endpoints = new Map<string, Endpoint>([
    ['blocker', { key: 'blocker', kind: 'building', rect: { gx: 4, gy: 9, w: 3, d: 3 }, within: [], roof: 1 }],
    ['source', { key: 'source', kind: 'building', rect: { gx: 9, gy: 10, w: 2, d: 2 }, within: [], roof: 1 }],
    ['target', { key: 'target', kind: 'building', rect: { gx: 4, gy: 14, w: 3, d: 2 }, within: [], roof: 1 }],
    ['east', { key: 'east', kind: 'building', rect: { gx: 20, gy: 13, w: 3, d: 2 }, within: [], roof: 1 }],
  ])
  const routes = routeAll({ gx: 0, gy: 0, w: 26, d: 25 }, endpoints, [
    { id: 'relationship:0', source: 'target', target: 'east', description: '', origin: 'observed' },
    { id: 'relationship:1', source: 'source', target: 'target', description: '', origin: 'observed' },
  ])
  const points = routes.at(-1)!.points
  const last = points.at(-1)!
  const bend = points.at(-2)!
  assert.ok(Math.abs(last.gx - bend.gx) + Math.abs(last.gy - bend.gy) >= 1)
  const edges = routes.flatMap(laneEdges)
  assert.equal(new Set(edges).size, edges.length)
})

test.concurrent('a route crosses a surface border instead of running along it', async () => {
  const { scene } = await fixtureScene(viewerFixtureRoot)
  const borders = [...scene.slabs, ...scene.islands].map(surface => surface.rect)
  const onBorder = (point: RoutePoint, rect: CellRect): boolean => {
    const withinX = point.gx >= rect.gx && point.gx <= rect.gx + rect.w
    const withinY = point.gy >= rect.gy && point.gy <= rect.gy + rect.d
    return (withinY && (point.gx === rect.gx || point.gx === rect.gx + rect.w))
      || (withinX && (point.gy === rect.gy || point.gy === rect.gy + rect.d))
  }
  for (const route of scene.routes) {
    let along = 0
    for (const node of laneNodes(route)) {
      along = borders.some(rect => onBorder(node, rect)) ? along + 1 : 0
      assert.ok(along <= 1, `${route.id} runs along a surface border`)
    }
  }
})

test.concurrent('an actor reaches a component inside a container on the one ground plane', () => {
  const scene = sheetScene(worldOf([
    box('buyer', 'actor', unit),
    box('shop', 'system', unit),
    box('api', 'container', unit, { parent: 'observed:shop' }),
    box('orders', 'component', unit, { parent: 'observed:api' }),
  ], [uses('relationship:0', 'buyer', 'orders')]))
  const { points } = scene.routes[0]!
  const slab = scene.slabs[0]!.rect
  assert.equal(strictlyInside(points[0]!, slab), false)
  assert.equal(strictlyInside(points[points.length - 1]!, slab), true)
  assert.equal(onBoundary(portOf(scene, points[points.length - 1]!, 'observed:orders'), rectOf(scene, 'observed:orders').rect), true)
  for (let index = 1; index < points.length; index += 1) {
    const same = points[index - 1]!.gx === points[index]!.gx && points[index - 1]!.gy === points[index]!.gy
    assert.equal(same, false)
  }
})

test.concurrent('routes leave and arrive at the middle of a side, and parallel routes spread around it', () => {
  const elements = (): WorldElement[] => [
    box('shop', 'system', unit),
    box('api', 'container', unit, { parent: 'observed:shop' }),
    box('a', 'component', unit, { parent: 'observed:api' }),
    box('b', 'component', unit, { parent: 'observed:api' }),
  ]
  const single = sheetScene(worldOf(elements(), [uses('relationship:0', 'a', 'b')]))
  const a = rectOf(single, 'observed:a').rect
  const b = rectOf(single, 'observed:b').rect
  const shadow = roofShadow(single.buildings.find(item => item.id === 'b')!)
  const first = single.routes[0]!.points[0]!
  assert.equal(first.gx, a.gx + a.w)
  assert.ok(Math.abs(first.gy - (a.gy + a.d / 2)) <= shadow)
  const last = portOf(single, single.routes[0]!.points[single.routes[0]!.points.length - 1]!, 'observed:b')
  assert.equal(last.gx, b.gx)
  assert.ok(Math.abs(last.gy - (b.gy + b.d / 2)) <= shadow)
  const fan = sheetScene(worldOf(elements(), [0, 1, 2].map(index => uses(`relationship:${index}`, 'a', 'b'))))
  const starts = fan.routes.map(route => route.points[0]!.gy - (a.gy + a.d / 2))
  const ends = fan.routes.map(route => portOf(fan, route.points[route.points.length - 1]!, 'observed:b').gy - (b.gy + b.d / 2))
  assert.equal(new Set(starts).size, 3)
  assert.equal(new Set(ends).size, 3)
  for (const offset of [...starts, ...ends]) assert.ok(Math.abs(offset) <= 1)
})

test.concurrent('a system reaches an external system along the sheet', async () => {
  const { scene } = await fixtureScene(viewerFixtureRoot)
  const route = scene.routes.find(item => item.source === 'observed:shop' && item.target === 'observed:vault')!
  assert.ok(route)
  assert.equal(onBoundary(route.points[0]!, rectOf(scene, 'observed:shop').rect), true)
  assert.equal(onBoundary(portOf(scene, route.points[route.points.length - 1]!, 'observed:vault'), rectOf(scene, 'observed:vault').rect), true)
})

test.concurrent('running out of ports fails loudly', () => {
  assert.throws(() => sheetScene(worldOf([
    box('shop', 'system', unit),
    box('api', 'container', unit, { parent: 'observed:shop' }),
    box('a', 'component', unit, { parent: 'observed:api' }),
    box('b', 'component', unit, { parent: 'observed:api' }),
  ], Array.from({ length: 17 }, (_, index) => uses(`relationship:${index}`, 'a', 'b')))), /relationship:16/)
})

test.concurrent('a hub hands each route its own port', async () => {
  const { scene } = await fixtureScene(openclawFixtureRoot)
  const portsOn = (key: string): string[] => {
    const { rect } = rectOf(scene, key)
    const building = scene.buildings.find(item => item.representationId === key)
    return scene.routes.flatMap(route => {
      const ends = [
        route.source === key ? portOf(scene, route.points[0]!, key) : undefined,
        route.target === key ? portOf(scene, route.points[route.points.length - 1]!, key) : undefined,
      ]
      return ends.filter((point): point is RoutePoint => point !== undefined && onBoundary(point, rect))
        .map(point => `${point.gx},${point.gy}`)
    })
  }
  for (const key of ['observed:operator', 'observed:gateway']) {
    const ports = portsOn(key)
    assert.equal(ports.length, 5)
    assert.equal(new Set(ports).size, 5)
  }
})
