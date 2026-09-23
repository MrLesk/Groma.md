import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { overlaps } from '../src/sheet/grid.ts'
import { routeReach, connectionCounts, ROUTE_SPACING, ROUTE_UNIT } from '../src/sheet/route/space.ts'
import { visibleObstacle, type Endpoint, type FlatRoute } from '../src/sheet/route/geometry.ts'
import { orthogonal, sharedPathMeasure, crossingRouteIdsFor } from '../src/sheet/route/checks.ts'
import { sheetScene } from '../src/sheet/scene.ts'
import type { SheetScene } from '../src/sheet/types.ts'
import type { ArchitectureGraph } from '../src/types.ts'
import { box, uses } from './helpers.ts'

const unit = { x: 0, y: 0, width: 1, height: 1 }

function chain(connections: number): ArchitectureGraph {
  return {
    flows: [],
    elements: [
      box('person', 'actor', unit),
      box('system', 'system', unit),
      box('first', 'container', unit, { parent: 'observed:system' }),
      box('second', 'container', unit, { parent: 'observed:system' }),
      box('a', 'component', unit, {
        parent: 'observed:first', group: 'Work', code: [{ scanner: 'fixture', file: 'a.ts', lines: 50 }],
      }),
      box('b', 'component', unit, {
        parent: 'observed:second', code: [{ scanner: 'fixture', file: 'b.ts', lines: 1 }],
      }),
      box('outside', 'system', unit, { external: true }),
    ],
    relationships: [['person', 'a'], ['a', 'b'], ['b', 'outside']].flatMap(([source, target]) =>
      Array.from({ length: connections }, (_, index) => uses(`${source}:${target}:${index}`, source!, target!))),
  }
}

function endpointsOf(scene: SheetScene): Map<string, Endpoint> {
  return new Map(scene.buildings.map(building => [building.representationId, {
    key: building.representationId, kind: 'building', rect: building.rect, roof: building.heightUnits,
  }]))
}

function checkRoutes(scene: SheetScene, world: ArchitectureGraph): void {
  const routes: FlatRoute[] = scene.routes.map(route => ({
    ...route, points: route.points.map(point => ({ x: point.gx * ROUTE_UNIT, y: point.gy * ROUTE_UNIT })),
  }))
  assert.deepEqual(routes.map(route => route.id), world.relationships.map(relationship => relationship.id))
  assert.ok(routes.every(route => orthogonal(route.points)))
  assert.deepEqual(crossingRouteIdsFor(endpointsOf(scene))(routes), [])
  assert.equal(sharedPathMeasure(routes, new Set(routes.map(route => route.id)))(routes), 0)
}

test.concurrent('connection demand grows port capacity and clear routing envelopes for every building shape', () => {
  const small = sheetScene(chain(4))
  const world = chain(32)
  const before = structuredClone(world)
  const scene = sheetScene(world)
  const counts = connectionCounts(world.relationships)
  const endpoints = endpointsOf(scene)
  const envelopes = scene.buildings.map(building => {
    const count = counts.get(building.representationId)!
    // Ports occupy the middle half of a wall, with a turning margin on either side.
    assert.ok(Math.min(building.rect.w, building.rect.d) * ROUTE_UNIT / 2 >= 2 * (count - 1) * ROUTE_SPACING)
    const polygon = visibleObstacle(endpoints.get(building.representationId)!, routeReach(count) * ROUTE_UNIT)
    const xs = polygon.map(point => point.x)
    const ys = polygon.map(point => point.y)
    return { gx: Math.min(...xs), gy: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), d: Math.max(...ys) - Math.min(...ys) }
  })
  for (const [index, envelope] of envelopes.entries()) {
    assert.ok(envelopes.slice(index + 1).every(other => !overlaps(envelope, other)))
  }
  assert.ok(scene.sheet.w * scene.sheet.d > small.sheet.w * small.sheet.d)
  checkRoutes(scene, world)
  assert.deepEqual(world, before)
})

test.concurrent('dense sibling connections route every relationship without losing or overlapping any', () => {
  const count = 12
  const world: ArchitectureGraph = {
    flows: [],
    elements: [
      box('system', 'system', unit),
      box('container', 'container', unit, { parent: 'observed:system' }),
      ...Array.from({ length: count }, (_, index) =>
        box(`node${index}`, 'component', unit, { parent: 'observed:container' })),
    ],
    relationships: Array.from({ length: count }, (_, source) =>
      Array.from({ length: count - source - 1 }, (_, offset) => {
        const target = source + offset + 1
        return uses(`route:${source}:${target}`, `node${source}`, `node${target}`)
      })).flat(),
  }
  const scene = sheetScene(world)
  checkRoutes(scene, world)
  assert.deepEqual(sheetScene(world), scene)
})

test.concurrent('direct system and container endpoints grow enough wall space for their own ports', () => {
  for (const target of ['system', 'container'] as const) {
    const world: ArchitectureGraph = {
      flows: [],
      elements: [
        box('actor', 'actor', unit), box('system', 'system', unit),
        ...(target === 'container' ? [box('container', 'container', unit, { parent: 'observed:system' })] : []),
      ],
      relationships: Array.from({ length: 64 }, (_, index) => uses(`r${index}`, 'actor', target)),
    }
    const scene = sheetScene(world)
    const surface = target === 'system'
      ? scene.islands.find(island => island.kind === 'system')!
      : scene.slabs[0]!
    assert.ok(Math.min(surface.rect.w, surface.rect.d) * ROUTE_UNIT / 2 >= 2 * 63 * ROUTE_SPACING)
    checkRoutes(scene, world)
  }
})
