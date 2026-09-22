import assert from 'node:assert/strict'
import { test } from 'bun:test'

import type { Building, Route, SheetScene } from '../src/sheet/types.ts'
import { MORPH_DURATION_MS, MORPH_FASTEST_MS, sameSheet, tweenSheet } from '../src/viewers/web/iso/morph.ts'
import { createMapMotion, presentScene } from '../src/viewers/web/iso/presentation.ts'
import { NESTED_POSE } from '../src/viewers/web/layers/orbit.ts'
import { labelBand, CONTAINER_FONT } from '../src/sheet/measure.ts'
import { box, uses, worldOf } from './helpers.ts'

function building(id: string, gx: number, gy: number, heightUnits = 2): Building {
  return {
    representationId: `observed:${id}`, id, title: id, origin: 'observed', kind: 'component', external: false, surface: 'observed:container',
    rect: { gx, gy, w: 4, d: 4 }, heightUnits, shape: { kind: 'block' },
    floors: [{ files: [`src/${id}.ts`], facadeFileType: 'ts', heightUnits, footprint: { w: 3, d: 3 } }], lines: [id],
  }
}

function route(id: string, source: string, target: string, points: Route['points']): Route {
  return { id, source: `observed:${source}`, target: `observed:${target}`, description: '', origin: 'observed', points }
}

function sheetOf(buildings: Building[], routes: Route[] = [], width = 40): SheetScene {
  return {
    sheet: { gx: 0, gy: 0, w: width, d: 30 },
    islands: [{ key: 'island:system', kind: 'system', name: 'System', element: null, rect: { gx: 2, gy: 2, w: width - 4, d: 26 } }],
    zones: [],
    slabs: [{ representationId: 'observed:container', id: 'container', title: 'Container', origin: 'observed', island: 'island:system', rect: { gx: 4, gy: 4, w: width - 8, d: 22 } }],
    buildings,
    routes,
  }
}

const before = sheetOf([building('a', 6, 6), building('gone', 20, 6)], [route('a-gone', 'a', 'gone', [{ gx: 10, gy: 8 }, { gx: 20, gy: 8 }])])
const after = sheetOf([building('a', 12, 6, 4), building('b', 24, 6)], [route('a-b', 'a', 'b', [{ gx: 16, gy: 8 }, { gx: 20, gy: 8 }, { gx: 20, gy: 12 }, { gx: 24, gy: 12 }])], 60)

test.concurrent('the ends of a tween are the sheets themselves', () => {
  assert.equal(tweenSheet(before, after, 0), before)
  assert.equal(tweenSheet(before, after, 1), after)
  assert.ok(sameSheet(before, structuredClone(before)))
  assert.ok(!sameSheet(before, after))
})

test.concurrent('shared surfaces glide and the sheet grows with them', () => {
  const middle = tweenSheet(before, after, 0.5)
  assert.deepEqual(middle.sheet, { gx: 0, gy: 0, w: 50, d: 30 })
  assert.deepEqual(middle.slabs[0]!.rect, { gx: 4, gy: 4, w: 42, d: 22 })
  const a = middle.buildings.find(item => item.id === 'a')!
  assert.deepEqual(a.rect, { gx: 9, gy: 6, w: 4, d: 4 })
  assert.equal(a.heightUnits, 3)
  assert.equal(a.floors[0]!.heightUnits, 3)
})

test.concurrent('new buildings grow from their centre and departed ones shrink away', () => {
  const early = tweenSheet(before, after, 0.25)
  const b = early.buildings.find(item => item.id === 'b')!
  assert.deepEqual(b.rect, { gx: 25.5, gy: 7.5, w: 1, d: 1 })
  assert.equal(b.heightUnits, 0.5)
  assert.deepEqual(b.lines, [''])
  assert.deepEqual(tweenSheet(before, after, 0.75).buildings.find(item => item.id === 'b')!.lines, ['b'])
  const gone = early.buildings.find(item => item.id === 'gone')!
  assert.deepEqual(gone.rect, { gx: 20.5, gy: 6.5, w: 3, d: 3 })
  assert.ok(!tweenSheet(before, after, 1).buildings.some(item => item.id === 'gone'))
})

test.concurrent('routes draw on from their source and retract into it', () => {
  const half = tweenSheet(before, after, 0.5)
  const drawn = half.routes.find(item => item.id === 'a-b')!
  // Half of a 12-cell path: along the first run, round the corner, two cells down.
  assert.deepEqual(drawn.points, [{ gx: 16, gy: 8 }, { gx: 20, gy: 8 }, { gx: 20, gy: 10 }])
  const retracting = half.routes.find(item => item.id === 'a-gone')!
  assert.deepEqual(retracting.points, [{ gx: 10, gy: 8 }, { gx: 15, gy: 8 }])
  assert.ok(!tweenSheet(before, after, 1).routes.some(item => item.id === 'a-gone'))
})

test.concurrent('a shared route keeps the corners of both shapes while it moves', () => {
  const from = sheetOf([building('a', 6, 6), building('b', 31, 6)], [route('a-b', 'a', 'b', [{ gx: 10, gy: 8 }, { gx: 31, gy: 8 }])])
  const to = sheetOf([building('a', 6, 6), building('b', 24, 13)], [route('a-b', 'a', 'b', [{ gx: 10, gy: 8 }, { gx: 17, gy: 8 }, { gx: 17, gy: 15 }, { gx: 24, gy: 15 }])])
  // Both paths are 21 cells long; the straight one is sampled where the bent one turns.
  assert.deepEqual(tweenSheet(from, to, 0.5).routes[0]!.points, [{ gx: 10, gy: 8 }, { gx: 17, gy: 8 }, { gx: 20.5, gy: 11.5 }, { gx: 27.5, gy: 11.5 }])
})

test.concurrent('a placement of a real world survives a tween into itself, from nothing, and into another world', () => {
  const unit = { x: 0, y: 0, width: 1, height: 1 }
  const small = worldOf([
    box('system', 'system', unit, { children: ['observed:container'] }),
    box('container', 'container', unit, { parent: 'observed:system', children: ['observed:part'] }),
    box('part', 'component', unit, { parent: 'observed:container', code: [{ scanner: 'fixture', file: 'src/part.ts' }] }),
  ])
  const grown = worldOf([
    box('system', 'system', unit, { children: ['observed:container'] }),
    box('container', 'container', unit, { parent: 'observed:system', children: ['observed:part', 'observed:other'] }),
    box('part', 'component', unit, { parent: 'observed:container', code: [{ scanner: 'fixture', file: 'src/part.ts' }] }),
    box('other', 'component', unit, { parent: 'observed:container', code: [{ scanner: 'fixture', file: 'src/other.ts' }] }),
    box('ext', 'system', unit, { external: true }),
    box('person', 'actor', unit),
  ], [uses('call', 'part', 'other'), uses('ask', 'person', 'part'), uses('send', 'other', 'ext')])
  assert.deepEqual(tweenSheet(small.sheet, structuredClone(small.sheet), 0.5), small.sheet)
  const middle = tweenSheet(small.sheet, grown.sheet, 0.5)
  assert.equal(middle.buildings.length, 4)
  assert.equal(middle.routes.length, 3)
  assert.ok(middle.slabs[0]!.rect.d > small.sheet.slabs[0]!.rect.d && middle.slabs[0]!.rect.d < grown.sheet.slabs[0]!.rect.d)
  // Surfaces growing out of nothing keep their label band, and every shape stays finite while tiny.
  const first = tweenSheet(worldOf([]).sheet, grown.sheet, 0.02)
  assert.ok(first.slabs[0]!.rect.d > labelBand(CONTAINER_FONT))
  assert.deepEqual(first.sheet, grown.sheet.sheet)
  const finite: number[] = []
  JSON.stringify(presentScene(first, undefined, NESTED_POSE), (_key, value) => { if (typeof value === 'number' && !Number.isFinite(value)) finite.push(value); return value })
  assert.deepEqual(finite, [])
})

test.concurrent('the motion blends towards a new sheet and follows faster updates at their pace', () => {
  const motion = createMapMotion(before)
  assert.equal(motion.sheet, before)
  assert.equal(motion.retarget(after, 1000, true), true)
  assert.ok(motion.morphing)
  assert.equal(motion.framing, 0)
  assert.equal(motion.step(1000 + MORPH_DURATION_MS / 2), true)
  const a = motion.sheet.buildings.find(item => item.id === 'a')!
  assert.ok(a.rect.gx > 6 && a.rect.gx < 12)
  assert.ok(motion.framing > 0 && motion.framing < 1)
  assert.equal(motion.step(1000 + MORPH_DURATION_MS), false)
  assert.equal(motion.sheet, after)
  assert.ok(!motion.morphing)
  assert.equal(motion.framing, 1)

  // A second update while the first still moves starts from the blend and takes the observed interval.
  const later = sheetOf([building('a', 30, 6)])
  motion.retarget(before, 2000, true)
  motion.step(2200)
  const shown = motion.sheet.buildings.find(item => item.id === 'a')!.rect.gx
  assert.ok(shown > 6 && shown < 12)
  motion.retarget(later, 2200, true)
  assert.equal(motion.sheet.buildings.find(item => item.id === 'a')!.rect.gx, shown)
  assert.equal(motion.step(2300), true)
  assert.equal(motion.step(2400), false)
  assert.equal(motion.sheet, later)

  // Updates faster than the floor are followed at the floor's pace.
  motion.retarget(before, 3000, true)
  motion.step(3050)
  motion.retarget(later, 3050, true)
  assert.equal(motion.step(3050 + MORPH_FASTEST_MS - 1), true)
  assert.equal(motion.step(3050 + MORPH_FASTEST_MS), false)
})

test.concurrent('reduced motion and an unchanged placement apply at once', () => {
  const motion = createMapMotion(before)
  assert.equal(motion.retarget(after, 0, false), false)
  assert.equal(motion.sheet, after)
  assert.equal(motion.retarget(structuredClone(after), 10, true), false)
  assert.ok(!motion.morphing)
})
