import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  normalizeTerminalPalette,
  rgbToHex,
  TextAttributes,
} from '@opentui/core'
import type { CapturedFrame, CapturedSpan } from '@opentui/core'
import { createTestRenderer } from '@opentui/core/testing'

import { loadArchitectureViewModel } from '../src/core.ts'
import {
  mountTerminalViewer,
  startTerminalViewer,
} from '../src/viewer/terminal-viewer.ts'
import { projectWorld } from '../src/viewer/projection.ts'
import type {
  Bounds,
  C4Kind,
  Point,
  ProjectedElement,
  SemanticLevel,
} from '../src/types.ts'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const fixtureRoot = path.join(repositoryRoot, 'test', 'fixtures', 'core-view')
const sizes = [
  { width: 120, height: 36 },
  { width: 180, height: 50 },
]
interface ViewFixture {
  level: SemanticLevel
  currentId: string
  header: string
  labels: RegExp[]
  visual: RegExp[]
  absent: RegExp[]
}

const views: ViewFixture[] = [
  {
    level: 'context',
    currentId: 'observed:groma',
    header: 'System Context · Groma',
    labels: [/Reads/, /Curates/, /Versions/],
    visual: [/PERSON/, /SYSTEM/, /EXTERNAL SYSTEM/],
    absent: [/CONTAINER/, /COMPONENT/],
  },
  {
    level: 'containers',
    currentId: 'planned:mvp:core',
    header: 'Containers · Core',
    labels: [/Supplies/, /Requests/],
    visual: [/SYSTEM · Groma/, /Terminal viewer/, /CONTAINER/],
    absent: [/COMPONENT/],
  },
  {
    level: 'components',
    currentId: 'planned:mvp:architecture-model',
    header: 'Components · Architecture model',
    labels: [/Applies accepted/],
    visual: [/SYSTEM · Groma/, /CONTAINER · Core/, /COMPONENT/],
    absent: [/PERSON/],
  },
]

function allSpans(captured: CapturedFrame): CapturedSpan[] {
  return captured.lines.flatMap(line => line.spans)
}

function overlaps(left: Bounds, right: Bounds): boolean {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y
}

function visible(bounds: Bounds, viewport: Bounds): boolean {
  return bounds.x < viewport.x + viewport.width
    && bounds.x + bounds.width > viewport.x
    && bounds.y < viewport.y + viewport.height
    && bounds.y + bounds.height > viewport.y
}

function contains(bounds: Bounds, point: Point | undefined): boolean {
  assert.ok(point)
  return point.x >= bounds.x
    && point.x < bounds.x + bounds.width
    && point.y >= bounds.y
    && point.y < bounds.y + bounds.height
}

function characterAt(frame: string, point: Point | undefined): string {
  assert.ok(point)
  const line = frame.split('\n')[point.y]
  assert.ok(line)
  const character = [...line][point.x]
  assert.ok(character)
  return character
}

function levelKind(level: SemanticLevel): Set<C4Kind> {
  if (level === 'context') return new Set<C4Kind>(['person', 'system'])
  return new Set<C4Kind>([level === 'containers' ? 'container' : 'component'])
}

function requiredElement(
  elementsById: Map<string, ProjectedElement>,
  id: string,
): ProjectedElement {
  const element = elementsById.get(id)
  assert.ok(element)
  return element
}

test('renders stable MVP frames at every semantic level and representative size', async () => {
  const response = await loadArchitectureViewModel(repositoryRoot)
  const palette = normalizeTerminalPalette()
  const selectedColor = rgbToHex(palette.palette[2])

  for (const size of sizes) {
    for (const view of views) {
      const setup = await createTestRenderer(size)
      const app = mountTerminalViewer(setup.renderer, response, view)
      await setup.renderOnce()
      const first = setup.captureCharFrame()
      const captured = setup.captureSpans()
      await setup.renderOnce()

      assert.equal(setup.captureCharFrame(), first)
      assert.match(first, new RegExp(view.header.replace('·', '\\·')))
      assert.match(first, /- context \| containers \| components \+\s+Esc exit/)
      assert.match(first, /[▶◀▲▼]/)
      assert.ok((first.match(/[┌┐└┘]/g) ?? []).length >= 8)
      assert.match(first, /(observed|planned)/)
      for (const label of view.labels) assert.match(first, label)
      for (const visual of view.visual) assert.match(first, visual)
      for (const absent of view.absent) assert.doesNotMatch(first, absent)

      const projection = projectWorld(response.world, { ...size, ...view })
      const kinds = levelKind(view.level)
      const cards = projection.elements.filter(element => {
        return kinds.has(element.kind)
          && element.display === 'card'
          && visible(element.cellBounds, projection.viewport)
      })
      for (let leftIndex = 0; leftIndex < cards.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < cards.length; rightIndex += 1) {
          const left = cards[leftIndex]
          const right = cards[rightIndex]
          assert.ok(left && right)
          assert.equal(
            overlaps(
              left.cellBounds,
              right.cellBounds,
            ),
            false,
            `${left.representationId} overlaps ${right.representationId}`,
          )
        }
      }

      assert.ok(projection.elements.some(element => element.display === 'hidden'))
      assert.ok(projection.elements
        .filter(element => element.display === 'card')
        .every(element => element.cellBounds.width >= 21
          && element.cellBounds.height >= 5))
      if (view.level !== 'context') {
        assert.ok(projection.elements.some(element => element.display === 'compact'))
        const boundary = projection.elements.find(element => {
          return element.display === `${view.level === 'containers' ? 'system' : 'container'}-boundary`
        })
        assert.ok(boundary)
        for (const card of cards) {
          assert.ok(card.cellBounds.x >= boundary.cellBounds.x + 2)
          assert.ok(card.cellBounds.y >= boundary.cellBounds.y + 2)
          assert.ok(card.cellBounds.x + card.cellBounds.width
            <= boundary.cellBounds.x + boundary.cellBounds.width - 2)
          assert.ok(card.cellBounds.y + card.cellBounds.height
            <= boundary.cellBounds.y + boundary.cellBounds.height - 2)
        }
      }
      const projectedById = new Map(projection.elements.map(element => [
        element.representationId,
        element,
      ]))
      for (const relationship of projection.relationships) {
        const source = requiredElement(projectedById, relationship.displaySource).cellBounds
        const target = requiredElement(projectedById, relationship.displayTarget).cellBounds
        assert.equal(contains(source, relationship.cellRoute[0]), false)
        assert.equal(contains(target, relationship.cellRoute.at(-1)), false)
        assert.match(
          characterAt(first, relationship.cellRoute.at(-1)),
          /[▶◀▲▼]/,
          `${relationship.id} lost its arrowhead`,
        )
        for (let index = 1; index < relationship.cellRoute.length; index += 1) {
          const previous = relationship.cellRoute[index - 1]
          const point = relationship.cellRoute[index]
          assert.ok(previous && point)
          assert.ok(previous.x === point.x || previous.y === point.y)
        }
      }

      const highlightedLevel = allSpans(captured).some(span => {
        return span.text.includes(view.level === 'context' ? 'context' : view.level)
          && rgbToHex(span.fg) === selectedColor
          && (span.attributes & TextAttributes.BOLD) !== 0
      })
      assert.equal(highlightedLevel, true)
      app.destroy()
    }
  }
})

test('renders distinct planned and missing dotted annotations with observed tint', async () => {
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

  assert.match(frame, /observed/)
  assert.match(frame, /planned/)
  assert.match(frame, /missing/)
  assert.match(frame, /[┄┈┊]/)
  assert.ok(spans.some(span => rgbToHex(span.fg) === rgbToHex(palette.palette[4])))
  assert.ok(spans.some(span => rgbToHex(span.fg) === rgbToHex(palette.palette[1])))
  assert.ok(spans.some(span => {
    return rgbToHex(span.bg) !== rgbToHex(palette.defaultBackground)
  }))
  app.destroy()
})

test('resize and semantic projection preserve the core world', async () => {
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
  assert.match(setup.captureCharFrame(), /Components · Legacy ordering/)
  assert.deepEqual(response.world, worldBefore)
  app.destroy()
})

test('headless groma view startup releases its renderer and input handler', async () => {
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const inputListeners = setup.renderer.keyInput.listenerCount('keypress')
  const app = await startTerminalViewer(fixtureRoot, {
    renderer: setup.renderer,
    palette: normalizeTerminalPalette(),
  })

  assert.equal(
    setup.renderer.keyInput.listenerCount('keypress'),
    inputListeners + 1,
  )
  await setup.renderOnce()
  assert.match(setup.captureCharFrame(), /System Context · Shop/)
  setup.mockInput.pressEscape()
  await app.closed
  assert.equal(setup.renderer.isDestroyed, true)
  assert.equal(setup.renderer.root.getChildrenCount(), 0)
  assert.equal(
    setup.renderer.keyInput.listenerCount('keypress'),
    inputListeners,
  )
})

test('viewer modules consume only the core response and fixed world', async () => {
  const sources = await Promise.all([
    'src/viewer/terminal-viewer.ts',
    'src/viewer/projection.ts',
    'src/viewer/paint.ts',
  ].map(filename => readFile(path.join(repositoryRoot, filename), 'utf8')))
  const viewerSource = sources.join('\n')

  assert.doesNotMatch(
    viewerSource,
    /node:fs|architecture-reader|world-layout|elkjs|groma\/(?:observed|missing|plans)/,
  )
})
