import assert from 'node:assert/strict'

import { test } from 'bun:test'

import { loadArchitectureViewModel } from '../src/core.ts'
import { PAD, ROOF_SHADOW, centredRect } from '../src/sheet/grid.ts'
import { PLANE, ROOF_PAD, curved, roofBlock, textWidth } from '../src/sheet/measure.ts'
import { sheetScene } from '../src/sheet/scene.ts'
import type { Building, RoutePoint, SheetScene } from '../src/sheet/types.ts'
import type { Bounds, Point } from '../src/types.ts'
import type { ProjectProfile } from '../src/project-profile.ts'
import {
  fitCamera,
  keyAction,
  pan,
  wheelAction,
  zoomAbout,
  zoomLimits,
  zoomReadout,
} from '../src/viewers/web/iso/camera.ts'
import {
  HEIGHT_UNIT,
  boxFaces,
  paintOrder,
  project,
  projectScene,
} from '../src/viewers/web/iso/project.ts'
import type { ProjectedScene } from '../src/viewers/web/iso/project.ts'
import { facadePatternId } from '../src/viewers/web/iso/style.ts'
import { box, openclawFixtureRoot, viewerFixtureRoot, worldOf } from './helpers.ts'

const profile = (name: string, description: string): ProjectProfile => ({
  name,
  description,
  descriptionBlocks: [{ spans: [{ text: description, styles: [] }] }],
})
const projectProfile = profile('Shop', 'Shop architecture.')
const groundPoint = ({ x, y }: Point): RoutePoint => ({
  gx: (y / 12 + x / 24) / 2,
  gy: (y / 12 - x / 24) / 2,
})

async function fixtureScene(root: string): Promise<ProjectedScene> {
  const { world } = await loadArchitectureViewModel(root)
  return projectScene(sheetScene(world), projectProfile)
}

function everyPoint(scene: ProjectedScene): Point[] {
  return [
    ...scene.islands.flatMap(item => item.polygon),
    ...scene.slabs.flatMap(item => item.faces.flatMap(face => face.points)),
    ...scene.buildings.flatMap(item => item.floors.flatMap(floor => floor.flatMap(face => face.points))),
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
  // Curved outlines are sampled arcs, so neither they nor the route ends that meet one take part in the integer check.
  const boxes = scene.buildings.filter(({ building }) => !curved(building.shape))
  const round = new Set(scene.buildings
    .filter(({ building }) => curved(building.shape))
    .map(({ building }) => building.representationId))
  const routes = scene.routes.map(drawn => ({
    ...drawn,
    points: drawn.points.slice(round.has(drawn.route.source) ? 1 : 0, round.has(drawn.route.target) ? -1 : undefined),
  }))
  for (const point of everyPoint({ ...scene, buildings: boxes, routes })) {
    assert.equal(Number.isInteger(point.x) && Number.isInteger(point.y), true)
  }
  assert.ok(project(3, 2, 0).y > project(2, 2, 0).y && project(2, 3, 0).y > project(2, 2, 0).y)
  assert.equal(project(1, 0, 1).y, project(1, 0, 0).y - HEIGHT_UNIT)
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

test.concurrent('orbit projection turns visible walls and painter depth around the vertical axis', () => {
  const rect = { gx: 2, gy: 3, w: 2, d: 2 }
  const front = boxFaces(rect, 0, 1, { yaw: 45, pitch: 36 })
  const back = boxFaces(rect, 0, 1, { yaw: 225, pitch: 36 })
  assert.deepEqual(front.map(face => face.side), ['left', 'right', 'top'])
  assert.deepEqual(back.map(face => face.side), ['left', 'right', 'top'])
  assert.notDeepEqual(front.flatMap(face => face.points), back.flatMap(face => face.points))

  const far = { id: 'far', rect: { gx: 0, gy: 0, w: 1, d: 1 } }
  const near = { id: 'near', rect: { gx: 10, gy: 10, w: 1, d: 1 } }
  assert.deepEqual(paintOrder([near, far], { yaw: 45, pitch: 36 }).map(item => item.id), ['far', 'near'])
  assert.deepEqual(paintOrder([near, far], { yaw: 225, pitch: 36 }).map(item => item.id), ['near', 'far'])
})

test.concurrent('a many-file component projects as one centred compressed tower', () => {
  const unit = { x: 0, y: 0, width: 1, height: 1 }
  const code = Array.from({ length: 8 }, (_, index) => ({
    scanner: 'fixture',
    file: `src/file-${index}.${index % 2 === 0 ? 'ts' : 'cs'}`,
    lines: index * 100,
    dependencies: index,
    dependents: 7 - index,
  }))
  const scene = projectScene(sheetScene(worldOf([
    box('shop', 'system', unit),
    box('api', 'container', unit, { parent: 'observed:shop' }),
    box('single', 'component', unit, {
      parent: 'observed:api',
      code: [{ scanner: 'fixture', file: 'src/single.ts', lines: 0, dependencies: 0, dependents: 0 }],
    }),
    box('tower', 'component', unit, { parent: 'observed:api', code }),
  ])))
  const tower = scene.buildings.find(item => item.building.id === 'tower')!
  assert.equal(tower.floors.length, 5)
  assert.ok(tower.floors.every(floor => floor.some(face => face.side === 'left')))
  assert.ok(tower.floors.at(-1)!.some(face => face.side === 'top'))
  const rects = tower.building.floors.map(floor => centredRect(tower.building.rect, floor.footprint))
  for (const rect of rects) {
    assert.equal(rect.gx + rect.w / 2, tower.building.rect.gx + tower.building.rect.w / 2)
    assert.equal(rect.gy + rect.d / 2, tower.building.rect.gy + tower.building.rect.d / 2)
  }
  assert.equal(facadePatternId('.ts', 'left'), facadePatternId('.ts', 'left'))
  assert.notEqual(facadePatternId('.ts', 'left'), facadePatternId('.cs', 'left'))
  assert.notEqual(facadePatternId('.unknown', 'left'), facadePatternId('.ts', 'left'))
})

test.concurrent('buildings paint back to front', async () => {
  for (const root of [viewerFixtureRoot, openclawFixtureRoot]) {
    const scene = await fixtureScene(root)
    const boxes = scene.buildings.map(item => ({
      rect: item.building.rect,
      screen: screenBox(item.floors.flatMap(floor => floor.flatMap(face => face.points))),
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

test.concurrent('Escape clears selection while x has no map action', () => {
  assert.equal(keyAction('Escape', 'other'), 'deselect')
  assert.equal(keyAction('x', 'other'), undefined)
  assert.equal(keyAction('X', 'other'), undefined)
})

test.concurrent('the frame encloses its drafting marks, every island and the west-corner compass', async () => {
  const scene = await fixtureScene(viewerFixtureRoot)
  const { frame, calibrationTicks, compass } = scene
  assert.equal(frame.length, 4)
  assert.ok(calibrationTicks.length >= 10)
  const sheet = screenBox(frame)
  for (const point of [...scene.islands.flatMap(item => item.polygon), ...compassPoints(scene)]) {
    assert.ok(point.x >= sheet.x && point.x <= sheet.x + sheet.width)
    assert.ok(point.y >= sheet.y && point.y <= sheet.y + sheet.height)
  }
  const groundFrame = frame.map(groundPoint)
  const west = Math.min(...groundFrame.map(point => point.gx))
  const north = Math.min(...groundFrame.map(point => point.gy))
  const east = Math.max(...groundFrame.map(point => point.gx))
  const south = Math.max(...groundFrame.map(point => point.gy))
  const inside = (point: Point): boolean => {
    const ground = groundPoint(point)
    return ground.gx >= west - 1e-8 && ground.gx <= east + 1e-8
      && ground.gy >= north - 1e-8 && ground.gy <= south + 1e-8
  }
  for (const tick of calibrationTicks) {
    assert.ok(inside(tick.from) && inside(tick.to))
    const from = groundPoint(tick.from)
    const to = groundPoint(tick.to)
    assert.ok((Math.abs(from.gx - east) < 1e-8 && to.gx < from.gx)
      || (Math.abs(from.gy - south) < 1e-8 && to.gy < from.gy))
  }
  assert.ok(compass.at.gx < Math.min(...scene.islands.map(item => item.island.rect.gx)))
  const letter = (text: string): Point => compass.letters.find(item => item.text === text)!.at
  assert.ok(letter('N').y < compass.centre.y && letter('N').x > compass.centre.x)
  assert.ok(letter('W').y < compass.centre.y && letter('W').x < compass.centre.x)
  for (const point of compassPoints(scene)) {
    assert.ok(point.x >= scene.bounds.x && point.x <= scene.bounds.x + scene.bounds.width)
    assert.ok(point.y >= scene.bounds.y && point.y <= scene.bounds.y + scene.bounds.height)
  }
})

test.concurrent('blueprint decorations scale with the sheet and the project plate stays outside architecture', () => {
  const empty = (side: number): SheetScene => ({
    sheet: { gx: 0, gy: 0, w: side, d: side },
    islands: [], zones: [], slabs: [], buildings: [], routes: [],
  })
  const project = profile('Supply map', 'Shows supply responsibilities across the repository.')
  const plain = projectScene(empty(48))
  const small = projectScene(empty(12), project)
  const large = projectScene(empty(96), project)
  const compact = projectScene(empty(96), profile('Map', 'Short.'))
  const growing = projectScene(empty(96), profile('Map', 'x'.repeat(60)))
  const threshold = projectScene(empty(96), profile('Map', 'x'.repeat(80)))
  const overflow = projectScene(empty(96), profile('Map', 'x'.repeat(81)))
  const extended = projectScene(empty(96), profile(
    project.name,
    Array(8).fill(project.description).join(' '),
  ))
  const length = (segment: ProjectedScene['calibrationTicks'][number]): number =>
    Math.hypot(segment.to.x - segment.from.x, segment.to.y - segment.from.y)
  const east = (scene: ProjectedScene): number => Math.max(...scene.frame.map(point => groundPoint(point).gx))
  const south = (scene: ProjectedScene): number => Math.max(...scene.frame.map(point => groundPoint(point).gy))
  const plateWidth = (scene: ProjectedScene): number => {
    const ground = scene.projectPlate!.polygon.map(groundPoint)
    return Math.max(...ground.map(point => point.gx)) - Math.min(...ground.map(point => point.gx))
  }
  const largePlate = large.projectPlate!
  const extendedPlate = extended.projectPlate!

  assert.equal(plain.projectPlate, undefined)
  assert.equal(east(plain), south(plain))
  const largeCompass = screenBox(large.compass.ring).width
  const smallCompass = screenBox(small.compass.ring).width
  assert.ok(largeCompass >= smallCompass * 2.9)
  assert.ok(largeCompass < screenBox(large.frame).width / 10)
  assert.ok(length(large.calibrationTicks[0]!) >= length(small.calibrationTicks[0]!) * 2.9)
  assert.ok(plateWidth(compact) < plateWidth(growing))
  assert.ok(plateWidth(growing) < plateWidth(threshold))
  assert.equal(plateWidth(overflow), plateWidth(threshold))
  assert.ok(groundPoint(largePlate.divider.from).gx
    - groundPoint(largePlate.description.origin).gx
    - largePlate.description.maxWidth / PLANE >= 0.5)
  assert.equal(overflow.projectPlate!.description.lines.length, 2)
  assert.equal(east(compact), east(overflow))
  assert.ok(Math.min(...largePlate.polygon.map(point => groundPoint(point).gy)) > 96)
  assert.ok(Math.max(...largePlate.polygon.map(point => groundPoint(point).gx)) < east(large))
  assert.ok(extendedPlate.description.lines.length > largePlate.description.lines.length)
  assert.equal(east(extended), east(large))
  assert.ok(south(extended) > south(large))
  for (const point of extendedPlate.polygon.map(groundPoint)) {
    assert.ok(point.gy < south(extended))
  }
  for (const line of extendedPlate.description.lines) {
    assert.ok(textWidth(line.map(run => run.text).join(''), extendedPlate.description.fontSize) <= extendedPlate.description.maxWidth)
  }
})

test.concurrent('every relationship has a polyline whose arrowhead lies on the sheet along its last step', async () => {
  const { world } = await loadArchitectureViewModel(viewerFixtureRoot)
  const scene = projectScene(sheetScene(world), projectProfile)
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

test.concurrent('an off-centre route meets the near wall of the actor it leaves, front side or under the roof', () => {
  const actor: Building = {
    representationId: 'observed:actor', id: 'actor', name: 'Actor', origin: 'observed',
    kind: 'actor', external: false, surface: 'actors', rect: { gx: 4, gy: 4, w: 4, d: 4 },
    heightUnits: 1, shape: { kind: 'round' }, floors: [], lines: ['Actor'],
  }
  const leg = (id: string, from: RoutePoint, to: RoutePoint, arriving = false): SheetScene['routes'][number] => ({
    id,
    source: arriving ? 'other' : actor.representationId,
    target: arriving ? actor.representationId : 'other',
    description: '', origin: 'observed', points: arriving ? [to, from] : [from, to],
  })
  /** A back side is hidden under the roof, so the router anchors a route half a cell behind the footprint, where a one-floor roof stops shading the ground. */
  const shadow = actor.heightUnits * ROOF_SHADOW
  const scene: SheetScene = {
    sheet: { gx: 0, gy: 0, w: 12, d: 12 }, islands: [], zones: [], slabs: [], buildings: [actor],
    routes: [
      leg('south', { gx: 5, gy: 8 }, { gx: 5, gy: 10 }),
      leg('east', { gx: 8, gy: 7 }, { gx: 10, gy: 7 }, true),
      leg('west', { gx: 4 - shadow, gy: 5 }, { gx: 2, gy: 5 }),
      leg('north', { gx: 5, gy: 4 - shadow }, { gx: 5, gy: 2 }),
    ],
  }
  /** Back from screen pixels to ground cells, one cell east being `unit`. */
  const unit = project(1, 0, 0)
  const ground = ({ x, y }: Point): RoutePoint => ({ gx: (y / unit.y + x / unit.x) / 2, gy: (y / unit.y - x / unit.x) / 2 })
  const drawn = projectScene(scene, projectProfile).routes
  const radius = actor.rect.w / 2

  for (const { route, points } of drawn) {
    const arriving = route.target === actor.representationId
    const met = ground(points[arriving ? points.length - 1 : 0]!)
    const port = route.points[arriving ? route.points.length - 1 : 0]!
    const adjacent = route.points[arriving ? route.points.length - 2 : 1]!
    const direction = (end: RoutePoint): number[] => arriving
      ? [Math.sign(end.gx - adjacent.gx), Math.sign(end.gy - adjacent.gy)]
      : [Math.sign(adjacent.gx - end.gx), Math.sign(adjacent.gy - end.gy)]
    /** A front-side end meets the circle on the ground; a back-side one meets the same circle slid under the roof, which is where the shadow anchor already stands. */
    const behind = port.gx < actor.rect.gx || port.gy < actor.rect.gy ? shadow : 0
    const centre = { gx: actor.rect.gx + radius - behind, gy: actor.rect.gy + radius - behind }
    assert.ok(Math.abs(Math.hypot(met.gx - centre.gx, met.gy - centre.gy) - radius) < 1e-9, `${route.id} misses the wall`)
    /** The near wall, not the one across the shape. */
    assert.ok(Math.hypot(met.gx - port.gx, met.gy - port.gy) < radius, `${route.id} crosses to the far wall`)
    assert.deepEqual(direction(met), direction(port), `${route.id} changes direction`)
  }
  assert.equal(new Set(drawn.map(({ route, points }) => JSON.stringify(ground(points[route.target === actor.representationId ? points.length - 1 : 0]!)))).size, drawn.length)
})

test.concurrent('roof and surface text keep their owning shape inset', async () => {
  const scene = await fixtureScene(viewerFixtureRoot)
  const rounded = scene.buildings.filter(({ building }) => curved(building.shape))
  assert.ok(scene.buildings.length > rounded.length && rounded.length > 0)
  for (const { building, text, floors } of scene.buildings) {
    const top = building.floors.at(-1)
    const roof = top === undefined ? building.rect : centredRect(building.rect, top.footprint)
    const roofWidth = roof.w * PLANE
    for (const line of text.lines) assert.ok(textWidth(line) + 2 * ROOF_PAD <= roofWidth)
    if (curved(building.shape)) continue
    const roofNorth = floors.at(-1)!.find(face => face.side === 'top')!.points[0]!
    assert.deepEqual(text.origin, roofNorth)
  }
  for (const { building, text, floors } of rounded) {
    const { rect, lines } = building
    const block = roofBlock(lines)
    assert.deepEqual(text.origin, project(rect.gx + (rect.w - block.w / PLANE) / 2, rect.gy + (rect.d - block.d / PLANE) / 2, building.heightUnits))
    assert.equal(floors.length, 1)
    const [band, top] = floors[0]!
    assert.ok(top!.side === 'top' && top!.points.length > 4 && band!.side === 'left')
    const box = screenBox(boxFaces(rect, 0, building.heightUnits).find(face => face.side === 'top')!.points)
    for (const point of top!.points) assert.ok(point.x >= box.x - 0.01 && point.x <= box.x + box.width + 0.01 && point.y >= box.y - 0.01 && point.y <= box.y + box.height + 0.01)
  }
  for (const { island, text } of scene.islands) {
    assert.deepEqual(text.origin, project(island.rect.gx, island.rect.gy + island.rect.d - PAD, 0))
  }
})

test.concurrent('every surface label stays in the compact edge band', () => {
  const projected = projectScene({
    sheet: { gx: 0, gy: 0, w: 30, d: 20 },
    islands: [
      { key: 'island:actors', kind: 'actors', name: 'Actors', element: null, rect: { gx: 4, gy: 4, w: 4, d: 4 } },
      { key: 'island:system', kind: 'system', name: 'System', element: null, rect: { gx: 10, gy: 4, w: 12, d: 12 } },
    ],
    zones: [{ key: 'group:system:one', name: 'Group', parent: 'island:system', members: [], rect: { gx: 12, gy: 6, w: 5, d: 5 } }],
    slabs: [{ representationId: 'container:one', id: 'one', name: 'Container', origin: 'observed', island: 'island:system', rect: { gx: 16, gy: 8, w: 5, d: 6 } }],
    buildings: [],
    routes: [],
  }, projectProfile)
  const compact = projected.islands.find(({ island }) => island.kind === 'actors')!
  const system = projected.islands.find(({ island }) => island.kind === 'system')!
  assert.deepEqual(compact.text.origin, project(compact.island.rect.gx, compact.island.rect.gy + compact.island.rect.d - PAD, 0))
  assert.deepEqual(system.text.origin, project(system.island.rect.gx, system.island.rect.gy + system.island.rect.d - PAD, 0))
  const { zone, text: zoneText } = projected.zones[0]!
  assert.deepEqual(zoneText.origin, project(zone.rect.gx, zone.rect.gy + zone.rect.d - PAD, 0))
  const { slab, text: slabText } = projected.slabs[0]!
  assert.deepEqual(slabText.origin, project(slab.rect.gx, slab.rect.gy + slab.rect.d - PAD, 0))
})

test.concurrent('projecting a frozen world leaves it untouched', async () => {
  const { world } = await loadArchitectureViewModel(viewerFixtureRoot)
  const frozen = Object.freeze(structuredClone(world))
  const before = structuredClone(frozen)
  projectScene(sheetScene(frozen), projectProfile)
  assert.deepEqual(frozen, before)
})
