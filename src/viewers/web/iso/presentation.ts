import type { ProjectProfile } from '../../../project-profile.ts'
import type { SheetScene } from '../../../sheet/types.ts'
import type { LayerPose } from '../layers/orbit.ts'
import { EXPLODED_POSE, NESTED_POSE, OVERHEAD_POSE, ORBIT_DURATION_MS, PLAN_DURATION_MS, interpolatePose, orbitPose } from '../layers/orbit.ts'
import { sceneAtSeparation, type LayeredScene } from '../layers/separation.ts'
import { projectScene } from './project.ts'

export type MapView = 'iso' | '2d' | 'layers'

export interface MapMotion {
  readonly view: MapView
  readonly pose: LayerPose
  /** Progress for framing the plan transition, or one for ordinary layer motion. */
  readonly framing: number
  /** Every view moves through the displayed pose unless reduced motion is requested. */
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


/** Flatten a presentation copy; the sheet and its source evidence remain untouched. */
function flattenSheet(sheet: SheetScene, amount: number): SheetScene {
  if (amount === 0) return sheet
  const height = 1 - amount
  return {
    ...sheet,
    buildings: sheet.buildings.map(building => ({
      ...building,
      heightUnits: building.heightUnits * height,
      floors: amount === 1 ? building.kind !== 'component' ? [] : [{
        files: building.floors.flatMap(floor => floor.files),
        facadeFileType: building.floors[0]?.facadeFileType ?? '',
        heightUnits: 0,
        footprint: { w: building.rect.w, d: building.rect.d },
      }] : building.floors.map(floor => ({
        ...floor,
        heightUnits: floor.heightUnits * height,
        footprint: {
          w: floor.footprint.w + (building.rect.w - floor.footprint.w) * amount,
          d: floor.footprint.d + (building.rect.d - floor.footprint.d) * amount,
        },
      })),
    })),
  }
}

/** Geometry follows the displayed pose, even while the selected destination is another view. */
export function presentScene(sheet: SheetScene, profile: ProjectProfile | undefined, pose: LayerPose): LayeredScene {
  const projected = projectScene(flattenSheet(sheet, pose.flatten), profile, pose)
  if (pose.flatten === 1) {
    projected.slabs = projected.slabs.map(item => ({ ...item, faces: item.faces.filter(face => face.side === 'top') }))
    projected.buildings = projected.buildings.map(item => ({
      ...item, floors: item.floors.map(floor => floor.filter(face => face.side === 'top')),
    }))
  }
  return sceneAtSeparation(projected, pose.separation)
}

/** Presentation owns its view, the nested view F2 returns to, and the orbit pose. */
export function createMapMotion(): MapMotion {
  let view: MapView = 'iso'
  let nested: Exclude<MapView, 'layers'> = 'iso'
  let pose = NESTED_POSE
  let framing = 1
  let transition: { from: LayerPose; to: LayerPose; started: number; duration: number } | undefined

  function choose(next: MapView, now: number, animate: boolean): boolean {
    if (next === view) return transition !== undefined
    view = next
    if (next !== 'layers') nested = next
    const target = next === 'layers' ? EXPLODED_POSE : next === '2d' ? OVERHEAD_POSE : NESTED_POSE
    if (!animate) {
      framing = 1
      pose = target
      transition = undefined
      return false
    }
    framing = pose.flatten !== target.flatten ? 0 : 1
    transition = { from: pose, to: target, started: now, duration: pose.flatten !== target.flatten ? PLAN_DURATION_MS : ORBIT_DURATION_MS }
    return true
  }

  return {
    get view() {
      return view
    },
    get pose() {
      return pose
    },
    get framing() { return framing },
    choose,
    toggleLayers(now, animate) {
      return choose(view === 'layers' ? nested : 'layers', now, animate)
    },
    step(now) {
      if (transition === undefined) return false
      const progress = (now - transition.started) / transition.duration
      pose = interpolatePose(transition.from, transition.to, progress)
      const flattening = transition.to.flatten - transition.from.flatten
      framing = flattening === 0 ? 1 : (pose.flatten - transition.from.flatten) / flattening
      if (progress < 1) return true
      transition = undefined
      return false
    },
    orbit(dx, dy) {
      if (view !== 'layers') return
      transition = undefined
      framing = 1
      pose = orbitPose({ ...pose, separation: 1, flatten: 0 }, dx, dy)
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
