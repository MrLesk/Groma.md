import type { Bounds, Point } from '../../../types.ts'
import type { ProjectedScene } from './project.ts'

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
/** Screen pixels around focused elements, leaving their highlighted context readable. */
const CONTEXT_MARGIN = 72
/** One wheel notch of 100 units zooms by about 16 %. */
const WHEEL_RATE = 0.0015
/** A trackpad pinch arrives as ctrl+wheel whose delta is the percent change, so this rate follows the fingers. */
const PINCH_RATE = 0.01

function fittedCamera(bounds: Bounds, viewport: Viewport, maxZoom: number, margin: number): Camera {
  const width = Math.max(viewport.width, 1)
  const height = Math.max(viewport.height, 1)
  const k = Math.min(
    maxZoom,
    (width - 2 * margin) / Math.max(bounds.width, 1),
    (height - 2 * margin) / Math.max(bounds.height, 1),
  )
  return {
    k,
    x: (width - k * bounds.width) / 2 - k * bounds.x,
    y: (height - k * bounds.height) / 2 - k * bounds.y,
  }
}

/** The camera that shows every projected point with the sheet margin, centred. */
export function fitCamera(bounds: Bounds, viewport: Viewport): Camera {
  return fittedCamera(bounds, viewport, Infinity, FIT_MARGIN)
}

/** Fits identified bodies and the highlighted routes leaving them; missing ids do not affect the camera. */
export function fitHighlights(
  scene: ProjectedScene,
  ids: readonly string[],
  viewport: Viewport,
  maxZoom: number,
): Camera | undefined {
  const wanted = new Set(ids)
  const points = [
    ...scene.islands
      .filter(item => item.island.element !== null && wanted.has(item.island.element.representationId))
      .flatMap(item => item.polygon),
    ...scene.slabs
      .filter(item => wanted.has(item.slab.representationId))
      .flatMap(item => item.faces.flatMap(face => face.points)),
    ...scene.buildings
      .filter(item => wanted.has(item.building.representationId))
      .flatMap(item => item.tiers.flatMap(tier => tier.flatMap(face => face.points))),
    ...scene.routes
      .filter(item => wanted.has(item.route.source))
      .flatMap(item => item.points),
  ]
  if (points.length === 0) return undefined
  const xs = points.map(point => point.x)
  const ys = points.map(point => point.y)
  return fittedCamera({
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  }, viewport, maxZoom, CONTEXT_MARGIN)
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

/** Two fingers on a trackpad, or the wheel, pan; a pinch (which arrives as ctrl+wheel) and cmd or ctrl with the wheel zoom. */
export function wheelAction(
  event: { deltaX: number; deltaY: number; ctrlKey: boolean; metaKey: boolean },
): { kind: 'pan'; dx: number; dy: number } | { kind: 'zoom'; factor: number } {
  if (event.ctrlKey || event.metaKey) {
    return { kind: 'zoom', factor: Math.exp(-event.deltaY * (event.ctrlKey ? PINCH_RATE : WHEEL_RATE)) }
  }
  return { kind: 'pan', dx: -event.deltaX, dy: -event.deltaY }
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

/** Map keys, leaving text fields alone. */
export function keyAction(
  key: string,
  target: KeyTarget,
): 'in' | 'out' | 'fit' | 'deselect' | undefined {
  if (target === 'text') return undefined
  if (key === '+' || key === '=') return 'in'
  if (key === '-' || key === '_') return 'out'
  if (key === '0') return 'fit'
  if (key === 'Escape') return 'deselect'
  return undefined
}
