import { expect, test } from 'bun:test'
import { CAMERA_DURATION_MS, createCameraMotion } from '../src/viewers/web/iso/motion.ts'

test.concurrent('camera navigation interpolates position and zoom together and ends at the exact destination', () => {
  const start = { x: 0, y: 200, k: 0.2 }
  const target = { x: 400, y: -100, k: 1 }
  const motion = createCameraMotion(start)
  motion.move(target, 0, true)
  expect(motion.current).toEqual(start)
  expect(motion.step(CAMERA_DURATION_MS / 2)).toBe(true)
  expect(motion.current.x).toBeGreaterThan(start.x)
  expect(motion.current.x).toBeLessThan(target.x)
  const progress = (motion.current.x - start.x) / (target.x - start.x)
  expect(motion.current.y).toBeCloseTo(start.y + (target.y - start.y) * progress)
  expect(motion.current.k).toBeCloseTo(start.k + (target.k - start.k) * progress)
  expect(motion.step(CAMERA_DURATION_MS)).toBe(false)
  expect(motion.current).toEqual(target)
  expect(motion.step(CAMERA_DURATION_MS * 2)).toBe(false)
  expect(start).toEqual({ x: 0, y: 200, k: 0.2 })
})

test.concurrent('new navigation starts from the displayed position instead of the unfinished destination', () => {
  const motion = createCameraMotion({ x: 0, y: 0, k: 0.2 })
  motion.move({ x: 500, y: -200, k: 1 }, 0, true)
  motion.step(80)
  const displayed = motion.current
  const next = { x: -300, y: 100, k: 0.5 }
  motion.move(next, 80, true)
  expect(motion.current).toEqual(displayed)
  motion.step(80)
  expect(motion.current).toEqual(displayed)
  motion.step(80 + CAMERA_DURATION_MS)
  expect(motion.current).toEqual(next)
})

test.concurrent('direct gestures or reduced motion replace and cancel an animated destination', () => {
  const motion = createCameraMotion({ x: 0, y: 0, k: 0.2 })
  motion.move({ x: 500, y: -200, k: 1 }, 0, true)
  motion.step(80)
  const direct = { ...motion.current, x: motion.current.x + 30 }
  motion.move(direct, 80, false)
  expect(motion.current).toEqual(direct)
  expect(motion.target).toEqual(direct)
  expect(motion.step(CAMERA_DURATION_MS * 2)).toBe(false)
  expect(motion.current).toEqual(direct)
})

test.concurrent('spatial framing starts at the displayed camera and follows the moving projected bounds', () => {
  const initial = { x: 20, y: 30, k: 1 }
  const motion = createCameraMotion(initial)
  const target = { x: -80, y: -50, k: 2 }
  motion.frame(target, 0)
  expect(motion.current).toEqual(initial)
  motion.frame(target, 0.5)
  expect(motion.current).toEqual({ x: -30, y: -10, k: 1.5 })
  const interrupted = { ...motion.current }
  const next = { x: 60, y: 90, k: 0.5 }
  motion.frame(next, 0)
  expect(motion.current).toEqual(interrupted)
  motion.frame(next, 1)
  expect(motion.current).toEqual(next)
  expect(motion.step(1000)).toBe(false)
})
