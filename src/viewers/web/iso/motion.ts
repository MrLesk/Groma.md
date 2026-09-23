import type { Camera } from './camera.ts'

export const CAMERA_DURATION_MS = 220

/** One displayed camera and one destination; new navigation starts where the last frame left off. */
export function createCameraMotion(initial: Camera) {
  let current = initial
  let target = initial
  let framingFrom = initial
  let transition: { from: Camera; started: number } | undefined
  return {
    get current() { return current },
    get target() { return target },
    move(to: Camera, now: number, animate: boolean) {
      target = to
      transition = animate ? { from: current, started: now } : undefined
      if (!animate) current = to
    },
    /** Follow changing projected bounds on the same clock as the spatial transition. */
    frame(to: Camera, amount: number) {
      if (amount === 0) framingFrom = current
      target = to
      transition = undefined
      current = amount === 1 ? to : {
        k: framingFrom.k + (to.k - framingFrom.k) * amount,
        x: framingFrom.x + (to.x - framingFrom.x) * amount,
        y: framingFrom.y + (to.y - framingFrom.y) * amount,
      }
    },
    step(now: number): boolean {
      if (transition === undefined) return false
      const progress = Math.min(1, Math.max(0, (now - transition.started) / CAMERA_DURATION_MS))
      const amount = 1 - (1 - progress) ** 3
      const { from } = transition
      current = {
        k: from.k + (target.k - from.k) * amount,
        x: from.x + (target.x - from.x) * amount,
        y: from.y + (target.y - from.y) * amount,
      }
      if (progress < 1) return true
      current = target
      transition = undefined
      return false
    },
  }
}

/** Camera frames share the same paint callback as direct gestures and respect reduced motion. */
export function createCameraAnimator(initial: Camera, paint: () => void) {
  const motion = createCameraMotion(initial)
  let frame: number | undefined
  const stopFrame = (): void => {
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = undefined
  }
  const tick = (now: number): void => {
    frame = undefined
    const moving = motion.step(now)
    paint()
    if (moving) frame = requestAnimationFrame(tick)
  }
  return {
    get current() { return motion.current },
    get target() { return motion.target },
    frame(to: Camera, amount: number) {
      stopFrame()
      motion.frame(to, amount)
      frame = requestAnimationFrame(tick)
    },
    move(to: Camera, animate = true) {
      stopFrame()
      motion.move(to, performance.now(), animate && !matchMedia('(prefers-reduced-motion: reduce)').matches)
      frame = requestAnimationFrame(tick)
    },
  }
}
