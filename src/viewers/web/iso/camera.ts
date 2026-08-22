import type { Bounds, Point } from '../../../types.ts'

/** Screen = world · k + (x, y); applied as one CSS transform on the camera group. */
export interface Camera {
  k: number
  x: number
  y: number
}

export interface Viewport {
  width: number
  height: number
}

/** Closest zoom: one cell is 192 px wide, names read easily. */
const ZOOM_MAX = 4
/** Screen pixels kept free around the fitted sheet. */
const FIT_MARGIN = 24
/** One wheel notch of 100 units zooms by about 16 %. */
const WHEEL_RATE = 0.0015

/** The camera that shows every projected point with a margin, centred. */
export function fitCamera(bounds: Bounds, viewport: Viewport): Camera {
  const width = Math.max(viewport.width, 1)
  const height = Math.max(viewport.height, 1)
  const k = Math.min(
    (width - 2 * FIT_MARGIN) / Math.max(bounds.width, 1),
    (height - 2 * FIT_MARGIN) / Math.max(bounds.height, 1),
  )
  return {
    k,
    x: (width - k * bounds.width) / 2 - k * bounds.x,
    y: (height - k * bounds.height) / 2 - k * bounds.y,
  }
}

/** Zoom stays between half the fitted view and the closest zoom. */
export function zoomLimits(fit: Camera): { min: number; max: number } {
  return { min: fit.k / 2, max: Math.max(ZOOM_MAX, fit.k) }
}

/** Zooms so the world point under `anchor` (in viewport pixels) stays put. */
export function zoomAbout(camera: Camera, factor: number, anchor: Point, fit: Camera): Camera {
  const limits = zoomLimits(fit)
  const k = Math.min(limits.max, Math.max(limits.min, camera.k * factor))
  const ratio = k / camera.k
  return {
    k,
    x: anchor.x - (anchor.x - camera.x) * ratio,
    y: anchor.y - (anchor.y - camera.y) * ratio,
  }
}

export function pan(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, x: camera.x + dx, y: camera.y + dy }
}

/** Keeps the same world point in the centre when the viewport changes size. */
export function resized(camera: Camera, from: Viewport, to: Viewport): Camera {
  return pan(camera, (to.width - from.width) / 2, (to.height - from.height) / 2)
}

export function wheelFactor(deltaY: number): number {
  return Math.exp(-deltaY * WHEEL_RATE)
}

export function cameraTransform(camera: Camera): string {
  return `translate(${camera.x.toFixed(2)}px, ${camera.y.toFixed(2)}px) scale(${camera.k.toFixed(4)})`
}

/** Percent relative to the fitted view; empty while fitted. */
export function zoomReadout(camera: Camera, fit: Camera): string {
  const percent = Math.round((camera.k / fit.k) * 100)
  return percent === 100 ? '' : `${percent}%`
}

export type KeyTarget = 'hierarchy' | 'control' | 'text' | 'other'

/** Map keys, leaving text fields alone and `x` to the panes when they have focus. */
export function keyAction(key: string, target: KeyTarget): 'in' | 'out' | 'fit' | 'clear' | undefined {
  if (target === 'text') return undefined
  if (key === '+' || key === '=') return 'in'
  if (key === '-' || key === '_') return 'out'
  if (key === '0') return 'fit'
  if ((key === 'x' || key === 'X') && target === 'other') return 'clear'
  return undefined
}
