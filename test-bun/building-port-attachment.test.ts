import assert from 'node:assert/strict'

import { test } from 'bun:test'

import { buildingPorts, ROUTE_UNIT, type Endpoint } from '../src/sheet/route-geometry.ts'
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

function distanceToEdge(point: Point, from: Point, to: Point): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const fraction = Math.max(0, Math.min(1,
    ((point.x - from.x) * dx + (point.y - from.y) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(point.x - from.x - fraction * dx, point.y - from.y - fraction * dy)
}

test.concurrent('additional building ports subdivide the usable edge span without moving toward corners', () => {
  const building = endpoint(tower())
  const initial = buildingPorts(building)
  const busy = buildingPorts(building, 12)
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
  const ports = buildingPorts(endpoint(building), 12)
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

test.concurrent('nudged parallel connections approach their walls directly without a final sideways snap', () => {
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
