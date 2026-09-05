import type { ArchitectureGraph, Bounds, Point } from '../../../types.ts'
import { ancestorIds, parentOfElements } from '../../relationship-text.ts'
import type { LayeredScene } from '../layers/separation.ts'
import { boundsOf } from './project.ts'
import type { ProjectedScene } from './project.ts'

/** Screen = world · k + (x, y); the same camera transform owns pan and zoom. */
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
/** Automatic focus stops at the map's normal label size. Larger selections still zoom out to fit. */
const FOCUS_ZOOM_MAX = 1
/** Screen pixels kept free around the fitted sheet. */
const FIT_MARGIN = 24
/** Screen pixels around focused elements, leaving their highlighted context readable. */
const CONTEXT_MARGIN = 120
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

function bodyPoints(scene: ProjectedScene, wanted: ReadonlySet<string>): Point[] {
  return [
    ...scene.islands
      .filter(item => item.island.element !== null && wanted.has(item.island.element.representationId))
      .flatMap(item => item.polygon),
    ...scene.slabs
      .filter(item => wanted.has(item.slab.representationId))
      .flatMap(item => item.faces.flatMap(face => face.points)),
    ...scene.buildings
      .filter(item => wanted.has(item.building.representationId))
      .flatMap(item => item.floors.flatMap(floor => floor.flatMap(face => face.points))),
  ]
}

function fitPoints(
  points: readonly Point[],
  viewport: Viewport,
  maxZoom: number,
): Camera | undefined {
  if (points.length === 0) return undefined
  const margin = Math.min(CONTEXT_MARGIN, viewport.width / 4, viewport.height / 4)
  return fittedCamera(boundsOf(points), viewport, maxZoom, margin)
}

/** Fits selected elements with their contents, or explicit routes with their endpoints. */
export function fitArchitecture(
  scene: LayeredScene,
  world: ArchitectureGraph,
  ids: readonly string[],
  viewport: Viewport,
): Camera | undefined {
  const wanted = new Set(ids)
  const routes = scene.routes.filter(item => wanted.has(item.route.id))
  for (const { route } of routes) {
    wanted.add(route.source)
    wanted.add(route.target)
  }
  const parentOf = parentOfElements(world.elements)
  const bodies = new Set(world.elements
    .filter(element => ancestorIds(element.representationId, parentOf).some(id => wanted.has(id)))
    .map(element => element.representationId))
  return fitPoints([
    ...bodyPoints(scene, bodies),
    ...routes.flatMap(item => [...item.points, ...item.lifts.flatMap(lift => [lift.from, lift.to])]),
  ], viewport, FOCUS_ZOOM_MAX)
}

/** Fits identified bodies and the highlighted routes leaving them; missing ids do not affect the camera. */
export function fitHighlights(
  scene: ProjectedScene,
  ids: readonly string[],
  viewport: Viewport,
  maxZoom: number,
): Camera | undefined {
  const wanted = new Set(ids)
  return fitPoints([
    ...bodyPoints(scene, wanted),
    ...scene.routes
      .filter(item => wanted.has(item.route.source))
      .flatMap(item => item.points),
  ], viewport, maxZoom)
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

/** Percent relative to the fitted view; empty while fitted. */
export function zoomReadout(camera: Camera, fit: Camera): string {
  const percent = Math.round((camera.k / fit.k) * 100)
  return percent === 100 ? '' : `${percent}%`
}

export type KeyTarget = 'hierarchy' | 'control' | 'text' | 'other'

export function keyTarget(target: EventTarget | null): KeyTarget {
  if (!(target instanceof Element)) return 'other'
  if (target.closest('input, textarea, [contenteditable]')) return 'text'
  if (target.closest('#tree')) return 'hierarchy'
  if (target.closest('button, select')) return 'control'
  return 'other'
}

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
