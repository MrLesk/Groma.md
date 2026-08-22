import assert from 'node:assert/strict'

import { test } from 'bun:test'

import { loadArchitectureViewModel } from '../src/core.ts'
import { PAD } from '../src/sheet/grid.ts'
import { PLANE, ROOF_PAD, textWidth } from '../src/sheet/measure.ts'
import { sheetScene } from '../src/sheet/scene.ts'
import type { Bounds, Point } from '../src/types.ts'
import {
  fitCamera,
  pan,
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
  for (const point of everyPoint(scene)) {
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
    for (const point of everyPoint(scene)) {
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

test.concurrent('every relationship has a polyline whose arrow points along a lattice direction', async () => {
  const { world } = await loadArchitectureViewModel(viewerFixtureRoot)
  const scene = projectScene(sheetScene(world))
  assert.deepEqual(scene.routes.map(item => item.route.id), world.relationships.map(item => item.id))
  const laneAngle = (Math.atan2(1, 2) * 180) / Math.PI
  for (const { points, arrow } of scene.routes) {
    assert.ok(points.length >= 2)
    assert.deepEqual(arrow.at, points[points.length - 1])
    assert.ok([laneAngle, -laneAngle, 180 - laneAngle, laneAngle - 180]
      .some(angle => Math.abs(angle - arrow.angle) < 1e-9), `arrow at ${arrow.angle}°`)
  }
})

test.concurrent('roof text fits the roof it lies on', async () => {
  const scene = await fixtureScene(viewerFixtureRoot)
  assert.ok(scene.buildings.length > 0)
  for (const { building, text, tiers } of scene.buildings) {
    const inset = 0.25 * (building.shape.levels - 1)
    const roofWidth = (building.rect.w - 2 * inset) * PLANE
    for (const line of text.lines) assert.ok(textWidth(line) + 2 * ROOF_PAD <= roofWidth)
    const roofNorth = tiers[tiers.length - 1]![2]!.points[0]!
    assert.deepEqual(text.origin, roofNorth)
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
