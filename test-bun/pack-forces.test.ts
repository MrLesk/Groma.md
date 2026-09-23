import { expect, test } from 'bun:test'
import { GAP } from '../src/sheet/forces.ts'
import { balance } from '../src/sheet/pack-forces.ts'
import type { Partnered, Shelf } from '../src/sheet/pack.ts'

const item = (key: string, partners: [string, number][] = []): Partnered =>
  ({ key, w: 2, d: 2, entry: false, partners: new Map(partners) })
const shelfAt = (at: [string, number, number][]): Shelf =>
  ({ w: 0, d: 0, at: new Map(at.map(([key, gx, gy]) => [key, { gx, gy }])) })

test.concurrent('siblings packed at the sibling gap spread further apart', () => {
  // A partner pair keeps the forces on; c and d start side by side at the least gap, far from the pair.
  const items = [item('a', [['b', 1]]), item('b', [['a', 1]]), item('c'), item('d')]
  const start = shelfAt([['a', 1, 1], ['b', 5, 1], ['c', 1, 12], ['d', 1 + 2 + GAP, 12]])

  const placed = balance(items, start)

  const gap = placed.at.get('d')!.gx - (placed.at.get('c')!.gx + 2)
  expect(gap).toBeGreaterThan(GAP)
})

test.concurrent('partners side by side move to face each other so their route can run straight', () => {
  const items = [item('a', [['b', 2]]), item('b', [['a', 2]])]
  const start = shelfAt([['a', 1, 1], ['b', 1 + 2 + GAP + 2, 4]])

  const placed = balance(items, start)

  expect(placed.at.get('a')!.gy).toBe(placed.at.get('b')!.gy)
})
