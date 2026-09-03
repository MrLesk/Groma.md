import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { createTestRenderer } from '@opentui/core/testing'

import { DETAILS_PANE_WIDTH, HIERARCHY_PANE_WIDTH, type PaneVisibility } from '../src/viewers/tui/layout.ts'
import { sheetScene } from '../src/sheet/scene.ts'
import type { TerminalViewModel } from '../src/viewers/tui/model.ts'
import type {
  ArchitectureWorld,
  Bounds,
  C4Kind,
  WorldElement,
  WorldRelationship,
} from '../src/types.ts'

export const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
export const fixtureRoot = path.join(repositoryRoot, 'test', 'fixtures', 'core-view')
export const okfFixtureRoot = path.join(repositoryRoot, 'test', 'fixtures', 'validate')
export const containersFixtureRoot = path.join(
  repositoryRoot,
  'test',
  'fixtures',
  'containers-view',
)
/** A minimum world with actors, three levels, and an external system. */
export const viewerFixtureRoot = path.join(
  repositoryRoot,
  'test',
  'fixtures',
  'viewer-view',
)
/** The generated large world: four systems, twenty containers, three hundred components. */
export const largeWorldFixtureRoot = path.join(repositoryRoot, 'test', 'fixtures', 'large-world')
/** Upper-band product world authored from OpenClaw docs, not its old scanner dump. */
export const openclawFixtureRoot = path.join(
  repositoryRoot,
  'test',
  'fixtures',
  'openclaw-view',
)

export { loadTerminalModel as terminalModel } from '../src/view-host.ts'

/** Where the screen puts its panes at a terminal size: one row above and below, the frames, and the recap row. */
export function paneLayout(width: number, height: number, panes: PaneVisibility = { hierarchy: true, details: true }) {
  const body = { y: 2, height: Math.max(1, height - 4) }
  const detailsWidth = panes.details ? DETAILS_PANE_WIDTH : 0
  const hierarchy = { x: 0, ...body, width: panes.hierarchy ? HIERARCHY_PANE_WIDTH : 0 }
  const details = { x: Math.max(hierarchy.width, width - detailsWidth), ...body, width: detailsWidth }
  const map = { x: hierarchy.width, ...body, width: Math.max(3, details.x - hierarchy.width) }
  return {
    header: { x: 0, y: 1, width, height: 1 },
    hierarchy,
    map,
    mapViewport: { x: map.x + 1, y: map.y + 1, width: Math.max(1, map.width - 2), height: Math.max(1, map.height - 3) },
    details,
    footer: { x: 0, y: height - 2, width, height: 1 },
  }
}

export function mapViewportOf(size: { width: number; height: number }): Bounds {
  return paneLayout(size.width, size.height).mapViewport
}

export function mapRegion(frame: string, width: number): string {
  const layout = paneLayout(width, 36)
  return frame
    .split('\n')
    .map(line => [...line].slice(layout.map.x, layout.details.x).join(''))
    .join('\n')
}

export async function press(
  setup: Awaited<ReturnType<typeof createTestRenderer>>,
  ...keys: string[]
): Promise<string> {
  for (const key of keys) {
    if (key === 'enter') setup.mockInput.pressEnter()
    else if (key === 'tab') setup.mockInput.pressTab()
    else if (key === 'escape') {
      setup.mockInput.pressEscape()
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

export function box(
  id: string,
  kind: C4Kind,
  bounds: Bounds,
  extra: Partial<WorldElement> = {},
): WorldElement {
  return {
    representationId: extra.representationId ?? `observed:${id}`,
    id,
    kind,
    title: extra.title ?? id,
    overview: extra.overview ?? '',
    parent: extra.parent ?? null,
    children: extra.children ?? [],
    external: extra.external ?? false,
    ...(extra.group === undefined ? {} : { group: extra.group }),
    ...(extra.technology === undefined ? {} : { technology: extra.technology }),
    code: extra.code ?? [],
    origin: extra.origin ?? 'observed',
    bounds,
  }
}

export function navigationWorld(): ArchitectureWorld & TerminalViewModel {
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
  const world: ArchitectureWorld = {
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
      box('ann', 'actor', { x: 0, y: 8, width: 12, height: 12 }),
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
  return { ...world, drafts: [], sheet: sheetScene(world) }
}

/** A world of hand-built boxes with no layout bounds of its own. */
export function worldOf(
  elements: WorldElement[],
  relationships: WorldRelationship[] = [],
): ArchitectureWorld & TerminalViewModel {
  const world: ArchitectureWorld = {
    bounds: { x: 0, y: 0, width: 1, height: 1 },
    elements,
    groups: [],
    relationships,
  }
  return { ...world, drafts: [], sheet: sheetScene(world) }
}

/** An observed relationship between two boxes, by id. */
export function uses(id: string, source: string, target: string): WorldRelationship {
  return {
    id,
    source: `observed:${source}`,
    target: `observed:${target}`,
    description: id,
    technology: '',
    origin: 'observed',
    route: [],
    label: null,
  }
}
