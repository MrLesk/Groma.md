import { expect, test } from 'bun:test'
import path from 'node:path'
import { loadAnnotatedArchitecture } from '../src/core.ts'
import { sheetScene } from '../src/sheet/scene.ts'
import type { Point } from '../src/types.ts'
import { fitArchitecture, fitCamera, zoomAbout, type Camera } from '../src/viewers/web/iso/camera.ts'
import { boundsOf, projectScene } from '../src/viewers/web/iso/project.ts'
import { sceneAtSeparation } from '../src/viewers/web/layers/separation.ts'

const viewport = { width: 800, height: 600 }

async function map(separation: number) {
  const world = await loadAnnotatedArchitecture(path.resolve(import.meta.dir, '../test/fixtures/flows'))
  const sheet = sheetScene(world)
  const scene = sceneAtSeparation(projectScene(sheet, undefined, { yaw: 65, pitch: 35 }), separation)
  return { world, sheet, scene }
}

function expectFramed(points: Point[], camera: Camera | undefined): void {
  expect(camera).toBeDefined()
  const bounds = boundsOf(points.map(point => ({
    x: point.x * camera!.k + camera!.x,
    y: point.y * camera!.k + camera!.y,
  })))
  expect(bounds.x).toBeGreaterThanOrEqual(120 - 1e-8)
  expect(bounds.y).toBeGreaterThanOrEqual(120 - 1e-8)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width - 120 + 1e-8)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height - 120 + 1e-8)
  expect(bounds.x + bounds.width / 2).toBeCloseTo(viewport.width / 2)
  expect(bounds.y + bounds.height / 2).toBeCloseTo(viewport.height / 2)
  expect(camera!.k).toBeGreaterThan(0)
  expect(camera!.k).toBeLessThanOrEqual(1)
}

test.concurrent('the map area between both panes at the minimum window width keeps a positive fit', async () => {
  const { world, scene } = await map(0)
  const frame = { width: 212, height: 614 }
  const ids = world.flows[0]!.steps.map(step => step.relationshipId)
  const camera = fitArchitecture(scene, world, ids, frame)!
  expect(camera.k).toBeGreaterThan(0)
  for (const route of scene.routes.filter(item => ids.includes(item.route.id))) {
    for (const point of route.points) {
      expect(point.x * camera.k + camera.x).toBeGreaterThanOrEqual(0)
      expect(point.x * camera.k + camera.x).toBeLessThanOrEqual(frame.width)
      expect(point.y * camera.k + camera.y).toBeGreaterThanOrEqual(0)
      expect(point.y * camera.k + camera.y).toBeLessThanOrEqual(frame.height)
    }
  }
})

for (const separation of [0, 1]) {
  test.concurrent(`flow camera fits exact routes and full endpoints at separation ${separation}`, async () => {
    const { world, sheet, scene } = await map(separation)
    const original = structuredClone({ world, sheet, scene })
    const ids = world.flows[0]!.steps.map(step => step.relationshipId)
    const routes = scene.routes.filter(item => ids.includes(item.route.id))
    const endpoints = new Set(routes.flatMap(item => [item.route.source, item.route.target]))
    const points = [
      ...scene.buildings.filter(item => endpoints.has(item.building.representationId))
        .flatMap(item => item.floors.flatMap(floor => floor.flatMap(face => face.points))),
      ...routes.flatMap(item => [...item.points, ...item.lifts.flatMap(lift => [lift.from, lift.to])]),
    ]
    const camera = fitArchitecture(scene, world, ids, viewport)
    expectFramed(points, camera)
    expect({ world, sheet, scene }).toEqual(original)

    const outside = scene.routes.find(item => !ids.includes(item.route.id))!
    outside.points = [{ x: 10000, y: 10000 }, { x: 11000, y: 11000 }]
    expect(fitArchitecture(scene, world, ids, viewport)).toEqual(camera)
    const combined = fitArchitecture(scene, world, [...ids, outside.route.id], viewport)!
    expect(combined.k).toBeLessThan(camera!.k)
    expect(fitArchitecture(scene, world, ids, viewport)).toEqual(camera)
  })

  test.concurrent(`container selection fits its children at separation ${separation}`, async () => {
    const { world, scene } = await map(separation)
    const slab = scene.slabs[0]!
    const children = new Set(world.elements.filter(element => element.parent === slab.slab.representationId)
      .map(element => element.representationId))
    const points = [
      ...slab.faces.flatMap(face => face.points),
      ...scene.buildings.filter(item => children.has(item.building.representationId))
        .flatMap(item => item.floors.flatMap(floor => floor.flatMap(face => face.points))),
    ]
    const container = fitArchitecture(scene, world, [slab.slab.representationId], viewport)
    expectFramed(points, container)

    const building = scene.buildings.find(item => children.has(item.building.representationId))!
    const component = fitArchitecture(scene, world, [building.building.representationId], viewport)
    expectFramed(building.floors.flatMap(floor => floor.flatMap(face => face.points)), component)
    expect(component!.k).toBeGreaterThanOrEqual(container!.k)
  })
}


test.concurrent('small selections stop at readable scale while manual zoom can go closer', async () => {
  const { world, scene } = await map(0)
  const building = scene.buildings[0]!
  const ids = [building.building.representationId]
  const camera = fitArchitecture(scene, world, ids, viewport)!
  expectFramed(building.floors.flatMap(floor => floor.flatMap(face => face.points)), camera)
  expect(camera.k).toBe(1)
  const wider = fitArchitecture(scene, world, ids, { width: 1600, height: 1200 })!
  expect(wider.k).toBe(camera.k)
  expect(wider.x - camera.x).toBeCloseTo(400)
  expect(wider.y - camera.y).toBeCloseTo(300)
  const fitted = fitCamera(scene.bounds, viewport)
  const manual = zoomAbout(camera, 2, { x: 400, y: 300 }, fitted)
  expect(manual.k).toBeGreaterThan(camera.k)
})
