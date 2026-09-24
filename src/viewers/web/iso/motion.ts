import type { Point } from '../../../types.ts'
import { type Camera, pan } from './camera.ts'

export const CAMERA_DURATION_MS = 220
/** A released drag's glide loses 63% of its speed every half second, close to macOS trackpad momentum. */
const GLIDE_TIME_CONSTANT_MS = 500
/** The glide stops once it is slower than this many screen pixels per millisecond. */
const GLIDE_STOP_SPEED = 0.02

interface Glide {
  from: Camera
  /** Screen pixels per millisecond at release. */
  velocity: Point
  started: number
}

/** One displayed camera and one destination; new navigation starts where the last frame left off. */
export function createCameraMotion(initial: Camera) {
  let current = initial
  let target = initial
  let framingFrom = initial
  let transition: { from: Camera; started: number } | undefined
  let glide: Glide | undefined

  /** The speed decays exponentially and the distance is its exact integral, so the frame rate never changes how far a glide goes. */
  const glideStep = (now: number, { from, velocity, started }: Glide): boolean => {
    const duration = GLIDE_TIME_CONSTANT_MS * Math.log(Math.hypot(velocity.x, velocity.y) / GLIDE_STOP_SPEED)
    const elapsed = Math.max(0, Math.min(now - started, duration))
    const fullSpeedMs = GLIDE_TIME_CONSTANT_MS * (1 - Math.exp(-elapsed / GLIDE_TIME_CONSTANT_MS))
    current = pan(from, velocity.x * fullSpeedMs, velocity.y * fullSpeedMs)
    target = current
    if (elapsed < duration) return true
    glide = undefined
    return false
  }

  return {
    get current() { return current },
    get target() { return target },
    move(to: Camera, now: number, animate: boolean) {
      glide = undefined
      target = to
      transition = animate ? { from: current, started: now } : undefined
      if (!animate) current = to
    },
    /** Follow changing projected bounds on the same clock as the spatial transition. */
    frame(to: Camera, amount: number) {
      glide = undefined
      if (amount === 0) framingFrom = current
      target = to
      transition = undefined
      current = amount === 1 ? to : {
        k: framingFrom.k + (to.k - framingFrom.k) * amount,
        x: framingFrom.x + (to.x - framingFrom.x) * amount,
        y: framingFrom.y + (to.y - framingFrom.y) * amount,
      }
    },
    /** Carries the camera on at a released drag's velocity until it slows to a stop; any move or frame replaces it. */
    glide(velocity: Point, now: number) {
      transition = undefined
      glide = { from: current, velocity, started: now }
    },
    step(now: number): boolean {
      if (glide !== undefined) return glideStep(now, glide)
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

/**
 * Camera frames share the same paint callback as direct gestures and respect reduced motion. Navigation announces its
 * destination through `approach` before it moves; direct gestures never do, or a pinch would redraw the map every frame.
 */
export function createCameraAnimator(initial: Camera, paint: () => void, approach: (destination: Camera) => void) {
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
  const move = (to: Camera, animate = true): void => {
    stopFrame()
    if (animate) approach(to)
    motion.move(to, performance.now(), animate && !matchMedia('(prefers-reduced-motion: reduce)').matches)
    frame = requestAnimationFrame(tick)
  }
  return {
    get current() { return motion.current },
    get target() { return motion.target },
    frame(to: Camera, amount: number) {
      stopFrame()
      motion.frame(to, amount)
      frame = requestAnimationFrame(tick)
    },
    move,
    /** Stops a transition or glide where the camera is shown now. */
    hold: () => move(motion.current, false),
    /** Reduced motion leaves the camera where the drag left it. */
    glide(velocity: Point) {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
      stopFrame()
      motion.glide(velocity, performance.now())
      frame = requestAnimationFrame(tick)
    },
  }
}
