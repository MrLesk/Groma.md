import { DEFAULT_PROJECTION } from '../iso/project.ts'
import type { ProjectionView } from '../iso/project.ts'

export type MapView = 'iso' | '2d' | 'layers'

export interface LayerPose extends ProjectionView {
  /** Zero is the nested map; one is the fully separated stack. */
  separation: number
}

export interface MapMotion {
  readonly view: MapView
  readonly pose: LayerPose
  /** Overhead switches are immediate; isometric Layers transitions may animate. */
  choose(view: MapView, now: number, animate: boolean): boolean
  toggleLayers(now: number, animate: boolean): boolean
  /** Advances the current transition and reports whether another frame is needed. */
  step(now: number): boolean
  /** Cancels entrance motion and orbits the fully separated stack. */
  orbit(dx: number, dy: number): void
}

export interface MapAnimator {
  choose(view: MapView): void
  toggleLayers(): void
  orbit(dx: number, dy: number): void
}

export const NESTED_POSE: LayerPose = { ...DEFAULT_PROJECTION, separation: 0 }
export const OVERHEAD_POSE: LayerPose = { yaw: 0, pitch: 90, separation: 0 }
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

/** Presentation owns its view, the nested view F2 returns to, and the orbit pose. */
export function createMapMotion(): MapMotion {
  let view: MapView = 'iso'
  let nested: Exclude<MapView, 'layers'> = 'iso'
  let pose = NESTED_POSE
  let transition: { from: LayerPose; to: LayerPose; started: number } | undefined

  function choose(next: MapView, now: number, animate: boolean): boolean {
    if (next === view) return transition !== undefined
    const overhead = next === '2d' || view === '2d'
    view = next
    if (next !== 'layers') nested = next
    const target = next === 'layers' ? EXPLODED_POSE : next === '2d' ? OVERHEAD_POSE : NESTED_POSE
    if (!animate || overhead) {
      pose = target
      transition = undefined
      return false
    }
    transition = { from: pose, to: target, started: now }
    return true
  }

  return {
    get view() {
      return view
    },
    get pose() {
      return pose
    },
    choose,
    toggleLayers(now, animate) {
      return choose(view === 'layers' ? nested : 'layers', now, animate)
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
      if (view !== 'layers') return
      transition = undefined
      pose = orbitPose({ ...pose, separation: 1 }, dx, dy)
    },
  }
}

/** Browser frame scheduling for the pure layer motion state. */
export function createMapAnimator(motion: MapMotion, repaint: (fit: boolean) => void): MapAnimator {
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
  const change = (apply: (now: number, animate: boolean) => boolean): void => {
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = undefined
    animating = apply(performance.now(), !matchMedia('(prefers-reduced-motion: reduce)').matches)
    repaint(true)
    if (animating) frame = requestAnimationFrame(animate)
  }

  return {
    choose: view => { if (view !== motion.view) change((now, animate) => motion.choose(view, now, animate)) },
    toggleLayers: () => change(motion.toggleLayers),
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
