import { expect, test } from 'bun:test'

import { inspectDetails } from '../src/viewers/web/organisms/details.ts'
import type {
  ArchitectureWorld,
  Bounds,
  C4Kind,
  WorldElement,
} from '../src/types.ts'

function element(
  id: string,
  kind: C4Kind,
  parent: string | null,
  children: string[],
  extra: Partial<WorldElement> = {},
): WorldElement {
  const bounds: Bounds = extra.bounds ?? { x: 0, y: 0, width: 10, height: 10 }
  return {
    representationId: id,
    id,
    kind,
    name: extra.name ?? id,
    description: extra.description ?? '',
    parent,
    children,
    external: extra.external ?? false,
    code: extra.code ?? [],
    origin: extra.origin ?? 'observed',
    bounds,
  }
}

function world(): ArchitectureWorld {
  return {
    bounds: { x: 0, y: 0, width: 100, height: 40 },
    groups: [],
    elements: [
      element('groma', 'system', null, ['core', 'web'], {
        description: 'this repo',
        bounds: { x: 20, y: 0, width: 60, height: 40 },
      }),
      element('git', 'system', null, [], {
        external: true,
        bounds: { x: 90, y: 10, width: 10, height: 10 },
      }),
      element('core', 'container', 'groma', ['layout'], {
        bounds: { x: 24, y: 8, width: 20, height: 24 },
      }),
      element('web', 'container', 'groma', [], {
        bounds: { x: 50, y: 8, width: 20, height: 24 },
      }),
      element('layout', 'component', 'core', [], {
        code: [{ scanner: 'typescript', file: 'src/world-layout.ts', symbol: 'layoutWorld' }],
        bounds: { x: 26, y: 12, width: 12, height: 8 },
      }),
    ],
    relationships: [
      {
        id: 'r1',
        source: 'layout',
        target: 'web',
        description: 'supplies positions',
        technology: '',
        origin: 'observed',
        route: [],
        label: null,
      },
    ],
  }
}

test.concurrent('details list children, promoted peers, and code', () => {
  const fixture = world()
  const groma = inspectDetails(fixture.elements[0]!, fixture)
  expect(groma.kindLabel).toBe('System')
  expect(groma.origin).toBe('observed')
  expect(groma.description).toBe('this repo')
  expect(groma.children.map(child => child.name)).toEqual(['core', 'web'])
  expect(groma.relationships).toEqual([])

  const core = inspectDetails(fixture.elements[2]!, fixture)
  expect(core.relationships).toEqual([{
    outgoing: true,
    peerId: 'web',
    peerName: 'web',
    peerKind: 'container',
    peerExternal: false,
    description: 'supplies positions',
  }])

  const layout = inspectDetails(fixture.elements[4]!, fixture)
  expect(layout.code).toEqual([{
    scanner: 'typescript',
    file: 'src/world-layout.ts',
    symbol: 'layoutWorld',
  }])
})

