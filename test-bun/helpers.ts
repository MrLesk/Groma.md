import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createTestRenderer } from '@opentui/core/testing'

import { paneLayout } from '../src/viewers/tui/layout.ts'
import type {
  ArchitectureWorld,
  Bounds,
  C4Kind,
  MapCamera,
  Point,
  ProjectedElement,
  WorldElement,
  WorldRelationship,
} from '../src/types.ts'

export const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
export const fixtureRoot = path.join(repositoryRoot, 'test', 'fixtures', 'core-view')
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
/** Upper-band product world authored from OpenClaw docs, not its old scanner dump. */
export const openclawFixtureRoot = path.join(
  repositoryRoot,
  'test',
  'fixtures',
  'openclaw-view',
)

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

export function overlaps(left: Bounds, right: Bounds): boolean {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y
}

export function visible(bounds: Bounds, viewport: Bounds): boolean {
  return bounds.x < viewport.x + viewport.width
    && bounds.x + bounds.width > viewport.x
    && bounds.y < viewport.y + viewport.height
    && bounds.y + bounds.height > viewport.y
}

export function contains(bounds: Bounds, point: Point | undefined): boolean {
  assert.ok(point)
  return point.x >= bounds.x
    && point.x < bounds.x + bounds.width
    && point.y >= bounds.y
    && point.y < bounds.y + bounds.height
}

export function requiredElement(
  elementsById: Map<string, ProjectedElement>,
  id: string,
): ProjectedElement {
  const element = elementsById.get(id)
  assert.ok(element)
  return element
}

export function projectedById(
  elements: ProjectedElement[],
): Map<string, ProjectedElement> {
  return new Map(elements.map(element => [element.representationId, element]))
}

export function geometry(world: ArchitectureWorld) {
  return {
    bounds: world.bounds,
    elements: world.elements.map(element => [element.representationId, element.bounds]),
    routes: world.relationships.map(relationship => {
      return [relationship.id, relationship.route, relationship.label]
    }),
  }
}

export async function press(
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

export function cameraOn(
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

export function navigationWorld(): ArchitectureWorld {
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
}

/** A world of hand-built boxes with no layout bounds of its own. */
export function worldOf(elements: WorldElement[], relationships: WorldRelationship[] = []): ArchitectureWorld {
  return { bounds: { x: 0, y: 0, width: 1, height: 1 }, elements, groups: [], relationships }
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
