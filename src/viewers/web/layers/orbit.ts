import { DEFAULT_PROJECTION } from '../iso/project.ts'
import type { ProjectionView } from '../iso/project.ts'

export interface LayerPose extends ProjectionView {
  /** Zero is the nested map; one is the fully separated stack. */
  separation: number
}

export interface LayerMotion {
  readonly active: boolean
  readonly pose: LayerPose
  /** Starts the F2 transition and reports whether animation frames are needed. */
  toggle(now: number, animate: boolean): boolean
  /** Advances the current transition and reports whether another frame is needed. */
  step(now: number): boolean
  /** Cancels entrance motion and orbits the fully separated stack. */
  orbit(dx: number, dy: number): void
}

export interface LayerAnimator {
  toggle(): void
  orbit(dx: number, dy: number): void
}

export const NESTED_POSE: LayerPose = { ...DEFAULT_PROJECTION, separation: 0 }
export const EXPLODED_POSE: LayerPose = { yaw: 57, pitch: 36, separation: 1 }
export const ORBIT_DURATION_MS = 650

const MIN_PITCH = 18
const MAX_PITCH = 58
const YAW_PER_PIXEL = 0.28
const PITCH_PER_PIXEL = 0.18

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function wrapYaw(yaw: number): number {
  return ((yaw % 360) + 360) % 360
}

/** Takes the short way around the 360-degree seam. */
function yawDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180
}

function ease(progress: number): number {
  const bounded = clamp(progress, 0, 1)
  return 1 - (1 - bounded) ** 3
}

export function interpolatePose(from: LayerPose, to: LayerPose, progress: number): LayerPose {
  const amount = ease(progress)
  return {
    yaw: wrapYaw(from.yaw + yawDelta(from.yaw, to.yaw) * amount),
    pitch: from.pitch + (to.pitch - from.pitch) * amount,
    separation: from.separation + (to.separation - from.separation) * amount,
  }
}

export function orbitPose(pose: LayerPose, dx: number, dy: number): LayerPose {
  return {
    ...pose,
    yaw: wrapYaw(pose.yaw + dx * YAW_PER_PIXEL),
    pitch: clamp(pose.pitch - dy * PITCH_PER_PIXEL, MIN_PITCH, MAX_PITCH),
  }
}

/** One authority for layer-mode activation, entrance motion, and orbit pose. */
export function createLayerMotion(): LayerMotion {
  let active = false
  let pose = NESTED_POSE
  let transition: { from: LayerPose; to: LayerPose; started: number } | undefined

  return {
    get active() {
      return active
    },
    get pose() {
      return pose
    },
    toggle(now, animate) {
      active = !active
      const target = active ? EXPLODED_POSE : NESTED_POSE
      if (!animate) {
        pose = target
        transition = undefined
        return false
      }
      transition = { from: pose, to: target, started: now }
      return true
    },
    step(now) {
      if (transition === undefined) return false
      const progress = (now - transition.started) / ORBIT_DURATION_MS
      pose = interpolatePose(transition.from, transition.to, progress)
      if (progress < 1) return true
      transition = undefined
      return false
    },
    orbit(dx, dy) {
      if (!active) return
      transition = undefined
      pose = orbitPose({ ...pose, separation: 1 }, dx, dy)
    },
  }
}

/** Browser frame scheduling for the pure layer motion state. */
export function createLayerAnimator(motion: LayerMotion, repaint: (fit: boolean) => void): LayerAnimator {
  let frame: number | undefined
  let animating = false

  const stopAnimation = (): void => {
    if (!animating) return
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = undefined
    animating = false
  }
  const animate = (now: number): void => {
    frame = undefined
    animating = motion.step(now)
    repaint(true)
    if (animating) frame = requestAnimationFrame(animate)
  }

  return {
    toggle() {
      if (frame !== undefined) cancelAnimationFrame(frame)
      frame = undefined
      animating = motion.toggle(
        performance.now(),
        !matchMedia('(prefers-reduced-motion: reduce)').matches,
      )
      if (animating) frame = requestAnimationFrame(animate)
      else repaint(true)
    },
    orbit(dx, dy) {
      stopAnimation()
      motion.orbit(dx, dy)
      if (frame !== undefined) return
      frame = requestAnimationFrame(() => {
        frame = undefined
        repaint(false)
      })
    },
  }
}
