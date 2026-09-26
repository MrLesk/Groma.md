import assert from 'node:assert/strict'
import { test } from 'bun:test'

import type { SheetScene } from '../src/sheet/types.ts'
import { MORPH_DURATION_MS } from '../src/viewers/web/iso/view-motion/morph.ts'
import { createMapAnimator, createMapMotion } from '../src/viewers/web/iso/view-motion/presentation.ts'

// Like web-camera-layer.test.ts, these browser stubs are isolated by bun test --parallel.
// Each requested frame owns its timer and arrives after the transition deadline, without a real 700 ms wait.
Object.assign(globalThis, {
  requestAnimationFrame: (frame: FrameRequestCallback) => setTimeout(() => frame(performance.now() + MORPH_DURATION_MS), 0),
  cancelAnimationFrame: (frame: ReturnType<typeof setTimeout>) => clearTimeout(frame),
  matchMedia: () => ({ matches: false }),
})

function sheet(width: number): SheetScene {
  return {
    sheet: { gx: 0, gy: 0, w: width, d: 20 },
    islands: [{ key: 'system', kind: 'system', name: 'System', element: null, rect: { gx: 0, gy: 0, w: width, d: 20 } }],
    zones: [], slabs: [], buildings: [], routes: [],
  }
}

test.concurrent('orbiting a partly updated map keeps its finishing frame', async () => {
  const motion = createMapMotion(sheet(20))
  motion.choose('layers', 0, false)
  const painted = Promise.withResolvers<boolean>()
  const animator = createMapAnimator(motion, painted.resolve)
  const destination = sheet(40)
  animator.retarget(destination)
  motion.step(performance.now() + MORPH_DURATION_MS / 2)
  assert.ok(motion.sheet.sheet.w > 20 && motion.sheet.sheet.w < 40)

  const pose = motion.pose
  animator.orbit(10, 5)
  assert.notDeepEqual(motion.pose, pose)
  await painted.promise
  assert.equal(motion.sheet, destination)
  assert.equal(motion.morphing, false)
})

test.concurrent('orbiting without a world update still repaints the changed pose', async () => {
  const motion = createMapMotion(sheet(20))
  motion.choose('layers', 0, false)
  const pose = motion.pose
  const painted = Promise.withResolvers<boolean>()
  const animator = createMapAnimator(motion, painted.resolve)
  animator.orbit(10, 5)
  assert.equal(await painted.promise, false)
  assert.notDeepEqual(motion.pose, pose)
})
