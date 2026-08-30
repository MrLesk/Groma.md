import { expect, test } from 'bun:test'

import {
  detailsTabs,
  detailsTabAfterSelection,
  detailsTabAfterWork,
  inspectDetails,
  tabSections,
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
    name: extra.name ?? id,
    description: extra.description ?? '',
    parent,
    children,
    external: extra.external ?? false,
    ...(extra.technology === undefined ? {} : { technology: extra.technology }),
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
  expect(layout.files).toEqual([{
    scanner: 'typescript',
    file: 'src/world-layout.ts',
    symbol: 'layoutWorld',
  }])
})

test.concurrent('a declared technology becomes chips; none stays empty', () => {
  const fixture = world()
  const web = inspectDetails(fixture.elements[3]!, fixture)
  expect(web.technology).toEqual(['Three.js', 'Bun serve'])
  const core = inspectDetails(fixture.elements[2]!, fixture)
  expect(core.technology).toEqual([])
})

test.concurrent('the tabs split meaning from build evidence', () => {
  expect(tabSections('what')).toEqual([
    'description',
    'relationships',
    'commands',
    'flowsThrough',
    'children',
  ])
  expect(tabSections('how')).toEqual(['technology', 'code', 'files'])
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

test.concurrent('actor commands are scoped flows and stay separate from peer relationships', () => {
  const fixture: ArchitectureWorld = {
    bounds: { x: 0, y: 0, width: 40, height: 20 },
    groups: [],
    elements: [
      element('buyer', 'actor', null, []),
      element('api', 'container', null, []),
      element('web', 'container', null, []),
      element('jobs', 'container', null, []),
    ],
    relationships: [
      {
        id: 'buyer-api',
        source: 'buyer',
        target: 'api',
        description: 'sends',
        technology: '',
        origin: 'observed',
        route: [],
        label: null,
      },
      {
        id: 'buyer-web',
        source: 'buyer',
        target: 'web',
        description: 'reads',
        technology: '',
        origin: 'observed',
        route: [],
        label: null,
      },
      {
        id: 'api-web',
        source: 'api',
        target: 'web',
        description: 'starts',
        technology: '',
        origin: 'observed',
        route: [],
        label: null,
      },
      {
        id: 'api-jobs',
        source: 'api',
        target: 'jobs',
        description: 'runs jobs',
        technology: '',
        origin: 'observed',
        route: [],
        label: null,
      },
    ],
  }
  const buyer = inspectDetails(fixture.elements[0]!, fixture)
  expect(buyer.commands).toEqual([
    { flow: { commandId: 'api-web', actorId: 'buyer' }, title: 'starts' },
    { flow: { commandId: 'api-jobs', actorId: 'buyer' }, title: 'runs jobs' },
  ])
  expect(buyer.relationships.map(({ peerId, description }) => ({ peerId, description }))).toEqual([
    { peerId: 'api', description: 'sends' },
    { peerId: 'web', description: 'reads' },
  ])
  expect(buyer.flowsThrough).toEqual([])

  const api = inspectDetails(fixture.elements[1]!, fixture)
  expect(api.commands).toEqual([])
  expect(api.relationships.map(({ peerId, outgoing, description }) => ({
    peerId,
    outgoing,
    description,
  }))).toEqual([
    { peerId: 'buyer', outgoing: false, description: 'sends' },
    { peerId: 'web', outgoing: true, description: 'starts' },
    { peerId: 'jobs', outgoing: true, description: 'runs jobs' },
  ])

  // An element is travelled by exactly the commands whose walk touches it.
  const jobs = inspectDetails(fixture.elements[3]!, fixture)
  expect(jobs.flowsThrough).toEqual([{
    flow: { commandId: 'api-jobs' },
    title: 'runs jobs',
  }])
  const web = inspectDetails(fixture.elements[2]!, fixture)
  expect(web.flowsThrough).toEqual([{
    flow: { commandId: 'api-web' },
    title: 'starts',
  }])
  expect(api.flowsThrough.map(flow => flow.flow.commandId)).toEqual(['api-web', 'api-jobs'])
})
