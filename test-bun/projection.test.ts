import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { createTestRenderer } from '@opentui/core/testing'

import { loadArchitectureViewModel } from '../src/core.ts'
import { mountTerminalViewer } from '../src/viewers/tui/terminal-viewer.ts'
import { letterName } from '../src/viewers/tui/projection-display.ts'
import { MAP_SCALE } from '../src/viewers/tui/projection-camera.ts'
import { projectWorld } from '../src/viewers/tui/projection.ts'
import type {
  ArchitectureWorld,
  C4Kind,
  TerminalLevel,
  WorldElement,
} from '../src/types.ts'
import {
  cameraOn,
  box,
  containersFixtureRoot,
  contains,
  fixtureRoot,
  mapRegion,
  mapViewportOf,
  overlaps,
  projectedById,
  viewerFixtureRoot,
  requiredElement,
  visible,
} from './helpers.ts'

const sizes = [
  { width: 120, height: 36 },
  { width: 180, height: 50 },
]

const views: Array<{ level: TerminalLevel; currentId: string }> = [
  { level: 'context', currentId: 'observed:shop' },
  { level: 'components', currentId: 'observed:orders' },
]

function levelKind(level: TerminalLevel): Set<C4Kind> {
  if (level === 'context') return new Set<C4Kind>(['actor', 'system'])
  return new Set<C4Kind>(['component'])
}

test.concurrent('frames are stable and projections hold world invariants at every level and size', async () => {
  const response = await loadArchitectureViewModel(viewerFixtureRoot)

  for (const size of sizes) {
    for (const view of views) {
      const setup = await createTestRenderer(size)
      const app = mountTerminalViewer(setup.renderer, response, view)
      await setup.renderOnce()
      const first = setup.captureCharFrame()
      await setup.renderOnce()
      assert.equal(setup.captureCharFrame(), first)

      assert.doesNotMatch(
        mapRegion(first, size.width),
        /observed|planned|missing|SYSTEM|CONTAINER|COMPONENT|ACTOR/,
      )

      const projection = projectWorld(response.world, {
        viewport: mapViewportOf(size),
        ...view,
      })
      assert.equal(projection.camera.zoom, MAP_SCALE)

      const kinds = levelKind(view.level)
      const cards = projection.elements.filter(element => {
        return kinds.has(element.kind)
          && element.display === 'card'
          && visible(element.cellBounds, projection.viewport)
      })
      for (let leftIndex = 0; leftIndex < cards.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < cards.length; rightIndex += 1) {
          const left = cards[leftIndex]!
          const right = cards[rightIndex]!
          assert.equal(
            overlaps(left.cellBounds, right.cellBounds),
            false,
            `${left.representationId} overlaps ${right.representationId}`,
          )
        }
      }

      const byId = projectedById(projection.elements)
      const selected = requiredElement(byId, view.currentId)
      assert.ok(
        selected.display === 'hidden'
          || visible(selected.cellBounds, projection.viewport),
      )
      if (view.level === 'context') {
        const groma = requiredElement(byId, 'observed:shop')
        const actor = requiredElement(byId, 'observed:shop-architect')
        assert.equal(groma.display, 'system-boundary')
        assert.ok(
          groma.cellBounds.width * groma.cellBounds.height
            > actor.cellBounds.width * actor.cellBounds.height,
        )
        assert.ok(projection.elements.some(element => {
          return element.kind === 'container'
            && element.display === 'container-boundary'
            && letterName(element, 'context')
            && element.cellBounds.x >= groma.cellBounds.x
            && element.cellBounds.y >= groma.cellBounds.y
            && element.cellBounds.x + element.cellBounds.width
              <= groma.cellBounds.x + groma.cellBounds.width
            && element.cellBounds.y + element.cellBounds.height
              <= groma.cellBounds.y + groma.cellBounds.height
        }))
        assert.ok(projection.elements.every(element => {
          return element.kind !== 'component' || element.display === 'hidden'
        }))
        assert.ok(letterName(groma, 'context'))
        assert.ok(letterName(actor, 'context'))
      }
      for (const card of cards) {
        if (card.parent === null) continue
        const parent = requiredElement(byId, card.parent)
        assert.ok(card.cellBounds.x >= parent.cellBounds.x)
        assert.ok(card.cellBounds.y >= parent.cellBounds.y)
        assert.ok(card.cellBounds.x + card.cellBounds.width
          <= parent.cellBounds.x + parent.cellBounds.width)
        assert.ok(card.cellBounds.y + card.cellBounds.height
          <= parent.cellBounds.y + parent.cellBounds.height)
      }
      for (const relationship of projection.relationships) {
        const source = requiredElement(byId, relationship.displaySource).cellBounds
        const target = requiredElement(byId, relationship.displayTarget).cellBounds
        assert.equal(contains(source, relationship.cellRoute[0]), false)
        assert.equal(contains(target, relationship.cellRoute.at(-1)), false)
        for (let index = 1; index < relationship.cellRoute.length; index += 1) {
          const previous = relationship.cellRoute[index - 1]!
          const point = relationship.cellRoute[index]!
          assert.ok(previous.x === point.x || previous.y === point.y)
        }
      }
      app.destroy()
    }
  }
})

test.concurrent('root keeps named groups collapsed while component cards stay hidden', () => {
  const system = box('system', 'system', { x: 0, y: 0, width: 120, height: 80 }, {
    children: ['observed:container'],
  })
  const container = box('container', 'container', { x: 10, y: 10, width: 90, height: 60 }, {
    parent: system.representationId,
    children: ['observed:component'],
  })
  const component = box('component', 'component', { x: 20, y: 20, width: 34, height: 16 }, {
    parent: container.representationId,
    group: 'Domain',
  })
  const world: ArchitectureWorld = {
    bounds: system.bounds,
    elements: [system, container, component],
    groups: [{
      id: 'group:observed:container:Domain',
      name: 'Domain',
      parent: container.representationId,
      bounds: { x: 16, y: 16, width: 44, height: 28 },
    }],
    relationships: [],
  }
  const projection = projectWorld(world, {
    viewport: mapViewportOf({ width: 120, height: 36 }),
    level: 'context',
    currentId: system.representationId,
  })
  assert.equal(projection.groups[0]?.name, 'Domain')
  assert.equal(requiredElement(
    projectedById(projection.elements),
    component.representationId,
  ).display, 'hidden')
})

test.concurrent('planned and missing elements render with distinct dashes and observed tint', async () => {
  const response = await loadArchitectureViewModel(fixtureRoot)
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const app = mountTerminalViewer(setup.renderer, response, {
    level: 'components',
    currentId: 'missing:legacy',
  })
  await setup.renderOnce()
  const frame = setup.captureCharFrame()

  assert.doesNotMatch(
    mapRegion(frame, 120),
    /observed|planned|missing|SYSTEM|CONTAINER|COMPONENT|ACTOR/,
  )
  assert.match(frame, /[╌┆]/)
  assert.match(frame, /[┈┊░]/)
  app.destroy()
})

test.concurrent('resize and semantic projection preserve the core world', async () => {
  const response = await loadArchitectureViewModel(fixtureRoot)
  const worldBefore = structuredClone(response.world)
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const app = mountTerminalViewer(setup.renderer, response)
  await setup.renderOnce()
  const contextFrame = setup.captureCharFrame()
  setup.resize(180, 50)
  await setup.renderOnce()
  assert.notEqual(setup.captureCharFrame(), contextFrame)
  app.setView({ level: 'components', currentId: 'missing:legacy' })
  await setup.renderOnce()
  assert.deepEqual(response.world, worldBefore)
  app.destroy()
})

test.concurrent('a hidden endpoint promotes its route to the nearest displayed ancestor', async () => {
  const fixture = await loadArchitectureViewModel(containersFixtureRoot)
  const projection = projectWorld(fixture.world, {
    viewport: mapViewportOf({ width: 120, height: 36 }),
    level: 'components',
    currentId: 'observed:page',
  })
  const promoted = projection.relationships.find(relationship => {
    return relationship.source === 'observed:page'
      && relationship.target === 'observed:orders'
  })
  assert.ok(promoted)
  assert.equal(promoted.displaySource, 'observed:page')
  assert.equal(promoted.displayTarget, 'observed:web')
})

test.concurrent('components level shows only the focused container children', async () => {
  const fixture = await loadArchitectureViewModel(fixtureRoot)
  const projection = projectWorld(fixture.world, {
    viewport: mapViewportOf({ width: 120, height: 36 }),
    level: 'components',
    currentId: 'observed:api',
  })
  const cards = projection.elements.filter(element => {
    return element.display === 'card' && element.kind === 'component'
  })
  assert.ok(cards.length > 0)
  assert.ok(cards.every(element => element.parent === 'observed:api'))
  assert.ok(cards.some(element => visible(element.cellBounds, projection.viewport)))
  assert.ok(projection.elements.every(element => {
    return element.parent !== 'planned:inventory:api' || element.display === 'hidden'
  }))
})

test.concurrent('selection changes never move the camera and pan only when off screen', async () => {
  const response = await loadArchitectureViewModel(viewerFixtureRoot)
  const viewport = mapViewportOf({ width: 120, height: 36 })

  const modelView = projectWorld(response.world, {
    viewport,
    level: 'components',
    currentId: 'observed:orders',
  })
  const siblingView = projectWorld(response.world, {
    viewport,
    level: 'components',
    currentId: 'observed:pricing',
    camera: modelView.camera,
  })
  assert.deepEqual(siblingView.camera, modelView.camera)
  assert.deepEqual(
    siblingView.elements.map(element => [element.representationId, element.cellBounds]),
    modelView.elements.map(element => [element.representationId, element.cellBounds]),
  )

  const start = projectWorld(response.world, {
    viewport,
    level: 'context',
    currentId: 'observed:shop',
    camera: cameraOn(response.world, 'observed:shop', 1),
  })
  assert.equal(start.camera.zoom, MAP_SCALE)
  for (const id of ['observed:shop-architect', 'observed:shop-operator', 'observed:vault']) {
    const panned = projectWorld(response.world, {
      viewport,
      level: 'context',
      currentId: id,
      camera: start.camera,
    })
    assert.notDeepEqual(panned.camera, start.camera)
    assert.equal(panned.camera.zoom, start.camera.zoom)
    assert.ok(visible(
      requiredElement(projectedById(panned.elements), id).cellBounds,
      panned.viewport,
    ))
  }

  const labeled = projectWorld(response.world, {
    viewport,
    level: 'context',
    currentId: 'observed:shop-architect',
  })
  const contextCards = labeled.elements.filter(element => {
    return element.display === 'card'
      && (element.kind === 'actor' || element.external)
      && visible(element.cellBounds, labeled.viewport)
  })
  assert.ok(contextCards.some(element => element.id === 'shop-architect'))
  for (const relationship of labeled.relationships) {
    if (!relationship.cellLabel) continue
    const label = { ...relationship.cellLabel, height: 1 }
    for (const card of contextCards) {
      const nameLine = {
        x: card.cellBounds.x + 3,
        y: card.cellBounds.y + 1,
        width: Math.max(0, card.cellBounds.width - 5),
        height: 1,
      }
      assert.equal(
        overlaps(label, nameLine),
        false,
        `${relationship.id} covers ${card.id} name`,
      )
    }
  }
})

test.concurrent('actor cards use full names when the map has room', async () => {
  const response = await loadArchitectureViewModel(viewerFixtureRoot)
  const operator = response.world.elements.find(element => {
    return element.id === 'shop-operator'
  })
  const architect = response.world.elements.find(element => {
    return element.id === 'shop-architect'
  })
  assert.ok(operator)
  assert.ok(architect)
  const camera = {
    zoom: 0.35,
    centerX: (operator.bounds.x + architect.bounds.x + architect.bounds.width) / 2,
    centerY: (operator.bounds.y + architect.bounds.y + architect.bounds.height) / 2,
  }
  const view = projectWorld(response.world, {
    viewport: mapViewportOf({ width: 120, height: 36 }),
    currentId: 'observed:shop-operator',
    camera,
  })
  const byId = projectedById(view.elements)
  const actors = [
    requiredElement(byId, 'observed:shop-operator'),
    requiredElement(byId, 'observed:shop-architect'),
  ]
  for (const actor of actors) {
    assert.equal(visible(actor.cellBounds, view.viewport), true, actor.name)
    assert.ok(
      actor.cellBounds.width >= actor.name.length + 7,
      `${actor.name} is ${actor.cellBounds.width} cells`,
    )
  }
  const groma = requiredElement(byId, 'observed:shop')
  const git = requiredElement(byId, 'observed:vault')
  assert.equal(overlaps(actors[0]!.cellBounds, actors[1]!.cellBounds), false)
  for (const actor of actors) {
    assert.equal(overlaps(actor.cellBounds, groma.cellBounds), false)
    assert.equal(overlaps(actor.cellBounds, git.cellBounds), false)
  }
})
