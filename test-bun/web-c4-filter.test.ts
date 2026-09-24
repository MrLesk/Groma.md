import { expect, test } from 'bun:test'
import { loadAnnotatedArchitecture } from '../src/core.ts'
import { sheetScene } from '../src/sheet/scene.ts'
import type { C4Kind } from '../src/types.ts'
import { filterC4Scene } from '../src/viewers/web/chrome/c4-filter.ts'
import { presentScene } from '../src/viewers/web/iso/view-motion/presentation.ts'
import { EXPLODED_POSE, NESTED_POSE, OVERHEAD_POSE } from '../src/viewers/web/iso/view-motion/orbit.ts'
import { viewerFixtureRoot } from './helpers.ts'

test.concurrent('hiding a container preserves its visible children and geometry in every map view', async () => {
  const world = await loadAnnotatedArchitecture(viewerFixtureRoot)
  const sheet = sheetScene(world)
  const original = structuredClone({ world, sheet })
  for (const pose of [NESTED_POSE, OVERHEAD_POSE, EXPLODED_POSE]) {
    const scene = presentScene(sheet, undefined, pose)
    expect(scene.slabs.length).toBeGreaterThan(0)
    const filtered = filterC4Scene(scene, new Set(['container']))
    expect(filtered.slabs).toEqual([])
    expect(filtered.buildings).toEqual(scene.buildings)
    expect(filtered.bounds).toBe(scene.bounds)
    const hiddenIds = new Set(scene.slabs.map(item => item.slab.representationId))
    expect(filtered.routes.every(item => !hiddenIds.has(item.route.source) && !hiddenIds.has(item.route.target))).toBe(true)
    expect(filterC4Scene(scene, new Set())).toBe(scene)
  }
  expect({ world, sheet }).toEqual(original)
})

test.concurrent('each hidden kind removes only its own bodies and routes with missing endpoints', async () => {
  const world = await loadAnnotatedArchitecture(viewerFixtureRoot)
  const scene = presentScene(sheetScene(world), undefined, NESTED_POSE)
  expect(scene.routes.length).toBeGreaterThan(0)
  for (const kind of ['actor', 'system', 'container', 'component'] as const) {
    const filtered = filterC4Scene(scene, new Set([kind]))
    const hidden = new Set(world.elements.filter(element => element.kind === kind).map(element => element.representationId))
    expect(hidden.size).toBeGreaterThan(0)
    expect(filtered.buildings).toEqual(scene.buildings.filter(item => !hidden.has(item.building.representationId)))
    expect(filtered.routes).toEqual(scene.routes.filter(item => !hidden.has(item.route.source) && !hidden.has(item.route.target)))
    if (kind === 'system') {
      expect(filtered.islands.some(item => item.island.kind !== 'actors')).toBe(false)
      expect(filtered.slabs).toEqual(scene.slabs)
    }
  }
})

test.concurrent('combined filters persist across new projections and clear without changing the source scene', async () => {
  const world = await loadAnnotatedArchitecture(viewerFixtureRoot)
  const sheet = sheetScene(world)
  const hidden = new Set<C4Kind>(['actor', 'system', 'container', 'component'])
  for (const pose of [NESTED_POSE, OVERHEAD_POSE, EXPLODED_POSE]) {
    const scene = presentScene(sheet, undefined, pose)
    const before = structuredClone(scene)
    const filtered = filterC4Scene(scene, hidden)
    for (const key of ['buildings', 'islands', 'slabs', 'routes', 'zones', 'layerPlanes'] as const) {
      expect(filtered[key]).toEqual([])
    }
    expect(filtered.bounds).toEqual(scene.bounds)
    expect(scene).toEqual(before)
    expect(filterC4Scene(scene, new Set())).toBe(scene)
  }
})
