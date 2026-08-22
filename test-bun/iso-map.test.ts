import assert from 'node:assert/strict'

import { test } from 'bun:test'

import { loadArchitectureViewModel } from '../src/core.ts'
import { PAD } from '../src/sheet/grid.ts'
import { PLANE, ROOF_PAD, curved, roofBlock, textWidth } from '../src/sheet/measure.ts'
import { sheetScene } from '../src/sheet/scene.ts'
import type { Bounds, Point } from '../src/types.ts'
import {
  fitCamera,
  pan,
  wheelAction,
  zoomAbout,
  zoomLimits,
  zoomReadout,
} from '../src/viewers/web/iso/camera.ts'
import {
  FLOOR,
  boxFaces,
  project,
  projectScene,
} from '../src/viewers/web/iso/project.ts'
import type { ProjectedScene } from '../src/viewers/web/iso/project.ts'
import { openclawFixtureRoot, viewerFixtureRoot } from './helpers.ts'

async function fixtureScene(root: string): Promise<ProjectedScene> {
  const { world } = await loadArchitectureViewModel(root)
  return projectScene(sheetScene(world))
}

function everyPoint(scene: ProjectedScene): Point[] {
  return [
    ...scene.islands.flatMap(item => item.polygon),
    ...scene.slabs.flatMap(item => item.faces.flatMap(face => face.points)),
    ...scene.buildings.flatMap(item => item.tiers.flatMap(tier => tier.flatMap(face => face.points))),
    ...scene.routes.flatMap(item => item.points),
  ]
}

function compassPoints(scene: ProjectedScene): Point[] {
  return [...scene.compass.star, ...scene.compass.letters.map(letter => letter.at)]
}

function screenBox(points: readonly Point[]): Bounds {
  const xs = points.map(point => point.x)
  const ys = points.map(point => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

function overlaps(a: Bounds, b: Bounds): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

test.concurrent('the lattice projects to integer screen units and depth grows down the screen', async () => {
  const scene = await fixtureScene(viewerFixtureRoot)
  // Curved roofs are sampled arcs, so only boxes take part in the integer check.
  const boxes = scene.buildings.filter(({ building }) => !curved(building.shape))
  for (const point of everyPoint({ ...scene, buildings: boxes })) {
    assert.equal(Number.isInteger(point.x) && Number.isInteger(point.y), true)
  }
  assert.ok(project(3, 2, 0).y > project(2, 2, 0).y && project(2, 3, 0).y > project(2, 2, 0).y)
  assert.equal(project(1, 0, 1).y, project(1, 0, 0).y - FLOOR)
})

test.concurrent('a box shows its top and the two faces turned to the viewer', () => {
  const rect = { gx: 2, gy: 3, w: 2, d: 2 }
  const faces = boxFaces(rect, 0, 1)
  assert.deepEqual(faces.map(face => face.side), ['left', 'right', 'top'])
  const top = faces[2]!.points
  assert.deepEqual(top[0], project(2, 3, 1))
  const south = project(4, 5, 0)
  for (const side of faces.slice(0, 2)) {
    assert.ok(side.points.some(point => point.x === south.x && point.y === south.y))
  }
})

test.concurrent('buildings paint back to front', async () => {
  for (const root of [viewerFixtureRoot, openclawFixtureRoot]) {
    const scene = await fixtureScene(root)
    const boxes = scene.buildings.map(item => ({
      rect: item.building.rect,
      screen: screenBox(item.tiers.flatMap(tier => tier.flatMap(face => face.points))),
    }))
    for (const [index, earlier] of boxes.entries()) {
      for (const later of boxes.slice(index + 1)) {
        if (!overlaps(earlier.screen, later.screen)) continue
        const laterBehind = later.rect.gx + later.rect.w <= earlier.rect.gx
          || later.rect.gy + later.rect.d <= earlier.rect.gy
        assert.equal(laterBehind, false)
      }
    }
  }
})

test.concurrent('the fitted camera shows every point inside the viewport', async () => {
  const scene = await fixtureScene(viewerFixtureRoot)
  for (const viewport of [{ width: 1200, height: 400 }, { width: 400, height: 1200 }]) {
    const camera = fitCamera(scene.bounds, viewport)
    for (const point of [...everyPoint(scene), ...compassPoints(scene), ...scene.frame]) {
      const x = point.x * camera.k + camera.x
      const y = point.y * camera.k + camera.y
      assert.ok(x >= 0 && x <= viewport.width && y >= 0 && y <= viewport.height)
    }
  }
})

test.concurrent('zooming keeps the point under the cursor still, clamps, and reads relative to fit', () => {
  const fit = fitCamera({ x: -100, y: -50, width: 800, height: 400 }, { width: 900, height: 600 })
  const anchor = { x: 300, y: 200 }
  const worldUnder = (camera: typeof fit): Point => ({
    x: (anchor.x - camera.x) / camera.k,
    y: (anchor.y - camera.y) / camera.k,
  })
  const zoomed = zoomAbout(fit, 1.25, anchor, fit)
  assert.ok(Math.abs(worldUnder(zoomed).x - worldUnder(fit).x) < 1e-9)
  assert.ok(Math.abs(worldUnder(zoomed).y - worldUnder(fit).y) < 1e-9)
  assert.equal(zoomReadout(fit, fit), '')
  assert.equal(zoomReadout(zoomed, fit), '125%')
  const limits = zoomLimits(fit)
  assert.equal(zoomAbout(fit, 1000, anchor, fit).k, limits.max)
  assert.equal(zoomAbout(fit, 0.0001, anchor, fit).k, limits.min)
  assert.ok(limits.min < fit.k && limits.max >= 4)
  assert.deepEqual(pan(fit, 10, -5), { ...fit, x: fit.x + 10, y: fit.y - 5 })
})

test.concurrent('a plain wheel pans by the scroll delta; a pinch or cmd+wheel zooms', () => {
  assert.deepEqual(
    wheelAction({ deltaX: 30, deltaY: -12, ctrlKey: false, metaKey: false }),
    { kind: 'pan', dx: -30, dy: 12 },
  )
  const pinch = wheelAction({ deltaX: 0, deltaY: -10, ctrlKey: true, metaKey: false })
  assert.ok(pinch.kind === 'zoom' && Math.abs(pinch.factor - Math.exp(0.1)) < 1e-12)
  const wheel = wheelAction({ deltaX: 0, deltaY: -100, ctrlKey: false, metaKey: true })
  assert.ok(wheel.kind === 'zoom' && Math.abs(wheel.factor - Math.exp(0.15)) < 1e-12)
})

test.concurrent('the frame and its ticks enclose every island and the compass sits in the west corner', async () => {
  const scene = await fixtureScene(viewerFixtureRoot)
  const { frame, ticks, compass } = scene
  assert.equal(frame.length, 4)
  assert.equal(ticks.length, 8)
  const sheet = screenBox(frame)
  for (const point of [...scene.islands.flatMap(item => item.polygon), ...compassPoints(scene)]) {
    assert.ok(point.x >= sheet.x && point.x <= sheet.x + sheet.width)
    assert.ok(point.y >= sheet.y && point.y <= sheet.y + sheet.height)
  }
  for (const tick of ticks) assert.ok(frame.some(corner => corner.x === tick.from.x + (tick.to.x - tick.from.x) / 2))
  assert.ok(compass.at.gx < Math.min(...scene.islands.map(item => item.island.rect.gx)))
  const letter = (text: string): Point => compass.letters.find(item => item.text === text)!.at
  assert.ok(letter('N').y < compass.centre.y && letter('N').x > compass.centre.x)
  assert.ok(letter('W').y < compass.centre.y && letter('W').x < compass.centre.x)
  for (const point of compassPoints(scene)) {
    assert.ok(point.x >= scene.bounds.x && point.x <= scene.bounds.x + scene.bounds.width)
    assert.ok(point.y >= scene.bounds.y && point.y <= scene.bounds.y + scene.bounds.height)
  }
})

test.concurrent('every relationship has a polyline whose arrowhead lies on the sheet along its last step', async () => {
  const { world } = await loadArchitectureViewModel(viewerFixtureRoot)
  const scene = projectScene(sheetScene(world))
  assert.deepEqual(scene.routes.map(item => item.route.id), world.relationships.map(item => item.id))
  for (const { route, points, arrow } of scene.routes) {
    assert.ok(points.length >= 2)
    assert.deepEqual(arrow.at, points[points.length - 1])
    const last = route.points[route.points.length - 1]!
    const before = route.points[route.points.length - 2]!
    const step = { 0: [1, 0], 90: [0, 1], 180: [-1, 0], 270: [0, -1] }[arrow.turn]
    assert.deepEqual(step, [Math.sign(last.gx - before.gx), Math.sign(last.gy - before.gy)], route.id)
  }
})

test.concurrent('roof text fits the roof it lies on: a box from its north corner, a curved roof centred', async () => {
  const scene = await fixtureScene(viewerFixtureRoot)
  const rounded = scene.buildings.filter(({ building }) => curved(building.shape))
  assert.ok(scene.buildings.length > rounded.length && rounded.length > 0)
  for (const { building, text, tiers } of scene.buildings) {
    const inset = 0.25 * (building.shape.levels - 1)
    const roofWidth = (building.rect.w - 2 * inset) * PLANE
    for (const line of text.lines) assert.ok(textWidth(line) + 2 * ROOF_PAD <= roofWidth)
    if (curved(building.shape)) continue
    const roofNorth = tiers[tiers.length - 1]![2]!.points[0]!
    assert.deepEqual(text.origin, roofNorth)
  }
  for (const { building, text, tiers } of rounded) {
    const { rect, lines } = building
    const block = roofBlock(lines)
    assert.deepEqual(text.origin, project(rect.gx + (rect.w - block.w / PLANE) / 2, rect.gy + (rect.d - block.d / PLANE) / 2, building.floors))
    assert.equal(tiers.length, 1)
    const [band, top] = tiers[0]!
    assert.ok(top!.side === 'top' && top!.points.length > 4 && band!.side === 'left')
    const box = screenBox(boxFaces(rect, 0, building.floors).find(face => face.side === 'top')!.points)
    for (const point of top!.points) assert.ok(point.x >= box.x - 0.01 && point.x <= box.x + box.width + 0.01 && point.y >= box.y - 0.01 && point.y <= box.y + box.height + 0.01)
  }
  for (const { island, text } of scene.islands) {
    assert.deepEqual(text.origin, project(island.rect.gx, island.rect.gy + island.rect.d - PAD, 0))
  }
})

test.concurrent('projecting a frozen world leaves it untouched', async () => {
  const { world } = await loadArchitectureViewModel(viewerFixtureRoot)
  const frozen = Object.freeze(structuredClone(world))
  const before = structuredClone(frozen)
  projectScene(sheetScene(frozen))
  assert.deepEqual(frozen, before)
})
