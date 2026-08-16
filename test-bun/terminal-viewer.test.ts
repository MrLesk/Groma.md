import assert from 'node:assert/strict'
import { cp, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'
import { fileURLToPath } from 'node:url'

import { normalizeTerminalPalette, rgbToHex } from '@opentui/core'
import type { CapturedFrame, CapturedSpan } from '@opentui/core'
import { createTestRenderer } from '@opentui/core/testing'

import { loadArchitectureViewModel } from '../src/core.ts'
import { createCamera } from '../src/viewers/tui/camera.ts'
import {
  mountTerminalViewer,
  startTerminalViewer,
} from '../src/viewers/tui/terminal-viewer.ts'
import {
  defaultSelection,
  filterMatches,
  initialState,
  reduceFilter,
  reduceViewer,
} from '../src/viewers/tui/navigation.ts'
import type { ViewerState } from '../src/viewers/tui/navigation.ts'
import { paneLayout } from '../src/viewers/tui/layout.ts'
import { zoomReadout } from '../src/viewers/tui/organisms/chrome.ts'
import { scrollOffset } from '../src/viewers/tui/organisms/hierarchy.ts'
import { kindGlyph, kindLabel } from '../src/viewers/tui/atoms/kind.ts'
import { initialTree, treeRows } from '../src/viewers/tui/tree.ts'
import { fitLayer, fitView, followSelection, projectWorld } from '../src/viewers/tui/projection.ts'
import type {
  ArchitectureWorld,
  Bounds,
  C4Kind,
  MapCamera,
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

function mapViewportOf(size: { width: number; height: number }): Bounds {
  return paneLayout(size.width, size.height).mapViewport
}

/** The frame columns of the map pane; kind words live only in the details pane. */
function mapRegion(frame: string, width: number): string {
  const layout = paneLayout(width, 36)
  return frame
    .split('\n')
    .map(line => [...line].slice(layout.map.x, layout.details.x).join(''))
    .join('\n')
}

const views: Array<{ level: SemanticLevel; currentId: string }> = [
  { level: 'context', currentId: 'observed:groma' },
  { level: 'containers', currentId: 'observed:core' },
  { level: 'components', currentId: 'observed:architecture-model' },
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

function projectedById(
  elements: ProjectedElement[],
): Map<string, ProjectedElement> {
  return new Map(elements.map(element => [element.representationId, element]))
}

test.concurrent('frames are stable and projections hold world invariants at every level and size', async () => {
  const response = await loadArchitectureViewModel(repositoryRoot)

  for (const size of sizes) {
    for (const view of views) {
      const setup = await createTestRenderer(size)
      const app = mountTerminalViewer(setup.renderer, response, view)
      await setup.renderOnce()
      const first = setup.captureCharFrame()
      await setup.renderOnce()
      assert.equal(setup.captureCharFrame(), first)

      // The map carries no kind or origin words; the details pane spells them out.
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
        const groma = requiredElement(byId, 'observed:groma')
        const person = requiredElement(byId, 'observed:human-architect')
        assert.equal(groma.display, 'system-boundary')
        assert.ok(
          groma.cellBounds.width * groma.cellBounds.height
            > person.cellBounds.width * person.cellBounds.height,
        )
        for (const id of [
          'observed:human-architect',
          'observed:coding-agent',
          'observed:git',
        ]) {
          assert.ok(
            visible(requiredElement(byId, id).cellBounds, projection.viewport),
            id,
          )
        }
        assert.ok(projection.elements.some(element => {
          return element.kind === 'container'
            && element.display === 'container-boundary'
            && element.cellBounds.x >= groma.cellBounds.x
            && element.cellBounds.y >= groma.cellBounds.y
            && element.cellBounds.x + element.cellBounds.width
              <= groma.cellBounds.x + groma.cellBounds.width
            && element.cellBounds.y + element.cellBounds.height
              <= groma.cellBounds.y + groma.cellBounds.height
        }))
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
        assert.match(
          characterAt(first, relationship.cellRoute.at(-1)),
          /[▶◀▲▼]/,
          `${relationship.id} lost its arrowhead`,
        )
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

test.concurrent('headless groma view startup releases its renderer and input handler', async () => {
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
  const frame = setup.captureCharFrame()
  assert.ok(frame.trim().length > 0)
  setup.mockInput.pressEscape()
  await setup.renderOnce()
  assert.equal(setup.renderer.isDestroyed, false)
  setup.mockInput.pressCtrlC()
  await app.closed
  assert.equal(setup.renderer.isDestroyed, true)
  assert.equal(setup.renderer.root.getChildrenCount(), 0)
  assert.equal(
    setup.renderer.keyInput.listenerCount('keypress'),
    inputListeners,
  )
})

test.concurrent('R reloads the world from core and keeps the current view', async () => {
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
    assert.match(setup.captureCharFrame(), /Legacy ordering/)

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
    assert.match(after, /Legacy queue/)
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

test.concurrent('viewer modules consume only the core response and fixed world', async () => {
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
    groups: [],
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
      // ESC starts CSI sequences; OpenTUI waits before treating it as Escape.
      await new Promise(resolve => setTimeout(resolve, 50))
    } else if (key === 'up' || key === 'down' || key === 'left' || key === 'right') {
      setup.mockInput.pressArrow(key)
    } else setup.mockInput.pressKey(key)
    await setup.renderOnce()
    if (setup.renderer.isRunning) {
      const deadline = Date.now() + 2000
      while (setup.renderer.isRunning && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 16))
      }
      await setup.renderOnce()
    }
  }
  return setup.captureCharFrame()
}

function cameraOn(
  world: ArchitectureWorld,
  id: string,
  zoom: number,
): MapCamera {
  const element = world.elements.find(item => item.representationId === id)
  assert.ok(element)
  return {
    zoom,
    centerX: element.bounds.x + element.bounds.width / 2,
    centerY: element.bounds.y + element.bounds.height / 2,
  }
}

test.concurrent('unit navigation covers selection, level changes, and spatial movement', () => {
  const world = navigationWorld()
  assert.equal(defaultSelection(world, 'context')?.representationId, 'observed:alpha')
  assert.notEqual(world.elements[0]?.representationId, 'observed:alpha')

  let state = initialState(world)
  assert.deepEqual(state, {
    level: 'context',
    currentId: 'observed:alpha',
    focus: 'architecture',
    tree: initialTree(),
    panes: { hierarchy: true, details: true },
    detailsScroll: 0,
  })

  // Entering a system selects its first container, so arrows have siblings.
  assert.deepEqual(viewOf(reduceViewer(world, state, 'enter')), {
    level: 'containers',
    currentId: 'observed:cleft',
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
      tree: initialTree(),
      panes: { hierarchy: true, details: true },
      detailsScroll: 0,
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
  assert.deepEqual(viewOf(state), { level: 'components', currentId: 'observed:pleft' })
  assert.deepEqual(viewOf(reduceViewer(world, state, 'leave')), {
    level: 'containers',
    currentId: 'observed:cleft',
  })
  assert.deepEqual(viewOf(reduceViewer(world, initialState(world), 'leave')), {
    level: 'context',
    currentId: 'observed:alpha',
  })

  state = {
    level: 'containers',
    currentId: 'observed:cleft',
    focus: 'architecture',
    tree: initialTree(),
    panes: { hierarchy: true, details: true },
    detailsScroll: 0,
  }
  assert.equal(reduceViewer(world, state, 'right').currentId, 'observed:cright')

  // Exiting a container never lands on a component inside another one:
  // the selection leaves the boundary and picks the outer item instead.
  state = {
    level: 'components',
    currentId: 'observed:pright',
    focus: 'architecture',
    tree: initialTree(),
    panes: { hierarchy: true, details: true },
    detailsScroll: 0,
  }
  assert.deepEqual(viewOf(reduceViewer(world, state, 'right')), {
    level: 'containers',
    currentId: 'observed:cfar',
  })

  state = {
    level: 'components',
    currentId: 'observed:pfar',
    focus: 'architecture',
    tree: initialTree(),
    panes: { hierarchy: true, details: true },
    detailsScroll: 0,
  }
  assert.deepEqual(viewOf(reduceViewer(world, state, 'right')), {
    level: 'context',
    currentId: 'observed:ext',
  })

  state = {
    level: 'components',
    currentId: 'observed:pleft',
    focus: 'architecture',
    tree: initialTree(),
    panes: { hierarchy: true, details: true },
    detailsScroll: 0,
  }
  const escaped = reduceViewer(world, state, 'left')
  assert.deepEqual(viewOf(escaped), { level: 'context', currentId: 'observed:ann' })
  assert.notEqual(escaped.currentId, 'observed:alpha')
  assert.notEqual(escaped.currentId, 'observed:cleft')

  state = {
    level: 'context',
    currentId: 'observed:ann',
    focus: 'architecture',
    tree: initialTree(),
    panes: { hierarchy: false, details: true },
    detailsScroll: 0,
  }
  // Nothing lies further left of the leftmost person: focus escapes into
  // the hierarchy pane, selection unchanged, and the hidden pane reopens.
  const toTree = reduceViewer(world, state, 'left')
  assert.deepEqual(viewOf(toTree), { level: 'context', currentId: 'observed:ann' })
  assert.equal(toTree.focus, 'hierarchy')
  assert.equal(toTree.tree.cursor, 'observed:ann')
  assert.equal(toTree.panes.hierarchy, true)

  // Right at the right edge mirrors it into the details pane.
  const toDetails = reduceViewer(world, {
    ...state,
    currentId: 'observed:ext',
    panes: { hierarchy: true, details: false },
  }, 'right')
  assert.deepEqual(viewOf(toDetails), { level: 'context', currentId: 'observed:ext' })
  assert.equal(toDetails.focus, 'details')
  assert.equal(toDetails.panes.details, true)

  // Details focus scrolls with Up/Down, never below zero, and returns on Left;
  // a selection change resets the scroll.
  let details = reduceViewer(world, toDetails, 'down')
  details = reduceViewer(world, details, 'down')
  assert.equal(details.detailsScroll, 2)
  details = reduceViewer(world, details, 'up')
  details = reduceViewer(world, details, 'up')
  details = reduceViewer(world, details, 'up')
  assert.equal(details.detailsScroll, 0)
  details = reduceViewer(world, { ...details, detailsScroll: 3 }, 'left')
  assert.equal(details.focus, 'architecture')
  const moved = reduceViewer(world, details, 'left')
  assert.equal(moved.detailsScroll, 0)

  // Hiding the focused details pane hands focus back to the map.
  const hidden = reduceViewer(world, toDetails, 'toggle-details')
  assert.equal(hidden.focus, 'architecture')
  assert.equal(hidden.panes.details, false)
})

test.concurrent('headless keys drive the viewer and leave world coordinates unchanged', async () => {
  const response = await loadArchitectureViewModel(repositoryRoot)
  const before = structuredClone(geometry(response.world))
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const app = mountTerminalViewer(setup.renderer, response)
  await setup.renderOnce()

  // Zoom keys, arrows, Enter, Tab, pane toggles, and Esc all keep the
  // viewer alive and never mutate the world's fixed geometry.
  await press(setup, '+', '-', '_', '=', '_')
  await press(setup, 'enter', 'right', 'left', 'up', 'down')
  await press(setup, 'tab', 'right', 'down', 'enter', 'escape')
  await press(setup, '[', ']', '[', ']')
  await press(setup, 'enter', 'escape')
  assert.equal(setup.renderer.isDestroyed, false)

  assert.deepEqual(geometry(response.world), before)
  app.destroy()
})

test.concurrent('selection changes never move the camera and pan only when off screen', async () => {
  const response = await loadArchitectureViewModel(repositoryRoot)
  const viewport = mapViewportOf({ width: 120, height: 36 })

  // At fit, every context selection shares one camera: the world does not move.
  const gromaView = projectWorld(response.world, {
    viewport,
    level: 'context',
    currentId: 'observed:groma',
  })
  const codingView = projectWorld(response.world, {
    viewport,
    level: 'context',
    currentId: 'observed:coding-agent',
  })
  assert.deepEqual(codingView.camera, gromaView.camera)
  assert.deepEqual(
    codingView.elements.map(element => [element.representationId, element.cellBounds]),
    gromaView.elements.map(element => [element.representationId, element.cellBounds]),
  )

  // With a shared camera, switching between visible components keeps every cell.
  const modelView = projectWorld(response.world, {
    viewport,
    level: 'components',
    currentId: 'observed:architecture-model',
  })
  const scanView = projectWorld(response.world, {
    viewport,
    level: 'components',
    currentId: 'planned:mvp:scan-reconciler',
    camera: modelView.camera,
  })
  assert.deepEqual(scanView.camera, modelView.camera)
  assert.deepEqual(
    scanView.elements.map(element => [element.representationId, element.cellBounds]),
    modelView.elements.map(element => [element.representationId, element.cellBounds]),
  )

  // An off-screen selection pans just enough to become visible, without zooming.
  const start = projectWorld(response.world, {
    viewport,
    level: 'context',
    currentId: 'observed:groma',
    camera: cameraOn(response.world, 'observed:groma', 1),
  })
  assert.equal(start.camera.zoom, 1)
  for (const id of ['observed:human-architect', 'observed:coding-agent', 'observed:git']) {
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

  // Route labels never cover a card's name row.
  const labeled = projectWorld(response.world, {
    viewport,
    level: 'context',
    currentId: 'observed:human-architect',
  })
  const contextCards = labeled.elements.filter(element => {
    return element.display === 'card'
      && (element.kind === 'person' || element.external)
      && visible(element.cellBounds, labeled.viewport)
  })
  assert.ok(contextCards.some(element => element.id === 'human-architect'))
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

test.concurrent('camera tweens zoom in log space with ease-in-out cubic', () => {
  const camera = createCamera({ zoom: 1, centerX: 0, centerY: 0 })
  camera.startTween({ zoom: Math.E, centerX: 10, centerY: 4 }, 1000)
  camera.update(250)
  assert.equal(camera.isAnimating(), true)
  assert.equal(camera.zoom, Math.exp(0.0625))
  assert.equal(camera.centerX, 0.625)
  assert.equal(camera.centerY, 0.25)
  camera.update(750)
  assert.equal(camera.zoom, Math.E)
  assert.equal(camera.centerX, 10)
  assert.equal(camera.isAnimating(), false)
  camera.startTween({ zoom: 1, centerX: 0, centerY: 0 }, 1000)
  camera.snapTo({ zoom: 2, centerX: 1, centerY: 1 })
  assert.equal(camera.isAnimating(), false)
  assert.equal(camera.zoom, 2)
})

test.concurrent('opening map fits the whole world and zoom stays inside its bounds', async () => {
  const response = await loadArchitectureViewModel(repositoryRoot)
  const viewport = mapViewportOf({ width: 120, height: 36 })
  const start = projectWorld(response.world, { viewport })
  assert.equal(start.camera.zoom, start.fitZoom)
  assert.ok(start.camera.zoom < 1)
  const byId = projectedById(start.elements)
  for (const id of [
    'observed:groma',
    'observed:git',
    'observed:human-architect',
    'observed:coding-agent',
  ]) {
    assert.ok(visible(requiredElement(byId, id).cellBounds, start.viewport), id)
  }
  const closer = projectWorld(response.world, {
    viewport,
    camera: {
      ...start.camera,
      zoom: Math.min(1, start.camera.zoom * 1.25),
    },
  })
  assert.ok(closer.camera.zoom > start.camera.zoom)
  assert.equal(closer.level, 'context')
  assert.ok(closer.camera.zoom <= 1)

  const setup = await createTestRenderer({ width: 120, height: 36 })
  const app = mountTerminalViewer(setup.renderer, response)
  await setup.renderOnce()
  const first = setup.captureCharFrame()
  const zoomed = await press(setup, '+')
  assert.notEqual(zoomed, first)
  await press(setup, '-')
  // Zooming is deterministic: fit -> in lands on the same frame again.
  const rezoomed = await press(setup, '+')
  assert.equal(rezoomed, zoomed)
  app.destroy()
})

test.concurrent('camera follows selection across levels with the outer zoom rule', async () => {
  const response = await loadArchitectureViewModel(repositoryRoot)
  const from = {
    level: 'components' as const,
    currentId: 'observed:world-layout',
  }
  const model = {
    level: 'components' as const,
    currentId: 'observed:architecture-model',
  }
  const workspace = {
    level: 'containers' as const,
    currentId: 'observed:architecture-workspace',
  }
  const core = {
    level: 'containers' as const,
    currentId: 'observed:core',
  }
  const viewport = mapViewportOf({ width: 120, height: 36 })
  const tight = fitLayer(response.world, viewport, from.level, from.currentId)
  assert.deepEqual(
    tight,
    fitLayer(response.world, viewport, model.level, model.currentId),
  )
  assert.deepEqual(
    fitLayer(response.world, viewport, core.level, core.currentId),
    fitLayer(response.world, viewport, workspace.level, workspace.currentId),
  )
  assert.equal(
    followSelection(response.world, viewport, from, model, tight),
    undefined,
  )
  const sibling = followSelection(
    response.world,
    viewport,
    from,
    workspace,
    tight,
  )
  assert.ok(sibling)
  assert.equal(sibling.zoom, Math.min(tight.zoom, fitLayer(
    response.world,
    viewport,
    workspace.level,
    workspace.currentId,
  ).zoom))
  const zoomedOut = followSelection(
    response.world,
    viewport,
    from,
    core,
    tight,
  )
  assert.ok(zoomedOut)
  assert.ok(zoomedOut.zoom < tight.zoom)
  assert.equal(zoomedOut.zoom, sibling.zoom)
})

test.concurrent('person cards use full names when the map has room', async () => {
  const response = await loadArchitectureViewModel(repositoryRoot)
  const coding = response.world.elements.find(element => {
    return element.id === 'coding-agent'
  })
  const human = response.world.elements.find(element => {
    return element.id === 'human-architect'
  })
  assert.ok(coding)
  assert.ok(human)
  const camera = {
    zoom: 0.5,
    centerX: (coding.bounds.x + human.bounds.x + human.bounds.width) / 2,
    centerY: (coding.bounds.y + human.bounds.y + human.bounds.height) / 2,
  }
  const view = projectWorld(response.world, {
    viewport: mapViewportOf({ width: 120, height: 36 }),
    currentId: 'observed:coding-agent',
    camera,
  })
  const byId = projectedById(view.elements)
  const people = [
    requiredElement(byId, 'observed:coding-agent'),
    requiredElement(byId, 'observed:human-architect'),
  ]
  for (const person of people) {
    assert.equal(visible(person.cellBounds, view.viewport), true, person.name)
    assert.ok(
      person.cellBounds.width >= person.name.length + 7,
      `${person.name} is ${person.cellBounds.width} cells`,
    )
  }
  const groma = requiredElement(byId, 'observed:groma')
  const git = requiredElement(byId, 'observed:git')
  assert.equal(overlaps(people[0]!.cellBounds, people[1]!.cellBounds), false)
  for (const person of people) {
    assert.equal(overlaps(person.cellBounds, groma.cellBounds), false)
    assert.equal(overlaps(person.cellBounds, git.cellBounds), false)
  }
})

test.concurrent('the details pane always shows the selection and reserves its column', async () => {
  const response = await loadArchitectureViewModel(repositoryRoot)
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const app = mountTerminalViewer(setup.renderer, response)
  await setup.renderOnce()

  const layout = paneLayout(120, 36)
  app.setView({ level: 'components', currentId: 'observed:architecture-model' })
  await setup.renderOnce()
  const frame = setup.captureCharFrame()
  const lines = frame.split('\n')
  // The pane starts at its reserved column and fills its full height.
  assert.equal(lines[layout.details.y]![layout.details.x], '┌')
  assert.equal(
    lines[layout.details.y + layout.details.height - 1]![layout.details.x],
    '└',
  )
  // Name, kind, and code come from the selected element.
  const pane = lines
    .map(line => [...line].slice(layout.details.x).join(''))
    .join('\n')
  assert.match(pane, /Architecture model/)
  assert.match(
    pane,
    new RegExp(`${kindGlyph('component')} ${kindLabel('component')} · observed`),
  )
  assert.match(pane, /src\/architecture-model\.ts/)
  const treePane = lines
    .map(line => [...line].slice(layout.hierarchy.x, layout.map.x).join(''))
    .join('\n')
  assert.match(treePane, new RegExp(kindGlyph('system')))
  assert.match(treePane, new RegExp(kindGlyph('container')))
  assert.match(treePane, new RegExp(kindGlyph('component')))
  assert.match(mapRegion(frame, 120), new RegExp(kindGlyph('system')))
  assert.match(mapRegion(frame, 120), new RegExp(kindGlyph('container')))
  app.destroy()
})

test.concurrent('the hierarchy pane ends with the kind legend', async () => {
  const response = await loadArchitectureViewModel(repositoryRoot)
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const app = mountTerminalViewer(setup.renderer, response)
  await setup.renderOnce()
  const layout = paneLayout(120, 36)
  const lines = setup.captureCharFrame().split('\n')
  const column = (line: string) => {
    return [...line].slice(layout.hierarchy.x, layout.map.x).join('')
  }
  const interior = lines
    .slice(layout.hierarchy.y + 1, layout.hierarchy.y + layout.hierarchy.height - 1)
    .map(column)
  const tail = interior.slice(-3).join('\n')
  const tree = interior.slice(0, -3).join('\n')
  for (const kind of ['person', 'system', 'container', 'component'] as const) {
    assert.match(tail, new RegExp(`${kindGlyph(kind)} ${kindLabel(kind)}`))
    assert.doesNotMatch(tree, new RegExp(kindLabel(kind)))
  }
  app.destroy()
})

test.concurrent('the containment tree lists every element once and tracks collapse state', () => {
  const world = navigationWorld()
  const all = treeRows(world, undefined, {
    expanded: new Set(world.elements.map(element => element.representationId)),
    collapsed: new Set(),
  })
  assert.deepEqual(
    [...all.map(row => row.id)].sort(),
    [...world.elements.map(element => element.representationId)].sort(),
  )
  const depths = new Map(all.map(row => [row.id, row.depth]))
  assert.equal(depths.get('observed:alpha'), 0)
  assert.equal(depths.get('observed:cleft'), 1)
  assert.equal(depths.get('observed:pleft'), 2)
  const kinds = new Map(all.map(row => [row.id, row.kind]))
  assert.equal(kinds.get('observed:alpha'), 'system')
  assert.equal(kinds.get('observed:cleft'), 'container')
  assert.equal(kinds.get('observed:pleft'), 'component')
  assert.equal(kinds.get('observed:ext'), 'system')
  assert.equal(all.find(row => row.id === 'observed:ext')?.external, true)

  // Default state: collapsed except the path to the selection.
  const rows = treeRows(world, 'observed:pleft', initialTree())
  const ids = rows.map(row => row.id)
  assert.ok(ids.includes('observed:pleft'))
  assert.ok(ids.includes('observed:pmid'))
  assert.ok(!ids.includes('observed:pright'))
  assert.equal(rows.find(row => row.id === 'observed:alpha')?.expanded, true)
  const cright = rows.find(row => row.id === 'observed:cright')
  assert.equal(cright?.expanded, false)
  assert.equal(cright?.count, 1)
})

test.concurrent('tree focus moves the cursor and enter drives selection and level', () => {
  const world = navigationWorld()
  let state = reduceViewer(world, initialState(world), 'tab')
  assert.equal(state.focus, 'hierarchy')
  assert.equal(state.tree.cursor, 'observed:alpha')

  // Enter on a collapsed parent selects it and opens its group in place.
  const opened = reduceViewer(world, state, 'enter')
  assert.equal(opened.currentId, 'observed:alpha')
  assert.ok(opened.tree.expanded.has('observed:alpha'))
  assert.equal(opened.focus, 'hierarchy')

  // Expand the selected root, then walk into its children.
  state = reduceViewer(world, state, 'right')
  state = reduceViewer(world, state, 'down')
  assert.equal(state.tree.cursor, 'observed:cleft')
  state = reduceViewer(world, state, 'right')
  state = reduceViewer(world, state, 'down')
  assert.equal(state.tree.cursor, 'observed:pleft')

  // Enter selects on the map at the element's level; the tree stays focused.
  state = reduceViewer(world, state, 'enter')
  assert.equal(state.currentId, 'observed:pleft')
  assert.equal(state.level, 'components')
  assert.equal(state.focus, 'hierarchy')

  // Right with nothing left to expand keeps moving, back onto the map,
  // leaving selection and cursor untouched.
  const backFromLeaf = reduceViewer(world, state, 'right')
  assert.equal(backFromLeaf.focus, 'architecture')
  assert.equal(backFromLeaf.currentId, state.currentId)
  assert.equal(backFromLeaf.tree.cursor, state.tree.cursor)

  // Left climbs to the parent on a leaf, then collapses the parent.
  state = reduceViewer(world, state, 'left')
  assert.equal(state.tree.cursor, 'observed:cleft')
  const backFromExpanded = reduceViewer(world, state, 'right')
  assert.equal(backFromExpanded.focus, 'architecture')
  state = reduceViewer(world, state, 'left')
  assert.ok(state.tree.collapsed.has('observed:cleft'))
  assert.equal(state.currentId, 'observed:pleft')

  // Esc returns to the map; a map move re-syncs the cursor and unhides its path.
  state = reduceViewer(world, state, 'dismiss')
  assert.equal(state.focus, 'architecture')
  state = reduceViewer(world, state, 'right')
  assert.equal(state.tree.cursor, state.currentId)
  assert.equal(state.tree.collapsed.has('observed:cleft'), false)
})

test.concurrent('tree scrolling keeps the cursor inside the visible window', () => {
  for (let rows = 1; rows < 60; rows += 7) {
    for (let height = 1; height <= 20; height += 3) {
      for (let cursor = 0; cursor < rows; cursor += 1) {
        const scroll = scrollOffset(cursor, rows, height)
        assert.ok(scroll >= 0)
        assert.ok(cursor >= scroll)
        assert.ok(cursor < scroll + height)
        assert.ok(scroll <= Math.max(0, rows - height))
      }
    }
  }
})

test.concurrent('pane toggles resize the map viewport without touching the world', async () => {
  const world = navigationWorld()
  let state = initialState(world)
  assert.deepEqual(state.panes, { hierarchy: true, details: true })

  state = reduceViewer(world, state, 'toggle-details')
  assert.deepEqual(state.panes, { hierarchy: true, details: false })
  state = reduceViewer(world, state, 'toggle-hierarchy')
  assert.deepEqual(state.panes, { hierarchy: false, details: false })

  // Hiding the focused hierarchy pane hands focus back to the map.
  state = reduceViewer(world, state, 'tab')
  assert.equal(state.focus, 'hierarchy')
  assert.equal(state.panes.hierarchy, true)
  state = reduceViewer(world, state, 'toggle-hierarchy')
  assert.equal(state.focus, 'architecture')
  assert.equal(state.panes.hierarchy, false)

  // With both panes hidden the map pane spans the full width.
  const full = paneLayout(120, 36, { hierarchy: false, details: false })
  assert.equal(full.map.x, 0)
  assert.equal(full.map.width, 120)
  const partial = paneLayout(120, 36, { hierarchy: true, details: false })
  assert.equal(partial.map.x + partial.map.width, 120)

  // The same camera over a wider viewport only translates the projection.
  const response = await loadArchitectureViewModel(repositoryRoot)
  const threePane = paneLayout(120, 36)
  const narrow = projectWorld(response.world, {
    viewport: threePane.mapViewport,
    camera: cameraOn(response.world, 'observed:groma', 1),
    lockCamera: true,
  })
  const wide = projectWorld(response.world, {
    viewport: full.mapViewport,
    camera: cameraOn(response.world, 'observed:groma', 1),
    lockCamera: true,
  })
  assert.equal(wide.camera.zoom, narrow.camera.zoom)
  const wideById = projectedById(wide.elements)
  const deltaX = full.mapViewport.x + full.mapViewport.width / 2
    - (threePane.mapViewport.x + threePane.mapViewport.width / 2)
  for (const element of narrow.elements) {
    const moved = requiredElement(wideById, element.representationId)
    assert.equal(moved.cellBounds.y, element.cellBounds.y, element.representationId)
    // Leaf cards are clamped into the viewport (keepTitledCardInView),
    // so their shift legitimately differs from the camera translation.
    if (element.kind === 'person' || element.external) continue
    assert.equal(
      moved.cellBounds.x - element.cellBounds.x,
      Math.round(deltaX),
      element.representationId,
    )
  }
})

test.concurrent('the zoom readout names fit, in-between, and one-to-one states', () => {
  assert.equal(zoomReadout(0.31, 0.31), 'fit')
  assert.equal(zoomReadout(0.62, 0.31), '62%')
  assert.equal(zoomReadout(1, 0.31), '1:1')
  assert.equal(zoomReadout(1, 1), '1:1')
})

test.concurrent('the filter narrows by name, drives selection live, and restores on cancel', async () => {
  const response = await loadArchitectureViewModel(repositoryRoot)
  const world = response.world

  // Case-insensitive substring over the merged world, in id order.
  assert.deepEqual(
    filterMatches(world, 'WOR').map(element => element.representationId),
    ['observed:architecture-workspace', 'observed:world-layout'],
  )
  assert.deepEqual(filterMatches(world, ''), [])
  assert.deepEqual(filterMatches(world, 'no such thing'), [])

  // Panes collapsed do not affect the filter.
  let state = {
    ...initialState(world),
    panes: { hierarchy: false, details: false },
  }
  const before = { level: state.level, currentId: state.currentId }

  state = reduceFilter(world, state, { type: 'open' })
  assert.ok(state.filter)
  for (const char of 'wor') {
    state = reduceFilter(world, state, { type: 'char', char })
  }
  // The first match selects live at its own level.
  assert.equal(state.currentId, 'observed:architecture-workspace')
  assert.equal(state.level, 'containers')

  state = reduceFilter(world, state, { type: 'next' })
  assert.equal(state.currentId, 'observed:world-layout')
  assert.equal(state.level, 'components')
  state = reduceFilter(world, state, { type: 'previous' })
  assert.equal(state.currentId, 'observed:architecture-workspace')

  // Narrowing to nothing leaves the view alone; deleting widens again.
  state = reduceFilter(world, state, { type: 'char', char: 'q' })
  assert.equal(state.currentId, 'observed:architecture-workspace')
  state = reduceFilter(world, state, { type: 'delete' })
  assert.equal(state.filter?.query, 'wor')

  // Esc restores the pre-filter view; Enter keeps the match.
  const cancelled = reduceFilter(world, state, { type: 'cancel' })
  assert.equal(cancelled.filter, undefined)
  assert.equal(cancelled.level, before.level)
  assert.equal(cancelled.currentId, before.currentId)

  const accepted = reduceFilter(world, state, { type: 'accept' })
  assert.equal(accepted.filter, undefined)
  assert.equal(accepted.currentId, 'observed:architecture-workspace')
  assert.equal(accepted.level, 'containers')
})
