import { DEFAULT_PROJECTION } from '../iso/project.ts'
import type { ProjectionView } from '../iso/project.ts'

export interface LayerPose extends ProjectionView {
  /** Zero is the nested map; one is the fully separated stack. */
  separation: number
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
