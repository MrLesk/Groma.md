import assert from 'node:assert/strict'

import { test } from 'bun:test'

import type { SheetScene } from '../src/sheet/types.ts'
import { fitHighlights } from '../src/viewers/web/iso/camera.ts'
import { projectScene } from '../src/viewers/web/iso/project.ts'

const sheet: SheetScene = {
  sheet: { gx: 0, gy: 0, w: 30, d: 30 },
  islands: [{
    key: 'system',
    kind: 'system',
    name: 'System',
    element: { representationId: 'observed:system', id: 'system', name: 'System', origin: 'observed' },
    rect: { gx: 3, gy: 3, w: 7, d: 7 },
  }],
  zones: [],
  slabs: [],
  buildings: [{
    representationId: 'observed:component',
    id: 'component',
    name: 'Component',
    origin: 'observed',
    kind: 'component',
    external: false,
    surface: 'system',
    rect: { gx: 20, gy: 20, w: 2, d: 2 },
    heightUnits: 2,
    shape: { kind: 'block' },
    floors: [],
    lines: ['Component'],
  }],
  routes: [{
    id: 'leaves-system',
    source: 'observed:system',
    target: 'outside',
    description: 'Leaves the highlighted system',
    origin: 'observed',
    points: [{ gx: 10, gy: 10 }, { gx: 30, gy: 21 }],
  }],
}

test.concurrent('camera focus fits task routes with context room', () => {
  const scene = projectScene(sheet, {
    name: 'System',
    description: 'System architecture.',
    descriptionBlocks: [{ spans: [{ text: 'System architecture.', styles: [] }] }],
  })
  const viewport = { width: 800, height: 500 }
  const camera = fitHighlights(scene, ['observed:system', 'missing', 'observed:component'], viewport, 4)
  assert.ok(camera)

  const points = [
    ...scene.islands[0]!.polygon,
    ...scene.buildings[0]!.floors.flatMap(floor => floor.flatMap(face => face.points)),
    ...scene.routes[0]!.points,
  ]
  const xs = points.map(point => point.x)
  const ys = points.map(point => point.y)
  const left = Math.min(...xs) * camera.k + camera.x
  const right = Math.max(...xs) * camera.k + camera.x
  const top = Math.min(...ys) * camera.k + camera.y
  const bottom = Math.max(...ys) * camera.k + camera.y

  assert.ok(left >= 120 && right <= viewport.width - 120)
  assert.ok(top >= 120 && bottom <= viewport.height - 120)
  assert.equal((left + right) / 2, viewport.width / 2)
  assert.equal((top + bottom) / 2, viewport.height / 2)
  assert.ok(camera.k <= 4)

  assert.equal(fitHighlights(scene, ['missing'], viewport, 4), undefined)
  const focusedComponent = fitHighlights(scene, ['observed:component'], viewport, 4)
  assert.ok(focusedComponent && focusedComponent.k < 4)
})
