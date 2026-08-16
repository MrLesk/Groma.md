import { expect, test } from 'bun:test'

import { buildScene, corners, LAYER_RISE, project } from '../src/viewers/web/scene.ts'
import type { SceneItem } from '../src/viewers/web/scene.ts'
import type {
  AnnotatedElement,
  ArchitectureWorld,
  Bounds,
  C4Kind,
  WorldElement,
} from '../src/types.ts'

function element(
  id: string,
  kind: C4Kind,
  parent: string | null,
  children: string[],
  bounds: Bounds,
): WorldElement {
  const annotated: AnnotatedElement = {
    representationId: id,
    id,
    kind,
    name: id,
    description: '',
    parent,
    children,
    external: false,
    code: [],
    origin: 'observed',
  }
  return { ...annotated, bounds }
}

/**
 * One system holding a grouped container pair, a component nested two deep,
 * and a person outside; exercises every scene item type.
 */
function fixtureWorld(): ArchitectureWorld {
  return {
    bounds: { x: 0, y: 0, width: 200, height: 120 },
    elements: [
      element('s', 'system', null, ['c1', 'c2'], { x: 40, y: 10, width: 140, height: 100 }),
      element('c1', 'container', 's', ['k1'], { x: 50, y: 20, width: 60, height: 50 }),
      element('c2', 'container', 's', [], { x: 120, y: 30, width: 50, height: 40 }),
      element('k1', 'component', 'c1', [], { x: 55, y: 30, width: 40, height: 20 }),
      element('p', 'person', null, [], { x: 0, y: 40, width: 28, height: 40 }),
    ],
    groups: [
      { id: 'group:s:pair', name: 'pair', parent: 's', bounds: { x: 45, y: 15, width: 130, height: 70 } },
    ],
    relationships: [
      {
        id: 'r1',
        source: 'c2',
        target: 'k1',
        description: 'reads',
        technology: '',
        origin: 'observed',
        route: [{ x: 120, y: 50 }, { x: 100, y: 50 }, { x: 95, y: 40 }],
        label: { x: 100, y: 45, width: 14, height: 5 },
      },
    ],
  }
}

function indexOf(items: SceneItem[], predicate: (item: SceneItem) => boolean): number {
  const index = items.findIndex(predicate)
  expect(index).toBeGreaterThanOrEqual(0)
  return index
}

function elementItem(items: SceneItem[], id: string): number {
  return indexOf(items, item =>
    (item.kind === 'slab' || item.kind === 'prism') && item.element.representationId === id)
}

test.concurrent('containment depth sets elevation and slab versus prism', () => {
  const scene = buildScene(fixtureWorld())

  const byId = new Map(scene.items.flatMap(item =>
    item.kind === 'slab' || item.kind === 'prism'
      ? [[item.element.representationId, item] as const]
      : []))

  expect(byId.get('s')?.kind).toBe('slab')
  expect(byId.get('c1')?.kind).toBe('slab')
  expect(byId.get('c2')?.kind).toBe('prism')
  expect(byId.get('k1')?.kind).toBe('prism')
  expect(byId.get('p')?.kind).toBe('prism')

  expect(byId.get('s')?.bottom).toBe(0)
  expect(byId.get('c2')?.bottom).toBe(LAYER_RISE)
  expect(byId.get('k1')?.bottom).toBe(2 * LAYER_RISE)
  // A child stands exactly on its parent's surface.
  expect(byId.get('c2')?.bottom).toBe(byId.get('s')!.top)
  expect(byId.get('k1')?.bottom).toBe(byId.get('c1')!.top)
})

test.concurrent('painter order layers surfaces, zones, routes, then standing blocks', () => {
  const scene = buildScene(fixtureWorld())
  const items = scene.items

  const system = elementItem(items, 's')
  const zone = indexOf(items, item => item.kind === 'zone')
  const route = indexOf(items, item => item.kind === 'route')
  const containerSlab = elementItem(items, 'c1')
  const containerPrism = elementItem(items, 'c2')
  const component = elementItem(items, 'k1')

  expect(system).toBeLessThan(zone)
  expect(zone).toBeLessThan(route)
  expect(route).toBeLessThan(containerSlab)
  expect(route).toBeLessThan(containerPrism)
  expect(containerSlab).toBeLessThan(component)
})

test.concurrent('route sits on the lower endpoint surface', () => {
  const scene = buildScene(fixtureWorld())
  const route = scene.items.find(item => item.kind === 'route')
  expect(route?.kind).toBe('route')
  if (route?.kind === 'route') expect(route.z).toBe(LAYER_RISE)
})

test.concurrent('same-layer prisms draw back to front', () => {
  const world = fixtureWorld()
  world.elements.push(
    element('q1', 'component', 'c1', [], { x: 55, y: 55, width: 30, height: 12 }),
  )
  const scene = buildScene(world)
  const near = elementItem(scene.items, 'q1')
  const far = elementItem(scene.items, 'k1')
  expect(far).toBeLessThan(near)
})

test.concurrent('fit box contains every projected corner', () => {
  const scene = buildScene(fixtureWorld())
  const inside = (x: number, y: number) =>
    x >= scene.fit.x && x <= scene.fit.x + scene.fit.width
    && y >= scene.fit.y && y <= scene.fit.y + scene.fit.height

  for (const item of scene.items) {
    if (item.kind === 'slab' || item.kind === 'prism') {
      for (const point of [
        ...corners(item.element.bounds, item.bottom),
        ...corners(item.element.bounds, item.top),
      ]) {
        expect(inside(point.x, point.y)).toBe(true)
      }
    } else if (item.kind === 'route') {
      for (const waypoint of item.relationship.route) {
        const point = project(waypoint.x, waypoint.y, item.z)
        expect(inside(point.x, point.y)).toBe(true)
      }
    }
  }
})

test.concurrent('building a scene leaves the world untouched', () => {
  const world = fixtureWorld()
  deepFreeze(world)
  // Any mutation of the frozen world would throw inside buildScene.
  expect(buildScene(world).items.length).toBeGreaterThan(0)
})

test.concurrent('an empty world produces an empty scene', () => {
  const scene = buildScene({
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    elements: [],
    groups: [],
    relationships: [],
  })
  expect(scene.items).toEqual([])
  expect(scene.fit).toEqual({ x: 0, y: 0, width: 0, height: 0 })
})

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== 'object') return
  Object.freeze(value)
  for (const child of Object.values(value)) deepFreeze(child)
}
