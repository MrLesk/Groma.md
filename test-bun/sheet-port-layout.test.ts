import assert from 'node:assert/strict'

import { test } from 'bun:test'

import { portPairs } from '../src/sheet/port-layout.ts'
import type { PortSeed } from '../src/sheet/port-layout.ts'
import { routeAll } from '../src/sheet/route.ts'
import type { Endpoint } from '../src/sheet/route.ts'

test.concurrent('target preference is exhausted across source ports before the target moves', () => {
  const width = 40
  const seed: PortSeed = {
    source: { key: 'source', rect: { x0: 4, y0: 4, x1: 12, y1: 12 }, node: 332, policy: 'baseline' },
    target: { key: 'target', rect: { x0: 20, y0: 4, x1: 28, y1: 12 }, node: 260, policy: 'prefer-centre' },
  }
  const pairs = [...portPairs(seed, { source: 332, target: 340 }, width)]
  const firstRelaxed = pairs.findIndex(pair => pair.target !== 340)
  assert.ok(firstRelaxed > 1)
  assert.ok(pairs.slice(0, firstRelaxed).some(pair => pair.source !== 332))
})

test.concurrent('a route arrives through the middle of the target side that faces its source', () => {
  const endpoints = new Map<string, Endpoint>([
    ['source', { key: 'source', kind: 'building', rect: { gx: 8, gy: 9, w: 2, d: 2 }, within: [], roof: 1 }],
    ['target', { key: 'target', kind: 'building', rect: { gx: 2, gy: 3, w: 8, d: 2 }, within: [], roof: 1 }],
  ])
  const [route] = routeAll({ gx: 0, gy: 0, w: 16, d: 16 }, endpoints, [
    { id: 'relationship:0', source: 'source', target: 'target', description: 'uses', origin: 'observed' },
  ])
  const points = route!.points
  const end = points.at(-1)!
  const before = points.at(-2)!
  assert.deepEqual(end, { gx: 6, gy: 5 })
  assert.ok(before.gy > end.gy && before.gx === end.gx)
})

test.concurrent('a blocked target-side middle retains the nearest valid port', () => {
  const endpoints = new Map<string, Endpoint>([
    ['source', { key: 'source', kind: 'building', rect: { gx: 10, gy: 11, w: 2, d: 2 }, within: [], roof: 1 }],
    ['target', { key: 'target', kind: 'building', rect: { gx: 4, gy: 3, w: 8, d: 2 }, within: [], roof: 1 }],
    ['blocker', { key: 'blocker', kind: 'building', rect: { gx: 7, gy: 6, w: 1, d: 1 }, within: [], roof: 1 }],
  ])
  const [route] = routeAll({ gx: 0, gy: 0, w: 18, d: 18 }, endpoints, [
    { id: 'relationship:0', source: 'source', target: 'target', description: 'uses', origin: 'observed' },
  ])
  assert.deepEqual(route!.points.at(-1), { gx: 8.5, gy: 5 })
})

test.concurrent('a round actor centres one port and balances a shared side', () => {
  const endpoints = new Map<string, Endpoint>([
    ['actor', { key: 'actor', kind: 'building', rect: { gx: 4, gy: 4, w: 4, d: 4 }, within: [], roof: 1, centrePorts: true }],
    ['target', { key: 'target', kind: 'building', rect: { gx: 12, gy: 5, w: 2, d: 2 }, within: [], roof: 1 }],
  ])
  const requests = (count: number) => Array.from({ length: count }, (_, index) => ({
    id: `relationship:${index}`, source: 'actor', target: 'target', description: 'uses', origin: 'observed' as const,
  }))
  const [single] = routeAll({ gx: 0, gy: 0, w: 18, d: 14 }, endpoints, requests(1))
  assert.deepEqual(single!.points[0], { gx: 8, gy: 6 })

  const fan = routeAll({ gx: 0, gy: 0, w: 18, d: 14 }, endpoints, requests(3))
  assert.deepEqual(fan.map(route => route.points[0]!.gy - 6).sort(), [-0.5, 0, 0.5])
})
