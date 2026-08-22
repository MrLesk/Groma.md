import assert from 'node:assert/strict'

import { test } from 'bun:test'

import { GAP } from '../src/sheet/grid.ts'
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

const centre = (rect: CellRect): number => rect.gy + rect.d / 2
const eastOf = (east: CellRect, west: CellRect): boolean => east.gx >= west.gx + west.w + GAP

/** A person using component `a` inside container `api` of system `shop`, plus the given components in `api`. */
function shopWorld(components: string[], relationships: WorldRelationship[]): ArchitectureWorld {
  return worldOf([
    box('ann', 'person', unit),
    box('shop', 'system', unit),
    box('api', 'container', unit, { parent: 'observed:shop' }),
    ...components.map(name => box(name, 'component', unit, { parent: 'observed:api' })),
  ], relationships)
}

test.concurrent('components form columns by flow rank: a chain runs west to east, a cycle keeps the first reached element west, the unconnected go last', () => {
  const scene = sheetScene(shopWorld(['a', 'b', 'c', 'u'], [
    uses('relationship:0', 'ann', 'a'),
    uses('relationship:1', 'a', 'b'),
    uses('relationship:2', 'b', 'c'),
    uses('relationship:3', 'c', 'a'),
  ]))
  const [a, b, c, u] = ['a', 'b', 'c', 'u'].map(id => rectOf(scene, id))
  assert.ok(eastOf(b!, a!))
  assert.ok(eastOf(c!, b!))
  assert.ok(eastOf(u!, c!))
})

test.concurrent('containers rank where the flow first enters them, through their components', () => {
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
  assert.ok(eastOf(y!, x!))
  assert.ok(eastOf(z!, y!))
  assert.ok(eastOf(w!, z!))
})

test.concurrent('a child lines up with its one partner, so their route is one straight run', () => {
  const scene = sheetScene(shopWorld(['a', 'b', 'u', 'v'], [
    uses('relationship:0', 'ann', 'a'),
    uses('relationship:1', 'a', 'b'),
  ]))
  const a = rectOf(scene, 'a')
  const b = rectOf(scene, 'b')
  assert.ok(Math.abs(centre(a) - centre(b)) <= 0.5)
  assert.equal(scene.routes[1]!.points.length, 2)
})

test.concurrent('a source without earlier partners centres on the targets in the next column', () => {
  const scene = sheetScene(shopWorld(['a', 'b', 'c', 'd'], [
    uses('relationship:0', 'ann', 'a'),
    uses('relationship:1', 'a', 'b'),
    uses('relationship:2', 'a', 'c'),
    uses('relationship:3', 'a', 'd'),
  ]))
  const a = rectOf(scene, 'a')
  const targets = ['b', 'c', 'd'].map(id => rectOf(scene, id))
  const top = Math.min(...targets.map(rect => rect.gy))
  const bottom = Math.max(...targets.map(rect => rect.gy + rect.d))
  assert.ok(Math.abs(centre(a) - (top + bottom) / 2) <= 1)
  for (const target of targets) assert.ok(eastOf(target, a))
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
  const targets = (centre(rectOf(scene, 'x')) + centre(rectOf(scene, 'y'))) / 2
  assert.ok(Math.abs(centre(ann) - targets) <= 1)
  assert.ok(Math.abs(centre(rectOf(scene, 'bank')) - centre(rectOf(scene, 'w'))) <= 1)
})
