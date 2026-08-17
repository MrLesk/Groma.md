import { expect, test } from 'bun:test'

import {
  actionCaption,
  actionLegs,
  actionPath,
  elementOnPath,
  outgoingActions,
  pickableActions,
  worldCommands,
} from '../src/viewers/action-path.ts'
import type {
  ArchitectureWorld,
  WorldElement,
  WorldRelationship,
} from '../src/types.ts'

function element(
  id: string,
  kind: WorldElement['kind'],
  parent: string | null = null,
): WorldElement {
  return {
    representationId: id,
    id,
    kind,
    name: id,
    description: '',
    parent,
    children: [],
    external: kind === 'system' && id === 'git',
    code: [],
    origin: 'observed',
    bounds: { x: 0, y: 0, width: 8, height: 8 },
  }
}

function edge(
  id: string,
  source: string,
  target: string,
): WorldRelationship {
  return {
    id,
    source,
    target,
    description: id,
    technology: 'test',
    origin: 'observed',
    route: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    label: null,
  }
}

const world: ArchitectureWorld = {
  bounds: { x: 0, y: 0, width: 40, height: 20 },
  groups: [],
  elements: [
    element('buyer', 'person'),
    element('shop', 'system'),
    element('api', 'container', 'shop'),
    element('web', 'container', 'shop'),
    element('jobs', 'container', 'shop'),
    element('store', 'container', 'shop'),
    element('git', 'system'),
    element('unused', 'person'),
    element('reader', 'person'),
    element('ops', 'person'),
  ],
  relationships: [
    edge('buyer-api', 'buyer', 'api'),
    edge('buyer-web', 'buyer', 'web'),
    edge('reader-web', 'reader', 'web'),
    edge('ops-api', 'ops', 'api'),
    edge('ops-web', 'ops', 'web'),
    edge('ops-git', 'ops', 'git'),
    edge('api-web', 'api', 'web'),
    edge('api-jobs', 'api', 'jobs'),
    edge('web-store', 'web', 'store'),
    edge('jobs-store', 'jobs', 'store'),
    edge('loop-a', 'store', 'jobs'),
    edge('shop-git', 'shop', 'git'),
  ],
}

test.concurrent('outgoing actions are titled by description and the authored target', () => {
  const names = new Map([
    ['buyer', 'Buyer'],
    ['api', 'Api'],
    ['shop', 'Shop'],
  ])
  const nameOf = (id: string) => names.get(id)
  expect(actionCaption(
    { source: 'buyer', target: 'api', description: 'Sends orders' },
    true,
    nameOf,
  )).toEqual({ title: 'Sends orders', detail: 'Api' })
  expect(actionCaption(
    { source: 'buyer', target: 'api', description: 'Sends orders' },
    false,
    nameOf,
  )).toEqual({ title: 'Buyer', detail: 'Sends orders' })
})

test.concurrent('a person who uses a launcher lists that launcher\'s outgoing', () => {
  expect(outgoingActions('buyer', world).map(item => item.id)).toEqual([
    'api-web',
    'api-jobs',
  ])
  expect(outgoingActions('ops', world).map(item => item.id)).toEqual([
    'api-web',
    'api-jobs',
    'ops-git',
  ])
  expect(outgoingActions('reader', world).map(item => item.id)).toEqual([
    'reader-web',
  ])
  expect(outgoingActions('unused', world)).toEqual([])
  expect(outgoingActions('api', world).map(item => item.id)).toEqual([
    'api-web',
    'api-jobs',
  ])
  expect(pickableActions('buyer', world).map(item => item.id)).toEqual([
    'api-web',
    'api-jobs',
  ])
  expect(pickableActions('api', world)).toEqual([])
})

test.concurrent('an action path is one walk and keeps people who use its start', () => {
  expect([...actionPath('buyer-api', world)].sort()).toEqual([
    'api-jobs',
    'api-web',
    'buyer-api',
    'jobs-store',
    'loop-a',
    'web-store',
  ])
  const one = actionPath('api-jobs', world)
  expect([...one].sort()).toEqual([
    'api-jobs',
    'buyer-api',
    'jobs-store',
    'loop-a',
    'ops-api',
  ])
  expect(elementOnPath('buyer', one, world)).toBe(true)
  expect(elementOnPath('jobs', one, world)).toBe(true)
  expect(elementOnPath('git', one, world)).toBe(false)
  expect(elementOnPath('git', actionPath('shop-git', world), world)).toBe(true)
  expect(actionPath('missing', world).size).toBe(0)
  expect(actionPath(undefined, world).size).toBe(0)
})

test.concurrent('the world lists every person command once', () => {
  expect(worldCommands(world).map(item => item.id)).toEqual([
    'api-web',
    'api-jobs',
    'reader-web',
    'ops-git',
  ])
})

test.concurrent('action legs walk in travel order: approaches, then onward', () => {
  expect(actionLegs('api-jobs', world).map(leg => leg.id)).toEqual([
    'buyer-api',
    'ops-api',
    'api-jobs',
    'jobs-store',
    'loop-a',
  ])
  expect(actionLegs('buyer-api', world).map(leg => leg.id)).toEqual([
    'buyer-api',
    'api-web',
    'api-jobs',
    'web-store',
    'jobs-store',
    'loop-a',
  ])
  expect(actionLegs('missing', world)).toEqual([])
  // Scoped to one person, only their approach joins the walk.
  expect(actionLegs('api-jobs', world, 'buyer').map(leg => leg.id)).toEqual([
    'buyer-api',
    'api-jobs',
    'jobs-store',
    'loop-a',
  ])
})
