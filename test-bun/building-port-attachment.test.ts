import assert from 'node:assert/strict'

import { test } from 'bun:test'

import { assignFixedPorts, ROUTE_UNIT, type Endpoint } from '../src/sheet/route-geometry.ts'
import { routeAll } from '../src/sheet/route.ts'
import type { Building, SheetScene } from '../src/sheet/types.ts'
import { projectScene } from '../src/viewers/web/iso/project.ts'
import type { Point } from '../src/types.ts'

function tower(): Building {
  return {
    representationId: 'tower', id: 'tower', title: 'Tower', origin: 'observed',
    kind: 'component', external: false, surface: 'surface',
    rect: { gx: 4, gy: 4, w: 4, d: 4 }, heightUnits: 4.5,
    shape: { kind: 'block' }, lines: ['Tower'],
    floors: [
      { files: ['base.ts'], facadeFileType: '.ts', heightUnits: 3, footprint: { w: 4, d: 4 } },
      { files: ['top.ts'], facadeFileType: '.ts', heightUnits: 1.5, footprint: { w: 4, d: 3 } },
    ],
  }
}

function endpoint(building: Building): Endpoint {
  return { key: building.id, kind: 'building', rect: building.rect, roof: building.heightUnits }
}

function portsFor(building: Endpoint, count: number) {
  const destinations: Endpoint[] = [
    { key: 'north', kind: 'building', rect: { gx: 4, gy: -20, w: 4, d: 4 } },
    { key: 'east', kind: 'building', rect: { gx: 30, gy: 4, w: 4, d: 4 } },
    { key: 'south', kind: 'building', rect: { gx: 4, gy: 30, w: 4, d: 4 } },
    { key: 'west', kind: 'building', rect: { gx: -20, gy: 4, w: 4, d: 4 } },
  ]
  const requests = destinations.flatMap(target => Array.from({ length: count }, (_, index) => ({
    id: `${target.key}:${index}`, source: building.key, target: target.key,
    description: 'Uses', origin: 'observed' as const,
  })))
  const endpoints = new Map([building, ...destinations].map(value => [value.key, value]))
  return [...assignFixedPorts(endpoints, requests).values()].map(pair => pair.source!)
}

function distanceToEdge(point: Point, from: Point, to: Point): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const fraction = Math.max(0, Math.min(1,
    ((point.x - from.x) * dx + (point.y - from.y) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(point.x - from.x - fraction * dx, point.y - from.y - fraction * dy)
}

test.concurrent('additional building ports subdivide the usable edge span without moving toward corners', () => {
  const building = endpoint(tower())
  const initial = portsFor(building, 3)
  const busy = portsFor(building, 12)
  for (const side of ['north', 'east', 'south', 'west'] as const) {
    const axis = side === 'north' || side === 'south' ? 'x' : 'y'
    const coordinates = (ports: typeof initial) => ports.filter(port => port.side === side).map(port => port.wall[axis])
    const before = coordinates(initial)
    const after = coordinates(busy)
    assert.equal(new Set(after).size, 12)
    assert.equal(Math.min(...after), Math.min(...before))
    assert.equal(Math.max(...after), Math.max(...before))
  }
})

test.concurrent('busy stepped-tower ports meet visible faces with distinct tips clear of their corners', () => {
  const building = tower()
  const ports = portsFor(endpoint(building), 12)
  const cell = (point: Point) => ({ gx: point.x / ROUTE_UNIT, gy: point.y / ROUTE_UNIT })
  const scene: SheetScene = {
    sheet: { gx: 0, gy: 0, w: 12, d: 12 }, islands: [], zones: [], slabs: [], buildings: [building],
    routes: ports.map((port, index) => ({
      id: `route:${index}`, source: 'other', target: building.id, description: 'Uses', origin: 'observed',
      points: [cell(port.guard), cell(port.wall)],
    })),
  }
  const original = structuredClone(scene)
  const projected = projectScene(scene)
  const faces = projected.buildings[0]!.floors.flat()
  for (const { arrow, route } of projected.routes) {
    const distance = Math.min(...faces.flatMap(face => face.points.map((from, index) =>
      distanceToEdge(arrow.at, from, face.points[(index + 1) % face.points.length]!))))
    assert.ok(distance < 1e-8, `${route.id} misses the visible building`)
    assert.ok(faces.every(face => face.points.every(point =>
      Math.hypot(point.x - arrow.at.x, point.y - arrow.at.y) > 1e-8)), `${route.id} meets a corner`)
  }
  assert.equal(new Set(projected.routes.map(route => JSON.stringify(route.arrow.at))).size, ports.length)
  assert.deepEqual(scene, original)
})

test.concurrent('parallel connections approach their walls directly without a final sideways snap', () => {
  const endpoints = new Map<string, Endpoint>([
    ['source', { key: 'source', kind: 'building', rect: { gx: 0, gy: 0, w: 3, d: 2 }, roof: 2 }],
    ['target', { key: 'target', kind: 'building', rect: { gx: 8, gy: 0.75, w: 3, d: 2 }, roof: 3.5 }],
  ])
  const requests = Array.from({ length: 8 }, (_, index) => ({
    id: `route:${index}`, source: 'source', target: 'target', description: 'Uses', origin: 'observed' as const,
  }))
  const routes = routeAll(endpoints, requests)
  assert.equal(routes.length, requests.length)
  for (const route of routes) {
    const [start, next] = route.points
    const end = route.points.at(-1)!
    const previous = route.points.at(-2)!
    assert.ok(Math.abs(start!.gy - next!.gy) < 1e-8, `${route.id} leaves along the source wall`)
    assert.ok(next!.gx > start!.gx)
    assert.ok(Math.abs(end.gy - previous.gy) < 1e-8, `${route.id} arrives along the target wall`)
    assert.ok(end.gx > previous.gx)
  }
})

test.concurrent('shortcuts leave and enter a stepped roof away from its visible corners', () => {
  const source: Building = {
    ...tower(), id: 'source', representationId: 'source',
    rect: { gx: 10, gy: 20, w: 4, d: 3 }, heightUnits: 3.5,
    floors: [
      { files: ['base.ts'], facadeFileType: '.ts', heightUnits: 2, footprint: { w: 4, d: 3 } },
      { files: ['top.ts'], facadeFileType: '.ts', heightUnits: 1.5, footprint: { w: 3, d: 2 } },
    ],
  }
  const target: Building = {
    ...tower(), id: 'target', representationId: 'target',
    rect: { gx: 3, gy: 4, w: 5, d: 2 }, heightUnits: 3,
    floors: [{ files: ['target.ts'], facadeFileType: '.ts', heightUnits: 3, footprint: { w: 5, d: 2 } }],
  }
  const buildings = [source, target]
  const endpoints = new Map(buildings.map(building => [building.id, endpoint(building)]))
  for (const [from, to] of [[source, target], [target, source]]) {
    const routes = routeAll(endpoints, [{
      id: 'interaction', source: from!.id, target: to!.id, description: '', origin: 'observed',
    }])
    const scene = projectScene({
      sheet: { gx: 0, gy: 0, w: 20, d: 30 }, islands: [], zones: [], slabs: [], buildings, routes,
    })
    const route = scene.routes[0]!
    for (const [id, tip] of [[from!.id, route.points[0]!], [to!.id, route.points.at(-1)!]] as const) {
      const faces = scene.buildings.find(item => item.building.id === id)!.floors.flat()
      assert.ok(faces.every(face => face.points.every(corner =>
        Math.hypot(corner.x - tip.x, corner.y - tip.y) >= 4)), `${id} port meets a visible corner`)
      assert.ok(faces.some(face => face.points.some((a, i) =>
        distanceToEdge(tip, a, face.points[(i + 1) % face.points.length]!) < 1e-8)))
    }
  }
})
