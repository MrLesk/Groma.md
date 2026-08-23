import assert from 'node:assert/strict'

import { test } from 'bun:test'

import { GAP } from '../src/sheet/forces.ts'
import { unionRects } from '../src/sheet/grid.ts'
import { sheetScene } from '../src/sheet/scene.ts'
import type { CellRect, SheetScene } from '../src/sheet/types.ts'
import type { ArchitectureWorld, WorldRelationship } from '../src/types.ts'
import { box, uses, worldOf } from './helpers.ts'

const unit = { x: 0, y: 0, width: 1, height: 1 }

function rectOf(scene: SheetScene, id: string): CellRect {
  const found = [...scene.buildings, ...scene.slabs].find(item => item.representationId === `observed:${id}`)
    ?? scene.islands.find(island => island.element?.representationId === `observed:${id}`)
  assert.ok(found, `${id} placed`)
  return found.rect
}

const centre = (rect: CellRect): { x: number; y: number } => ({ x: rect.gx + rect.w / 2, y: rect.gy + rect.d / 2 })
const eastOf = (east: CellRect, west: CellRect): boolean => east.gx >= west.gx + west.w + GAP
/** Lined up with the other on one axis and exactly GAP away on the other: one straight run between them. */
function beside(a: CellRect, b: CellRect): boolean {
  const gapX = Math.max(a.gx - (b.gx + b.w), b.gx - (a.gx + a.w))
  const gapY = Math.max(a.gy - (b.gy + b.d), b.gy - (a.gy + a.d))
  return (Math.abs(centre(a).y - centre(b).y) <= 0.5 && gapX === GAP)
    || (Math.abs(centre(a).x - centre(b).x) <= 0.5 && gapY === GAP)
}
function keepGap(rects: readonly CellRect[]): void {
  rects.forEach((a, index) => {
    for (const b of rects.slice(index + 1)) {
      assert.ok(a.gx + a.w + GAP <= b.gx || b.gx + b.w + GAP <= a.gx || a.gy + a.d + GAP <= b.gy || b.gy + b.d + GAP <= a.gy)
    }
  })
}

/** A person using components of container `api` inside system `shop`, plus the given components in `api`. */
function shopWorld(components: string[], relationships: WorldRelationship[]): ArchitectureWorld {
  return worldOf([
    box('ann', 'person', unit),
    box('shop', 'system', unit),
    box('api', 'container', unit, { parent: 'observed:shop' }),
    ...components.map(name => box(name, 'component', unit, { parent: 'observed:api' })),
  ], relationships)
}

test.concurrent('a chain grows east from its entry, a cycle closes beside it, and the unconnected go last', () => {
  const scene = sheetScene(shopWorld(['a', 'b', 'c', 'u'], [
    uses('relationship:0', 'ann', 'a'),
    uses('relationship:1', 'a', 'b'),
    uses('relationship:2', 'b', 'c'),
    uses('relationship:3', 'c', 'a'),
  ]))
  const [a, b, c, u] = ['a', 'b', 'c', 'u'].map(id => rectOf(scene, id))
  assert.ok(beside(b!, a!) && eastOf(b!, a!))
  assert.ok(beside(c!, b!) || beside(c!, a!))
  const connected = unionRects([a!, b!, c!])!
  assert.ok(u!.gx >= connected.gx + connected.w + GAP)
})

test.concurrent('containers grow from where the flow enters them, through their components, along straight arrows', () => {
  const scene = sheetScene(worldOf([
    box('ann', 'person', unit),
    box('shop', 'system', unit),
    ...['x', 'y', 'z', 'w'].map(name => box(name, 'container', unit, { parent: 'observed:shop' })),
    ...['x', 'y', 'z', 'w'].map(name => box(`${name}1`, 'component', unit, { parent: `observed:${name}` })),
  ], [
    uses('relationship:0', 'ann', 'x1'),
    uses('relationship:1', 'x1', 'y1'),
    uses('relationship:2', 'y1', 'z1'),
  ]))
  const [x, y, z, w] = ['x', 'y', 'z', 'w'].map(id => rectOf(scene, id))
  assert.ok(beside(y!, x!) && eastOf(y!, x!))
  assert.ok(beside(z!, y!))
  const connected = unionRects([x!, y!, z!])!
  assert.ok(w!.gx >= connected.gx + connected.w + GAP)
})

test.concurrent('a child lines up with its one partner, so their route is one straight run', () => {
  const scene = sheetScene(shopWorld(['a', 'b', 'u', 'v'], [
    uses('relationship:0', 'ann', 'a'),
    uses('relationship:1', 'a', 'b'),
  ]))
  assert.ok(beside(rectOf(scene, 'b'), rectOf(scene, 'a')))
  assert.equal(scene.routes[1]!.points.length, 2)
})

test.concurrent('a source with several targets has each of them beside it on a straight run', () => {
  const scene = sheetScene(shopWorld(['a', 'b', 'c', 'd'], [
    uses('relationship:0', 'ann', 'a'),
    uses('relationship:1', 'a', 'b'),
    uses('relationship:2', 'a', 'c'),
    uses('relationship:3', 'a', 'd'),
  ]))
  const a = rectOf(scene, 'a')
  const targets = ['b', 'c', 'd'].map(id => rectOf(scene, id))
  for (const target of targets) assert.ok(beside(target, a))
  keepGap([a, ...targets])
})

test.concurrent('a heavy target comes beside its sources and light intermediates leave the corridor', () => {
  const scene = sheetScene(shopWorld(['a', 'b', 'c', 'd', 'e'], [
    uses('relationship:0', 'ann', 'a'),
    uses('relationship:1', 'ann', 'b'),
    uses('relationship:2', 'a', 'c'),
    uses('relationship:3', 'b', 'e'),
    uses('relationship:4', 'a', 'd'),
    uses('relationship:5', 'b', 'd'),
    uses('relationship:6', 'c', 'd'),
    uses('relationship:7', 'e', 'd'),
  ]))
  const [a, b, c, d, e] = ['a', 'b', 'c', 'd', 'e'].map(id => rectOf(scene, id))
  assert.equal(d!.gx, Math.max(a!.gx + a!.w, b!.gx + b!.w) + GAP)
  // Neither light child stands in the corridor between the sources and the target.
  for (const light of [c!, e!]) assert.ok(light.gx + light.w <= a!.gx + a!.w || light.gx >= d!.gx)
  keepGap([a!, b!, c!, d!, e!])
})

test.concurrent('entries that would stack into a strip fold into a square-ish block', () => {
  const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']
  const scene = sheetScene(shopWorld(names, names.map((name, index) => uses(`relationship:${index}`, 'ann', name))))
  const api = rectOf(scene, 'api')
  assert.ok(api.d <= 2 * api.w)
  keepGap(names.map(name => rectOf(scene, name)))
})

test.concurrent('people and external islands face the centre of their partners', () => {
  const scene = sheetScene(worldOf([
    box('ann', 'person', unit),
    box('shop', 'system', unit),
    box('api', 'container', unit, { parent: 'observed:shop' }),
    ...['x', 'y', 'u', 'v', 'w'].map(name => box(name, 'component', unit, { parent: 'observed:api' })),
    box('bank', 'system', unit, { external: true }),
  ], [
    uses('relationship:0', 'ann', 'x'),
    uses('relationship:1', 'ann', 'y'),
    uses('relationship:2', 'w', 'bank'),
  ]))
  const ann = rectOf(scene, 'ann')
  const targets = (centre(rectOf(scene, 'x')).y + centre(rectOf(scene, 'y')).y) / 2
  assert.ok(Math.abs(centre(ann).y - targets) <= 1)
  assert.ok(Math.abs(centre(rectOf(scene, 'bank')).y - centre(rectOf(scene, 'w')).y) <= 1)
})
