import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { normalizeTerminalPalette, rgbToHex } from '@opentui/core'
import type { CapturedFrame, CapturedSpan } from '@opentui/core'
import { createTestRenderer } from '@opentui/core/testing'

import { loadArchitectureViewModel } from '../src/core.ts'
import { mountTerminalViewer } from '../src/viewers/tui/terminal-viewer.ts'
import { letterName } from '../src/viewers/tui/projection-display.ts'
import { projectWorld } from '../src/viewers/tui/projection.ts'
import type {
  ArchitectureWorld,
  C4Kind,
  SemanticLevel,
  WorldElement,
} from '../src/types.ts'
import {
  cameraOn,
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

const views: Array<{ level: SemanticLevel; currentId: string }> = [
  { level: 'context', currentId: 'observed:shop' },
  { level: 'containers', currentId: 'observed:api' },
  { level: 'components', currentId: 'observed:orders' },
]

function allSpans(captured: CapturedFrame): CapturedSpan[] {
  return captured.lines.flatMap(line => line.spans)
}

function levelKind(level: SemanticLevel): Set<C4Kind> {
  if (level === 'context') return new Set<C4Kind>(['person', 'system'])
  return new Set<C4Kind>([level === 'containers' ? 'container' : 'component'])
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
        /observed|planned|missing|SYSTEM|CONTAINER|COMPONENT|PERSON/,
      )

      const projection = projectWorld(response.world, {
        viewport: mapViewportOf(size),
        ...view,
      })
      assert.equal(projection.camera.zoom, projection.fitZoom)
      assert.ok(projection.camera.zoom <= 1)

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
        const person = requiredElement(byId, 'observed:shop-architect')
        assert.equal(groma.display, 'system-boundary')
        assert.ok(
          groma.cellBounds.width * groma.cellBounds.height
            > person.cellBounds.width * person.cellBounds.height,
        )
        for (const id of [
          'observed:shop-architect',
          'observed:shop-operator',
          'observed:vault',
        ]) {
          assert.ok(
            visible(requiredElement(byId, id).cellBounds, projection.viewport),
            id,
          )
        }
        assert.ok(projection.elements.some(element => {
          return element.kind === 'container'
            && element.display === 'container-boundary'
            && !letterName(element, 'context')
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
        assert.ok(letterName(person, 'context'))
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

test.concurrent('planned and missing elements render with distinct dashes and observed tint', async () => {
  const response = await loadArchitectureViewModel(fixtureRoot)
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const app = mountTerminalViewer(setup.renderer, response, {
    level: 'components',
    currentId: 'missing:legacy',
  })
  await setup.renderOnce()
  const frame = setup.captureCharFrame()
  const spans = allSpans(setup.captureSpans())
  const palette = normalizeTerminalPalette()

  assert.doesNotMatch(
    mapRegion(frame, 120),
    /observed|planned|missing|SYSTEM|CONTAINER|COMPONENT|PERSON/,
  )
  assert.match(frame, /[╌┆]/)
  assert.match(frame, /[┈┊░]/)
  assert.ok(spans.some(span => rgbToHex(span.fg) === rgbToHex(palette.palette[1])))
  assert.ok(spans.some(span => {
    return rgbToHex(span.bg) !== rgbToHex(palette.defaultBackground)
  }))
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

test.concurrent('containers view attaches a component relationship to named containers', async () => {
  const fixture = await loadArchitectureViewModel(containersFixtureRoot)
  const projection = projectWorld(fixture.world, {
    viewport: mapViewportOf({ width: 120, height: 36 }),
    level: 'containers',
    currentId: 'observed:shop',
  })
  const direct = projection.relationships.find(relationship => {
    return relationship.source === 'observed:page'
      && relationship.target === 'observed:orders'
  })
  assert.ok(direct)
  assert.equal(direct.displaySource, 'observed:web')
  assert.equal(direct.displayTarget, 'observed:api')
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
  assert.equal(promoted.displayTarget, 'observed:shop')
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

  const systemView = projectWorld(response.world, {
    viewport,
    level: 'context',
    currentId: 'observed:shop',
  })
  const operatorView = projectWorld(response.world, {
    viewport,
    level: 'context',
    currentId: 'observed:shop-operator',
  })
  assert.deepEqual(operatorView.camera, systemView.camera)
  assert.deepEqual(
    operatorView.elements.map(element => [element.representationId, element.cellBounds]),
    systemView.elements.map(element => [element.representationId, element.cellBounds]),
  )

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
  assert.equal(start.camera.zoom, 1)
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
      && (element.kind === 'person' || element.external)
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

test.concurrent('person cards use full names when the map has room', async () => {
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
  const people = [
    requiredElement(byId, 'observed:shop-operator'),
    requiredElement(byId, 'observed:shop-architect'),
  ]
  for (const person of people) {
    assert.equal(visible(person.cellBounds, view.viewport), true, person.name)
    assert.ok(
      person.cellBounds.width >= person.name.length + 7,
      `${person.name} is ${person.cellBounds.width} cells`,
    )
  }
  const groma = requiredElement(byId, 'observed:shop')
  const git = requiredElement(byId, 'observed:vault')
  assert.equal(overlaps(people[0]!.cellBounds, people[1]!.cellBounds), false)
  for (const person of people) {
    assert.equal(overlaps(person.cellBounds, groma.cellBounds), false)
    assert.equal(overlaps(person.cellBounds, git.cellBounds), false)
  }
})
