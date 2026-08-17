import { expect, test } from 'bun:test'

import {
  buildScene,
  corners,
  defaultProjection,
  fitScene,
  LAYER_RISE,
  orderScene,
  project,
  WEIGHT_RISE,
} from '../src/viewers/web/scene.ts'
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
  const items = buildScene(fixtureWorld())

  const byId = new Map(items.flatMap(item =>
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
  const items = orderScene(buildScene(fixtureWorld()), defaultProjection)

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

test.concurrent('a route rides each surface it crosses and never dips under a plate', () => {
  const route = buildScene(fixtureWorld()).find(item => item.kind === 'route')
  expect(route?.kind).toBe('route')
  if (route?.kind !== 'route') return
  const path = route.path

  // From c2 standing on the system plate up onto c1's plate at k1.
  expect(path[0]?.z).toBe(LAYER_RISE)
  expect(path[path.length - 1]?.z).toBe(2 * LAYER_RISE)

  // The climb happens exactly at c1's boundary, as a vertical step.
  const step = path.findIndex((point, index) => {
    const next = path[index + 1]
    return next !== undefined && next.x === point.x && next.y === point.y && next.z !== point.z
  })
  expect(step).toBeGreaterThanOrEqual(0)
  expect(path[step]?.x).toBe(110)

  // No horizontal piece runs under a plate it is inside of.
  for (let index = 0; index < path.length - 1; index += 1) {
    const from = path[index]!
    const to = path[index + 1]!
    if (from.z !== to.z) continue
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
    const insideC1 = mid.x > 50 && mid.x < 110 && mid.y > 20 && mid.y < 70
    const insideS = mid.x > 40 && mid.x < 180 && mid.y > 10 && mid.y < 110
    if (insideC1) expect(from.z).toBe(2 * LAYER_RISE)
    else if (insideS) expect(from.z).toBe(LAYER_RISE)
  }
})

test.concurrent('a leaf with more observed code stands taller', () => {
  const world = fixtureWorld()
  const heavy = element('heavy', 'component', 'c1', [], { x: 55, y: 52, width: 20, height: 10 })
  heavy.codeLines = 400
  const light = element('light', 'component', 'c1', [], { x: 80, y: 52, width: 20, height: 10 })
  light.codeLines = 25
  world.elements.push(heavy, light)

  const heights = new Map(buildScene(world).flatMap(item =>
    item.kind === 'prism'
      ? [[item.element.representationId, item.top - item.bottom] as const]
      : []))

  expect(heights.get('heavy')!).toBeGreaterThan(heights.get('light')!)
  // A leaf without code keeps its kind base height.
  expect(heights.get('light')!).toBeGreaterThan(heights.get('k1')!)
  // The heaviest leaf rises the full weight allowance above that base.
  expect(heights.get('heavy')! - heights.get('k1')!).toBeCloseTo(WEIGHT_RISE)
})

test.concurrent('same-layer prisms draw back to front', () => {
  const world = fixtureWorld()
  world.elements.push(
    element('q1', 'component', 'c1', [], { x: 55, y: 55, width: 30, height: 12 }),
  )
  const items = orderScene(buildScene(world), defaultProjection)
  const near = elementItem(items, 'q1')
  const far = elementItem(items, 'k1')
  expect(far).toBeLessThan(near)
})

test.concurrent('rotating the camera half a turn reverses back to front', () => {
  const world = fixtureWorld()
  world.elements.push(
    element('q1', 'component', 'c1', [], { x: 55, y: 55, width: 30, height: 12 }),
  )
  const opposite = {
    rotation: defaultProjection.rotation + Math.PI,
    elevation: defaultProjection.elevation,
  }
  const items = orderScene(buildScene(world), opposite)
  const nowNear = elementItem(items, 'k1')
  const nowFar = elementItem(items, 'q1')
  expect(nowFar).toBeLessThan(nowNear)
})

test.concurrent('top-down elevation flattens heights away', () => {
  const topDown = { rotation: defaultProjection.rotation, elevation: Math.PI / 2 }
  const grounded = project(topDown, 30, 40, 0)
  const raised = project(topDown, 30, 40, 25)
  expect(raised.x).toBeCloseTo(grounded.x)
  expect(raised.y).toBeCloseTo(grounded.y)
})

test.concurrent('fit box contains every projected corner', () => {
  const items = buildScene(fixtureWorld())
  for (const projection of [defaultProjection, { rotation: 3.2, elevation: 1.1 }]) {
    const fit = fitScene(items, projection)
    const inside = (x: number, y: number) =>
      x >= fit.x && x <= fit.x + fit.width
      && y >= fit.y && y <= fit.y + fit.height

    for (const item of items) {
      if (item.kind === 'slab' || item.kind === 'prism') {
        for (const point of [
          ...corners(projection, item.element.bounds, item.bottom),
          ...corners(projection, item.element.bounds, item.top),
        ]) {
          expect(inside(point.x, point.y)).toBe(true)
        }
      } else if (item.kind === 'route') {
        for (const waypoint of item.path) {
          const point = project(projection, waypoint.x, waypoint.y, waypoint.z)
          expect(inside(point.x, point.y)).toBe(true)
        }
      }
    }
  }
})

test.concurrent('building and ordering a scene leaves the world untouched', () => {
  const world = fixtureWorld()
  deepFreeze(world)
  // Any mutation of the frozen world would throw inside buildScene or orderScene.
  const items = buildScene(world)
  expect(orderScene(items, defaultProjection).length).toBeGreaterThan(0)
})

test.concurrent('an empty world produces an empty scene', () => {
  const items = buildScene({
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    elements: [],
    groups: [],
    relationships: [],
  })
  expect(items).toEqual([])
  expect(fitScene(items, defaultProjection)).toEqual({ x: 0, y: 0, width: 0, height: 0 })
})

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== 'object') return
  Object.freeze(value)
  for (const child of Object.values(value)) deepFreeze(child)
}
