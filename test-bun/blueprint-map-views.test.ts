import { describe, expect, test } from 'bun:test'
import { sheetScene } from '../src/sheet/scene.ts'
import { planeMatrix, project, projectScene } from '../src/viewers/web/iso/project.ts'
import { sceneAtSeparation } from '../src/viewers/web/layers/separation.ts'
import type { Point } from '../src/types.ts'
import { graphFor } from '../research/blueprints/view.ts'
import { INITIAL_VIEW, PLAN_PROJECTION, chooseMapView, presentSheet, toggleLayers } from '../research/blueprints/map-projection.ts'
import type { MapView } from '../research/blueprints/map-projection.ts'
import type { Project } from '../research/blueprints/model.ts'
import { validateBlueprint } from '../research/blueprints/model.ts'
import { preparePlacement } from '../research/blueprints/placement.ts'
import projects from '../test/fixtures/blueprint-research/projects.json'
import blueprint from '../test/fixtures/blueprint-research/saved-card.json'

function fixture() {
  const p = structuredClone(projects[0]) as Project
  const draft = preparePlacement(p, validateBlueprint(blueprint), { checkout: 'shop-checkout', host: 'shop-api', provider: 'shop-provider' })
  return sheetScene(graphFor(p, draft))
}
const views: MapView[] = ['iso', '2d', 'layers']
function onSegment(point: Point, a: Point, b: Point): boolean {
  const dx = b.x - a.x; const dy = b.y - a.y
  const cross = (point.x - a.x) * dy - (point.y - a.y) * dx
  return Math.abs(cross) < 1e-5 && point.x >= Math.min(a.x, b.x) - 1e-5
    && point.x <= Math.max(a.x, b.x) + 1e-5 && point.y >= Math.min(a.y, b.y) - 1e-5
    && point.y <= Math.max(a.y, b.y) + 1e-5
}

describe('editor view state', () => {
  test.concurrent('F2 returns to the last 2D plane', () => {
    const state = chooseMapView(INITIAL_VIEW, '2d')
    expect(toggleLayers(state).view).toBe('layers')
    expect(toggleLayers(toggleLayers(state))).toEqual(state)
  })
  test.concurrent('F2 returns to isometric by default', () => {
    expect(toggleLayers(toggleLayers(INITIAL_VIEW))).toEqual(INITIAL_VIEW)
  })
  test.concurrent('choosing a nested view while layered changes the return target', () => {
    const state = chooseMapView(toggleLayers(INITIAL_VIEW), '2d')
    expect(toggleLayers(toggleLayers(state))).toEqual({ view: '2d', nested: '2d' })
    expect(INITIAL_VIEW).toEqual({ view: 'iso', nested: 'iso' })
  })
})

describe('one architectural sheet across projections', () => {
  test.concurrent('all presentations preserve the original sheet', () => {
    const sheet = fixture(); const before = structuredClone(sheet)
    for (const view of views) presentSheet(sheet, view)
    expect(sheet).toEqual(before)
  })
  test.concurrent('isometric is exactly the existing renderer input', () => {
    const sheet = fixture()
    expect(presentSheet(sheet, 'iso')).toEqual(sceneAtSeparation(projectScene(sheet), 0))
  })
  test.concurrent('all views retain element identities and containment rectangles', () => {
    const sheet = fixture()
    const key = (items: { id: string; surface: string; rect: object }[]) => items.map(item => [item.id, item.surface, item.rect]).sort()
    for (const view of views) {
      const scene = presentSheet(sheet, view)
      expect(key(scene.buildings.map(item => item.building))).toEqual(key(sheet.buildings))
      expect(scene.slabs.map(item => item.slab)).toEqual(expect.arrayContaining(sheet.slabs))
      expect(scene.islands.map(item => item.island)).toEqual(sheet.islands)
    }
  })
  test.concurrent('planned and current interactions retain their exact identity, origin and routing cells', () => {
    const sheet = fixture()
    expect(sheet.routes.some(route => route.origin === 'draft')).toBe(true)
    for (const view of views) expect(presentSheet(sheet, view).routes.map(item => item.route)).toEqual(sheet.routes)
  })
  test.concurrent('plan axes and text are horizontal and vertical without reflection', () => {
    const origin = project(0, 0, 0, PLAN_PROJECTION)
    const x = project(1, 0, 0, PLAN_PROJECTION); const y = project(0, 1, 0, PLAN_PROJECTION)
    expect(x.x).toBeGreaterThan(origin.x); expect(x.y).toBeCloseTo(origin.y)
    expect(y.y).toBeGreaterThan(origin.y); expect(y.x).toBeCloseTo(origin.x)
    const matrix = planeMatrix('ground', origin, PLAN_PROJECTION).slice(7, -1).split(' ').map(Number)
    expect(matrix[0]).toBeGreaterThan(0); expect(matrix[3]).toBeGreaterThan(0)
    expect(matrix[1]).toBe(0); expect(matrix[2]).toBe(0)
  })
  test.concurrent('plan collapses every tower to one footprint without side faces', () => {
    const scene = presentSheet(fixture(), '2d')
    for (const building of scene.buildings) {
      expect(building.floors).toHaveLength(1)
      expect(building.floors[0]).toHaveLength(1)
      expect(building.floors[0]![0]!.side).toBe('top')
    }
    expect(scene.slabs.every(slab => slab.faces.length === 1 && slab.faces[0]!.side === 'top')).toBe(true)
  })
  test.concurrent('flattened floor retains the union of visible source files', () => {
    const sheet = fixture()
    for (const item of presentSheet(sheet, '2d').buildings) {
      const original = sheet.buildings.find(building => building.id === item.building.id)!
      expect(item.building.floors.flatMap(floor => floor.files)).toEqual(original.floors.flatMap(floor => floor.files))
    }
  })
  test.concurrent('plan route endpoints meet visible participants, including curved externals', () => {
    const scene = presentSheet(fixture(), '2d')
    let checked = 0
    for (const route of scene.routes) {
      for (const [id, point] of [[route.route.source, route.points[0]!], [route.route.target, route.points.at(-1)!]] as [string, Point][]) {
        const building = scene.buildings.find(item => item.building.representationId === id)
        if (!building) continue
        const polygon = building.floors[0]![0]!.points
        if (building.building.shape.kind === 'block') {
          expect(polygon.some((a, i) => onSegment(point, a, polygon[(i + 1) % polygon.length]!))).toBe(true)
        } else {
          // The projector meets the analytic curved wall, not an approximation at a sampled vertex.
          const scale = project(1, 0, 0, PLAN_PROJECTION).x
          const { gx, gy, w, d } = building.building.rect
          const radius = Math.min(w, d) / 2
          const x = point.x / scale; const y = point.y / scale
          const cap = Math.min(gx + w - radius, Math.max(gx + radius, x))
          expect(Math.hypot(x - cap, y - gy - d / 2)).toBeCloseTo(radius)
        }
        checked++
      }
    }
    expect(checked).toBeGreaterThan(0)
  })
  test.concurrent('plan route legs remain orthogonal', () => {
    for (const route of presentSheet(fixture(), '2d').routes) {
      for (let i = 1; i < route.points.length; i++) {
        const a = route.points[i - 1]!; const b = route.points[i]!
        expect(Math.abs(a.x - b.x) < 1e-5 || Math.abs(a.y - b.y) < 1e-5).toBe(true)
      }
    }
  })
  test.concurrent('only Layers separates the three C4 planes', () => {
    const sheet = fixture()
    expect(presentSheet(sheet, 'iso').layerPlanes).toHaveLength(0)
    expect(presentSheet(sheet, '2d').layerPlanes).toHaveLength(0)
    const layers = presentSheet(sheet, 'layers')
    expect(layers.layerPlanes.map(plane => plane.layer)).toEqual(['system', 'container', 'component'])
    expect(new Set(layers.layerPlanes.map(plane => plane.polygon[0]!.y)).size).toBe(3)
  })
})
