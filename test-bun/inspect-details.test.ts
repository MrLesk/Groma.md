import { expect, test } from 'bun:test'

import {
  inspectDetails,
  nextActiveAction,
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
    id: 'r1',
    outgoing: true,
    pickable: false,
    peerId: 'web',
    peerName: 'web',
    peerKind: 'container',
    peerExternal: false,
    title: 'supplies positions',
    detail: 'web',
  }])

  const layout = inspectDetails(fixture.elements[4]!, fixture)
  expect(layout.code).toEqual([{
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
  expect(tabSections('what')).toEqual(['description', 'relationships', 'children'])
  expect(tabSections('how')).toEqual(['technology', 'code', 'travelledBy'])
})

test.concurrent('an actor lists launcher commands as pickable actions', () => {
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
  expect(buyer.relationships.map(item => ({
    id: item.id,
    pickable: item.pickable,
  }))).toEqual([
    { id: 'api-web', pickable: true },
    { id: 'api-jobs', pickable: true },
  ])
  const api = inspectDetails(fixture.elements[1]!, fixture)
  expect(api.relationships.every(item => item.pickable)).toBe(false)

  // An element is travelled by exactly the commands whose walk touches it.
  const jobs = inspectDetails(fixture.elements[3]!, fixture)
  expect(jobs.travelledBy).toEqual([{ id: 'api-jobs', title: 'runs jobs' }])
  const web = inspectDetails(fixture.elements[2]!, fixture)
  expect(web.travelledBy).toEqual([{ id: 'api-web', title: 'starts' }])
  expect(api.travelledBy.map(walk => walk.id)).toEqual(['api-web', 'api-jobs'])
})

test.concurrent('a picked action stays across selection and clears on x', () => {
  let action = nextActiveAction({}, { type: 'pick', id: 'api-jobs', actorId: 'buyer' })
  expect(action.id).toBe('api-jobs')
  expect(action.actorId).toBe('buyer')
  action = nextActiveAction(action, { type: 'select' })
  expect(action.id).toBe('api-jobs')
  expect(action.actorId).toBe('buyer')
  // An actor-less pick replaces the walk and drops the scope.
  action = nextActiveAction(action, { type: 'pick', id: 'api-web' })
  expect(action.id).toBe('api-web')
  expect(action.actorId).toBeUndefined()
  action = nextActiveAction(action, { type: 'clear' })
  expect(action.id).toBeUndefined()
  expect(action.actorId).toBeUndefined()
})
