import { expect, test } from 'bun:test'

import {
  detailsTabs,
  detailsTabAfterSelection,
  detailsTabAfterWork,
  inspectDetails,
} from '../src/viewers/web/organisms/details.ts'
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
    title: extra.title ?? id,
    overview: extra.overview ?? '',
    parent,
    children,
    external: extra.external ?? false,
    ...(extra.technology === undefined ? {} : { technology: extra.technology }),
    code: extra.code ?? [],
    ...(extra.movable === undefined ? {} : { movable: extra.movable }),
    origin: extra.origin ?? 'observed',
    bounds,
  }
}

function world(): ArchitectureWorld {
  return {
    bounds: { x: 0, y: 0, width: 100, height: 40 },
    groups: [],
    flows: [],
    elements: [
      element('groma', 'system', null, ['core', 'web'], {
        overview: 'this repo',
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
        technology: 'Three.js, Bun serve',
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

test.concurrent('details list children, promoted peers, and files', () => {
  const fixture = world()
  const groma = inspectDetails(fixture.elements[0]!, fixture)
  expect(groma.origin).toBe('observed')
  expect(groma.children.map(child => child.id)).toEqual(['core', 'web'])
  expect(groma.relationships).toEqual([])

  const core = inspectDetails(fixture.elements[2]!, fixture)
  const outgoing = core.relationships[0]!
  expect(outgoing.source.representationId).toBe(core.id)
  expect(outgoing.target.representationId).toBe('web')
  expect(outgoing.id).toBe(fixture.relationships[0]!.id)

  const web = inspectDetails(fixture.elements[3]!, fixture)
  const incoming = web.relationships[0]!
  expect(incoming.source.representationId).toBe(core.id)
  expect(incoming.target.representationId).toBe(web.id)
  expect(incoming.id).toBe(outgoing.id)

  const layout = inspectDetails(fixture.elements[4]!, fixture)
  expect(layout.files).toEqual([{
    scanner: 'typescript',
    file: 'src/world-layout.ts',
    symbol: 'layoutWorld',
  }])
})

test.concurrent('the Tasks tab exists only while the selected component has linked work', () => {
  const inspected = { technology: [], files: [] }
  expect(detailsTabs(inspected, [])).toEqual(['what'])
  expect(detailsTabs(inspected, [{ items: [] }])).toEqual(['what'])
  expect(detailsTabs(inspected, [{ items: [{}] }])).toEqual(['what', 'tasks'])
  expect(detailsTabs({ ...inspected, technology: ['Bun'] }, [])).toEqual(['what', 'how'])
})

test.concurrent('the build tab resets only when the primary selection changes', () => {
  expect(detailsTabAfterSelection('how', 'component-a', 'component-b')).toBe('what')
  expect(detailsTabAfterSelection('how', 'component-a', 'component-a')).toBe('how')
})

test.concurrent('live work closes Tasks when the selected component has no linked task', () => {
  expect(detailsTabAfterWork('tasks', false)).toBe('what')
  expect(detailsTabAfterWork('tasks', true)).toBe('tasks')
})

test.concurrent('the details pane offers Remove only where the verb would succeed', () => {
  const fixture: ArchitectureWorld = {
    bounds: { x: 0, y: 0, width: 40, height: 20 },
    groups: [],
    flows: [],
    elements: [
      element('ann', 'actor', null, []),
      element('vault', 'system', null, [], { external: true }),
      element('shop', 'system', null, ['api']),
      element('api', 'container', 'shop', ['bins']),
      element('bins', 'component', 'api', [], { origin: 'draft' }),
    ],
    relationships: [{
      id: 'ann-vault',
      source: 'ann',
      target: 'vault',
      description: 'pays',
      technology: '',
      origin: 'observed',
      route: [],
      label: null,
    }],
  }
  const removable = (id: string) =>
    inspectDetails(fixture.elements.find(element => element.id === id)!, fixture).removable
  expect(removable('ann')).toBe(true)
  expect(removable('bins')).toBe(true)
  expect(removable('vault')).toBe(false)
  expect(removable('shop')).toBe(false)
})

test.concurrent('Accept and Parent reflect the core-projected element states', () => {
  const fixture = world()
  const matched = element('matched', 'component', 'core', [], {
    origin: 'draft',
    code: [{ scanner: 'typescript', file: 'src/matched.ts' }],
  })
  const unmatched = element('unmatched', 'component', 'core', [], { origin: 'draft' })
  const empty = element('empty', 'component', 'core', [], { movable: true })
  const authored = element('authored', 'component', 'core', [], {
    overview: 'Owns a product responsibility.',
    movable: false,
  })
  fixture.elements.push(matched, unmatched, empty, authored)

  expect(inspectDetails(matched, fixture).matchedGhost).toBe(true)
  expect(inspectDetails(unmatched, fixture).matchedGhost).toBe(false)
  expect(inspectDetails(empty, fixture).movable).toBe(true)
  expect(inspectDetails(authored, fixture).movable).toBe(false)
  expect(inspectDetails(fixture.elements.find(item => item.id === 'layout')!, fixture).movable).toBe(false)
})
