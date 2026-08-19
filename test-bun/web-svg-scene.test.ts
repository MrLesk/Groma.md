import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { semanticView } from '../src/semantic-view.ts'
import type { ArchitectureWorld, Point, WorldRelationship } from '../src/types.ts'
import {
  buildSvgScene,
  cameraViewBox,
  defaultProjection,
  enterSemanticScope,
  fitCamera,
  leaveSemanticScope,
  panCamera,
  selectionScope,
  semanticKeyAction,
  synchronizeSemanticScope,
  zoomAt,
} from '../src/viewers/web/svg-scene.ts'
import { flowSyncDecision } from '../src/viewers/web/svg-flow.ts'
import { renderPage } from '../src/viewers/web/page.ts'
import { box } from './helpers.ts'

function link(
  id: string,
  source: string,
  target: string,
  route: Point[],
): WorldRelationship {
  return {
    id,
    source,
    target,
    description: id,
    technology: '',
    origin: 'observed',
    route,
    label: { x: 40, y: 20, width: 12, height: 4 },
  }
}

function world(): ArchitectureWorld {
  const component = box('component', 'component', { x: 26, y: 14, width: 18, height: 10 }, {
    parent: 'observed:container',
  })
  const container = box('container', 'container', { x: 20, y: 8, width: 36, height: 28 }, {
    parent: 'observed:system',
    children: [component.representationId],
  })
  const system = box('system', 'system', { x: 10, y: 0, width: 70, height: 48 }, {
    children: [container.representationId],
  })
  const person = box('person', 'person', { x: 0, y: 18, width: 12, height: 12 })
  return {
    bounds: { x: 0, y: 0, width: 90, height: 60 },
    groups: [],
    elements: [system, container, component, person],
    relationships: [link(
      'uses',
      person.representationId,
      component.representationId,
      [{ x: 12, y: 24 }, { x: 20, y: 24 }],
    )],
  }
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== 'object') return
  Object.freeze(value)
  for (const child of Object.values(value)) deepFreeze(child)
}

test.concurrent('SVG scene projects semantic routes, fits them, and leaves the view immutable', () => {
  const source = world()
  deepFreeze(source)
  const view = semanticView(source, { level: 'context' })
  deepFreeze(view)
  const iso = buildSvgScene(view, defaultProjection)
  const plan = buildSvgScene(view, { rotation: 0, elevation: Math.PI / 2 })
  assert.deepEqual(iso.routes.map(route => route.route.id), ['uses'])
  assert.notDeepEqual(iso.items[0]?.points, plan.items[0]?.points)

  const camera = fitCamera(iso, 800, 400)
  const box = cameraViewBox(camera)
  for (const item of iso.items) {
    for (const point of item.points) {
      assert.ok(point.x >= box.x && point.x <= box.x + box.width)
      assert.ok(point.y >= box.y && point.y <= box.y + box.height)
    }
  }
  for (const route of iso.routes) {
    for (const point of route.points) {
      assert.ok(point.x >= box.x && point.x <= box.x + box.width)
      assert.ok(point.y >= box.y && point.y <= box.y + box.height)
    }
  }
  const label = iso.routes[0]?.label
  assert.ok(label)
  for (const point of [
    { x: label.x, y: label.y },
    { x: label.x + label.width, y: label.y + label.height },
  ]) {
    assert.ok(point.x >= box.x && point.x <= box.x + box.width)
    assert.ok(point.y >= box.y && point.y <= box.y + box.height)
  }
  assert.deepEqual(source.elements[0]?.bounds, { x: 10, y: 0, width: 70, height: 48 })
  assert.deepEqual(source.relationships[0]?.route, [{ x: 12, y: 24 }, { x: 20, y: 24 }])
})

test.concurrent('SVG camera keeps cursor zoom anchored and pans in world units', () => {
  const source = world()
  const view = semanticView(source, { level: 'context' })
  const camera = fitCamera(buildSvgScene(view), 800, 400)
  const anchor = { x: 30, y: 20 }
  const zoomed = zoomAt(camera, 2, anchor)
  assert.deepEqual(cameraViewBox(zoomed), {
    x: anchor.x - (anchor.x - camera.center.x) * 0.5 - zoomed.baseWidth / zoomed.zoom / 2,
    y: anchor.y - (anchor.y - camera.center.y) * 0.5 - zoomed.baseHeight / zoomed.zoom / 2,
    width: zoomed.baseWidth / zoomed.zoom,
    height: zoomed.baseHeight / zoomed.zoom,
  })
  const panned = panCamera(zoomed, 40, -20)
  assert.notDeepEqual(panned.center, zoomed.center)
})

test.concurrent('SVG Enter and Backspace preserve the entered semantic boundary', () => {
  const source = world()
  const context = {
    level: 'context' as const,
    focusId: null,
    selectedId: 'observed:system',
  }
  const containers = enterSemanticScope(source, context)
  assert.deepEqual(containers, {
    level: 'containers',
    focusId: 'observed:system',
    selectedId: 'observed:container',
  })
  const components = enterSemanticScope(source, containers)
  assert.deepEqual(components, {
    level: 'components',
    focusId: 'observed:container',
    selectedId: 'observed:component',
  })
  assert.deepEqual(leaveSemanticScope(source, components), containers)
  assert.deepEqual(leaveSemanticScope(source, containers), context)
  assert.deepEqual(leaveSemanticScope(source, {
    level: 'components',
    focusId: 'observed:container',
    selectedId: 'observed:system',
  }), containers)
  assert.deepEqual(enterSemanticScope(source, {
    ...context,
    selectedId: 'observed:person',
  }), {
    ...context,
    selectedId: 'observed:person',
  })
})

test.concurrent('deep picks use visible semantic scopes and SSE keeps valid scope targets', () => {
  const source = world()
  assert.deepEqual(selectionScope(source, 'observed:system'), {
    level: 'context',
    focusId: null,
    selectedId: 'observed:system',
  })
  assert.deepEqual(selectionScope(source, 'observed:container'), {
    level: 'containers',
    focusId: 'observed:system',
    selectedId: 'observed:container',
  })
  assert.deepEqual(selectionScope(source, 'observed:component'), {
    level: 'components',
    focusId: 'observed:container',
    selectedId: 'observed:component',
  })

  const context = synchronizeSemanticScope(source, {
    level: 'context',
    focusId: null,
    selectedId: 'observed:container',
  })
  assert.equal(context.scope.selectedId, 'observed:system')
  assert.ok(context.view.selectionTargets.some(target => target.representationId === context.scope.selectedId))

  const other = box('other-container', 'container', { x: 60, y: 8, width: 24, height: 28 }, {
    parent: 'observed:system',
  })
  const moved: ArchitectureWorld = {
    ...source,
    elements: source.elements.map(element => {
      if (element.representationId === 'observed:system') {
        return { ...element, children: ['observed:container', other.representationId] }
      }
      if (element.representationId === 'observed:container') {
        return { ...element, children: [] }
      }
      if (element.representationId === 'observed:component') {
        return { ...element, parent: other.representationId }
      }
      return element
    }).concat(other),
  }
  const updated = synchronizeSemanticScope(moved, {
    level: 'components',
    focusId: 'observed:container',
    selectedId: 'observed:component',
  })
  assert.deepEqual(updated.scope, {
    level: 'components',
    focusId: 'observed:container',
    selectedId: 'observed:container',
  })
})

test.concurrent('web key routing enters hierarchy rows without hijacking controls', () => {
  assert.equal(semanticKeyAction('Enter', 'hierarchy'), 'enter')
  assert.equal(semanticKeyAction('Enter', 'control'), undefined)
  assert.equal(semanticKeyAction('Backspace', 'control'), 'leave')
  assert.equal(semanticKeyAction('Backspace', 'text'), undefined)
})

test.concurrent('projecting a new flow geometry preserves active travel progress', () => {
  assert.deepEqual(
    flowSyncDecision('walk', 'before-orbit', 18, 'walk', 'after-orbit'),
    { refresh: true, travelled: 18 },
  )
  assert.deepEqual(
    flowSyncDecision('walk', 'after-orbit', 18, 'next-walk', 'new'),
    { refresh: true, travelled: 0 },
  )
  assert.deepEqual(
    flowSyncDecision('walk', 'after-orbit', 18, 'walk', 'after-orbit'),
    { refresh: false, travelled: 18 },
  )
})

test.concurrent('the production Web page bundles an SVG-only map controller', async () => {
  const page = renderPage(world())
  assert.match(page, /<div id="map"><\/div>/)
  assert.doesNotMatch(page, /<canvas\b/i)

  const build = await Bun.build({
    entrypoints: [new URL('../src/viewers/web/render.ts', import.meta.url).pathname],
    target: 'browser',
  })
  assert.equal(build.success, true)
  const output = build.outputs[0]
  assert.ok(output)
  const source = await output.text()
  assert.match(source, /createElementNS/)
  assert.match(source, /replaceChildren\(mapSvg\)/)
  assert.doesNotMatch(source, /WebGLRenderer|new Canvas|THREE/i)
})
