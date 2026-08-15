import assert from 'node:assert/strict'
import { cp, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
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
} from '../src/viewers/tui/terminal-viewer.ts'
import {
  defaultSelection,
  initialState,
  reduceViewer,
} from '../src/viewers/tui/navigation.ts'
import type { ViewerState } from '../src/viewers/tui/navigation.ts'
import { footerHints } from '../src/viewers/tui/organisms/chrome.ts'
import { projectWorld } from '../src/viewers/tui/projection.ts'
import type {
  ArchitectureWorld,
  Bounds,
  C4Kind,
  Point,
  ProjectedElement,
  SemanticLevel,
  WorldElement,
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
    currentId: 'observed:core',
    header: 'Containers · Core',
    labels: [/Supplies/, /Requests/],
    visual: [/SYSTEM · Groma/, /Terminal viewer/, /CONTAINER/],
    absent: [/COMPONENT/],
  },
  {
    level: 'components',
    currentId: 'observed:architecture-model',
    header: 'Components · Architecture model',
    labels: [/Supplies/],
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
      assert.match(first, /- context \| containers \| components \+\s+z zoom\s+R refresh\s+Esc exit/)
      assert.match(first, /[▶◀▲▼]/)
      assert.match(first, /▌/)
      assert.doesNotMatch(first, /C4 \//)
      assert.doesNotMatch(first, / › /)
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
  assert.match(frame, /[╌┆┈┊░]/)
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

test('R reloads the world from core and keeps the current view', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-refresh-'))
  const setup = await createTestRenderer({ width: 120, height: 36 })
  let app: ReturnType<typeof mountTerminalViewer> | undefined
  try {
    await cp(fixtureRoot, root, { recursive: true })
    const response = await loadArchitectureViewModel(root)
    app = mountTerminalViewer(setup.renderer, response, {
      level: 'components',
      currentId: 'missing:legacy',
      repositoryRoot: root,
    })
    await setup.renderOnce()
    const before = setup.captureCharFrame()
    assert.match(before, /Components · Legacy ordering/)

    const document = path.join(
      root,
      'groma/missing/systems/shop/containers/api/components/legacy.md',
    )
    const markdown = await readFile(document, 'utf8')
    await writeFile(
      document,
      markdown.replace('# Legacy ordering', '# Legacy queue'),
    )

    setup.mockInput.pressKey('r')
    await app.refresh()
    await setup.renderOnce()
    const after = setup.captureCharFrame()
    assert.match(after, /Components · Legacy queue/)
    assert.doesNotMatch(after, /Legacy ordering/)
  } finally {
    app?.destroy()
    if (!setup.renderer.isDestroyed) setup.renderer.destroy()
    await rm(root, { recursive: true, force: true })
  }
})

async function listTypeScript(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await listTypeScript(entryPath))
    else if (entry.name.endsWith('.ts')) files.push(entryPath)
  }
  return files
}

test('viewer modules consume only the core response and fixed world', async () => {
  const sources = await Promise.all(
    (await listTypeScript(path.join(repositoryRoot, 'src/viewers/tui')))
      .map(filename => readFile(filename, 'utf8')),
  )
  const viewerSource = sources.join('\n')

  assert.doesNotMatch(
    viewerSource,
    /node:fs|architecture-reader|world-layout|elkjs|groma\/(?:observed|missing|plans)/,
  )
})

function box(
  id: string,
  kind: C4Kind,
  bounds: Bounds,
  extra: Partial<WorldElement> = {},
): WorldElement {
  return {
    representationId: extra.representationId ?? `observed:${id}`,
    id,
    kind,
    name: extra.name ?? id,
    description: extra.description ?? '',
    parent: extra.parent ?? null,
    children: extra.children ?? [],
    external: extra.external ?? false,
    code: extra.code ?? [],
    origin: extra.origin ?? 'observed',
    bounds,
  }
}

function navigationWorld(): ArchitectureWorld {
  const cleft = box('cleft', 'container', { x: 24, y: 6, width: 18, height: 18 }, {
    parent: 'observed:alpha',
    children: ['observed:pleft', 'observed:pmid'],
  })
  const cright = box('cright', 'container', { x: 50, y: 6, width: 18, height: 18 }, {
    parent: 'observed:alpha',
    children: ['observed:pright'],
  })
  const cfar = box('cfar', 'container', { x: 94, y: 6, width: 18, height: 18 }, {
    parent: 'observed:zeta',
    children: ['observed:pfar'],
  })
  return {
    bounds: { x: 0, y: 0, width: 180, height: 70 },
    relationships: [],
    elements: [
      box('zeta', 'system', { x: 90, y: 0, width: 40, height: 36 }, {
        children: ['observed:cfar'],
      }),
      box('ext', 'system', { x: 150, y: 6, width: 20, height: 20 }, { external: true }),
      box('empty', 'system', { x: 150, y: 40, width: 18, height: 18 }),
      box('alpha', 'system', { x: 20, y: 0, width: 56, height: 40 }, {
        children: ['observed:cleft', 'observed:cright'],
      }),
      box('ann', 'person', { x: 0, y: 8, width: 12, height: 12 }),
      cleft,
      cright,
      cfar,
      box('pleft', 'component', { x: 25, y: 8, width: 6, height: 6 }, {
        parent: 'observed:cleft',
      }),
      box('pmid', 'component', { x: 33, y: 8, width: 6, height: 6 }, {
        parent: 'observed:cleft',
      }),
      box('pright', 'component', { x: 52, y: 8, width: 6, height: 6 }, {
        parent: 'observed:cright',
      }),
      box('pfar', 'component', { x: 96, y: 8, width: 6, height: 6 }, {
        parent: 'observed:cfar',
      }),
    ],
  }
}

function viewOf(state: ViewerState): Pick<ViewerState, 'level' | 'currentId'> {
  return { level: state.level, currentId: state.currentId }
}

function geometry(world: ArchitectureWorld) {
  return {
    bounds: world.bounds,
    elements: world.elements.map(element => [element.representationId, element.bounds]),
    routes: world.relationships.map(relationship => {
      return [relationship.id, relationship.route, relationship.label]
    }),
  }
}

async function press(
  setup: Awaited<ReturnType<typeof createTestRenderer>>,
  ...keys: string[]
): Promise<string> {
  for (const key of keys) {
    if (key === 'enter') setup.mockInput.pressEnter()
    else if (key === 'escape') {
      setup.mockInput.pressEscape()
      await new Promise(resolve => setTimeout(resolve, 50))
    } else if (key === 'up' || key === 'down' || key === 'left' || key === 'right') {
      setup.mockInput.pressArrow(key)
    } else setup.mockInput.pressKey(key)
    await setup.renderOnce()
  }
  return setup.captureCharFrame()
}

test('unit navigation covers selection, zoom, and spatial movement', () => {
  const world = navigationWorld()
  assert.equal(defaultSelection(world, 'context')?.representationId, 'observed:alpha')
  assert.notEqual(world.elements[0]?.representationId, 'observed:alpha')

  let state = initialState(world)
  assert.deepEqual(state, {
    level: 'context',
    currentId: 'observed:alpha',
    focus: 'architecture',
    panel: 'closed',
  })

  assert.deepEqual(viewOf(reduceViewer(world, state, 'enter')), {
    level: 'containers',
    currentId: 'observed:alpha',
  })
  assert.deepEqual(
    viewOf(reduceViewer(world, { ...state, currentId: 'observed:ann' }, 'enter')),
    { level: 'context', currentId: 'observed:ann' },
  )
  assert.deepEqual(
    viewOf(reduceViewer(world, { ...state, currentId: 'observed:ext' }, 'enter')),
    { level: 'context', currentId: 'observed:ext' },
  )
  assert.deepEqual(
    viewOf(reduceViewer(world, { ...state, currentId: 'observed:empty' }, 'enter')),
    { level: 'context', currentId: 'observed:empty' },
  )
  assert.deepEqual(
    viewOf(reduceViewer(world, {
      level: 'components',
      currentId: 'observed:pleft',
      focus: 'architecture',
      panel: 'closed',
    }, 'enter')),
    { level: 'components', currentId: 'observed:pleft' },
  )

  state = reduceViewer(world, state, 'enter')
  assert.deepEqual(viewOf(reduceViewer(world, state, 'leave')), {
    level: 'context',
    currentId: 'observed:alpha',
  })
  state = reduceViewer(world, {
    ...state,
    currentId: 'observed:cleft',
  }, 'enter')
  assert.deepEqual(viewOf(state), { level: 'components', currentId: 'observed:cleft' })
  assert.deepEqual(viewOf(reduceViewer(world, state, 'leave')), {
    level: 'containers',
    currentId: 'observed:cleft',
  })
  assert.deepEqual(viewOf(reduceViewer(world, initialState(world), 'leave')), {
    level: 'context',
    currentId: 'observed:alpha',
  })

  state = initialState(world)
  const selected = state.currentId
  state = reduceViewer(world, state, 'zoom')
  assert.equal(state.focus, 'zoom')
  assert.equal(state.currentId, selected)
  state = reduceViewer(world, state, 'zoom')
  assert.equal(state.focus, 'architecture')
  assert.equal(state.currentId, selected)

  state = {
    level: 'containers',
    currentId: 'observed:cleft',
    focus: 'architecture',
    panel: 'closed',
  }
  assert.equal(reduceViewer(world, state, 'right').currentId, 'observed:cright')

  state = {
    level: 'components',
    currentId: 'observed:pright',
    focus: 'architecture',
    panel: 'closed',
  }
  assert.deepEqual(viewOf(reduceViewer(world, state, 'right')), {
    level: 'components',
    currentId: 'observed:pfar',
  })

  state = {
    level: 'components',
    currentId: 'observed:pfar',
    focus: 'architecture',
    panel: 'closed',
  }
  assert.deepEqual(viewOf(reduceViewer(world, state, 'right')), {
    level: 'context',
    currentId: 'observed:ext',
  })

  state = {
    level: 'components',
    currentId: 'observed:pleft',
    focus: 'architecture',
    panel: 'closed',
  }
  const escaped = reduceViewer(world, state, 'left')
  assert.deepEqual(viewOf(escaped), { level: 'context', currentId: 'observed:ann' })
  assert.notEqual(escaped.currentId, 'observed:alpha')
  assert.notEqual(escaped.currentId, 'observed:cleft')

  state = {
    level: 'context',
    currentId: 'observed:ann',
    focus: 'architecture',
    panel: 'closed',
  }
  assert.deepEqual(viewOf(reduceViewer(world, state, 'left')), {
    level: 'context',
    currentId: 'observed:ann',
  })
})

test('headless keys navigate, inspect, and leave world coordinates unchanged', async () => {
  const response = await loadArchitectureViewModel(repositoryRoot)
  const before = structuredClone(geometry(response.world))
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const app = mountTerminalViewer(setup.renderer, response)
  await setup.renderOnce()
  let frame = setup.captureCharFrame()
  assert.match(frame, /System Context · Groma/)
  assert.match(frame, /Coding agent/)
  assert.match(frame, /Human architect/)
  assert.doesNotMatch(frame, /PER Reads/)
  assert.match(frame, new RegExp(footerHints('architecture', 'closed')))

  frame = await press(setup, '+')
  assert.match(frame, /Containers · Groma/)
  assert.doesNotMatch(frame, /Keeps software architecture/)
  assert.match(frame, new RegExp(footerHints('architecture', 'closed')))

  frame = await press(setup, '-')
  assert.match(frame, /System Context · Groma/)

  frame = await press(setup, 'enter')
  assert.match(frame, /Containers · Groma/)
  assert.match(frame, /Keeps software architecture/)
  assert.match(frame, /SYSTEM/)
  assert.match(frame, /Versions architecture/)
  assert.match(frame, /Architecture workspace/)
  assert.match(frame, new RegExp(footerHints('architecture', 'side')))

  frame = await press(setup, 'z')
  assert.match(frame, /Containers · Groma/)
  assert.match(frame, new RegExp(footerHints('zoom', 'side')))
  frame = await press(setup, 'z')
  assert.match(frame, /Containers · Groma/)
  assert.match(frame, new RegExp(footerHints('architecture', 'side')))

  frame = await press(setup, 'escape')
  assert.match(frame, /Containers · Groma/)
  assert.doesNotMatch(frame, /Keeps software architecture/)

  frame = await press(setup, 'right')
  assert.match(frame, /Containers · Core/)

  frame = await press(setup, 'z', 'right', 'z')
  assert.match(frame, /Containers · Core/)

  assert.deepEqual(geometry(response.world), before)
  app.destroy()
})

test('headless details cover kinds, code, camera, overlay, and Esc', async () => {
  const response = await loadArchitectureViewModel(repositoryRoot)
  const fixture = await loadArchitectureViewModel(fixtureRoot)
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const app = mountTerminalViewer(setup.renderer, response)
  await setup.renderOnce()

  app.setView({ level: 'context', currentId: 'observed:human-architect' })
  let frame = await press(setup, 'enter')
  assert.match(frame, /System Context · Human architect/)
  assert.match(frame, /PERSON/)
  assert.match(frame, /Understands/)
  assert.match(frame, /Reads/)
  assert.match(frame, /Coding agent/)
  assert.match(frame, /Groma/)
  assert.match(frame, /Git/)
  assert.doesNotMatch(frame, /PER Reads/)
  assert.match(frame, new RegExp(footerHints('architecture', 'side')))
  assert.match(frame, /[▶◀▲▼]/)
  assert.match(frame, /▌/)
  const personSide = projectWorld(response.world, {
    width: 120,
    height: 36,
    level: 'context',
    currentId: 'observed:human-architect',
    panel: 'side',
  })
  const contextCards = personSide.elements.filter(element => {
    return element.display === 'card' && visible(element.cellBounds, personSide.viewport)
  })
  assert.deepEqual(
    contextCards.map(element => element.id).sort(),
    ['coding-agent', 'git', 'groma', 'human-architect'],
  )
  for (let leftIndex = 0; leftIndex < contextCards.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < contextCards.length; rightIndex += 1) {
      assert.equal(
        overlaps(contextCards[leftIndex]!.cellBounds, contextCards[rightIndex]!.cellBounds),
        false,
      )
    }
  }
  for (const relationship of personSide.relationships) {
    if (!relationship.cellLabel) continue
    const label = {
      x: relationship.cellLabel.x,
      y: relationship.cellLabel.y,
      width: relationship.cellLabel.width,
      height: 1,
    }
    for (const card of contextCards) {
      const nameLine = {
        x: card.cellBounds.x + 3,
        y: card.cellBounds.y + 1,
        width: Math.max(0, card.cellBounds.width - 5),
        height: 1,
      }
      const kindLine = { ...nameLine, y: card.cellBounds.y + 2 }
      assert.equal(overlaps(label, nameLine), false, `${relationship.id} covers ${card.id} name`)
      assert.equal(overlaps(label, kindLine), false, `${relationship.id} covers ${card.id} kind`)
    }
  }

  frame = await press(setup, 'f')
  assert.match(frame, /System Context · Human architect/)
  assert.match(frame, /PERSON/)
  assert.match(frame, /Understands/)
  assert.doesNotMatch(frame, /[▶◀▲▼]/)
  assert.doesNotMatch(frame, /▌/)
  assert.match(frame, new RegExp(footerHints('architecture', 'full')))

  frame = await press(setup, 'f')
  assert.match(frame, /[▶◀▲▼]/)
  assert.match(frame, new RegExp(footerHints('architecture', 'side')))

  frame = await press(setup, 'escape')
  assert.match(frame, /System Context · Human architect/)
  assert.doesNotMatch(frame, /Understands/)
  assert.match(frame, new RegExp(footerHints('architecture', 'closed')))

  app.setView({ level: 'context', currentId: 'observed:groma' })
  frame = await press(setup, 'enter')
  assert.match(frame, /Containers · Groma/)
  assert.match(frame, /Keeps software architecture/)
  assert.match(frame, /Core/)

  app.setView({ level: 'context', currentId: 'observed:git' })
  frame = await press(setup, 'enter')
  assert.match(frame, /System Context · Git/)
  assert.match(frame, /EXTERNAL SYSTEM/)
  assert.match(frame, /Keeps history/)

  app.setView({ level: 'containers', currentId: 'observed:core' })
  frame = await press(setup, 'enter')
  assert.match(frame, /Components · Core/)
  assert.match(frame, /Owns architecture identity/)
  assert.match(frame, /Architecture model/)
  assert.match(frame, /World layout/)

  app.setView({ level: 'components', currentId: 'observed:architecture-model' })
  frame = await press(setup, 'enter')
  assert.match(frame, /Components · Architecture model/)
  assert.match(frame, /COMPONENT/)
  assert.match(frame, /typescript/)
  assert.match(frame, /src\/architecture-model\.ts/)
  assert.match(frame, /buildArchitectureModel/)
  assert.match(frame, /World layout/)

  app.destroy()

  const shop = await createTestRenderer({ width: 120, height: 36 })
  const shopApp = mountTerminalViewer(shop.renderer, fixture, {
    level: 'containers',
    currentId: 'observed:api',
  })
  await shop.renderOnce()
  const side = await press(shop, 'enter')
  assert.match(side, /Components · Shop API/)
  assert.match(side, /Coordinates ordering operations/)
  assert.match(side, /Orders/)
  assert.match(side, /Legacy ordering/)
  assert.doesNotMatch(side, /Inventory-aware orders/)
  assert.doesNotMatch(side, /Reserves stock/)
  assert.match(side, /[▶◀▲▼]/)

  const projection = projectWorld(fixture.world, {
    width: 120,
    height: 36,
    level: 'components',
    currentId: 'observed:api',
    panel: 'side',
  })
  assert.ok(projection.viewport.width < 118)
  const cards = projection.elements.filter(element => element.display === 'card')
  assert.ok(cards.length > 0)
  assert.ok(cards.every(element => {
    return element.parent === 'observed:api' && visible(element.cellBounds, projection.viewport)
  }))
  assert.ok(projection.elements.every(element => {
    return element.parent !== 'planned:inventory:api' || element.display === 'hidden'
  }))

  shopApp.setView({ level: 'components', currentId: 'observed:orders' })
  const orders = await press(shop, 'enter')
  assert.match(orders, /Components · Orders/)
  assert.match(orders, /typescript/)
  assert.match(orders, /src\/orders\.ts/)
  assert.match(orders, /placeOrder/)
  assert.match(orders, /routes/)
  assert.match(orders, /src\/routes\/orders\.ts/)

  const closed = await press(shop, 'escape')
  assert.match(closed, /Components · Orders/)
  assert.doesNotMatch(closed, /Places and tracks customer orders/)
  shop.mockInput.pressEscape()
  await shopApp.closed
  assert.equal(shop.renderer.isDestroyed, true)
})
