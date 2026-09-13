import type { ProjectProfile } from '../../../project-profile.ts'
import type { SheetScene } from '../../../sheet/types.ts'
import type { LayerPose } from '../layers/orbit.ts'
import { EXPLODED_POSE, NESTED_POSE, OVERHEAD_POSE, ORBIT_DURATION_MS, interpolatePose, orbitPose } from '../layers/orbit.ts'
import { sceneAtSeparation, type LayeredScene } from '../layers/separation.ts'
import { projectScene } from './project.ts'

export type MapView = 'iso' | '2d' | 'layers'

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


/** One footprint per element in plan view; the composed sheet and its source evidence remain untouched. */
function overhead(sheet: SheetScene, profile: ProjectProfile | undefined): LayeredScene {
  const flat: SheetScene = {
    ...sheet,
    buildings: sheet.buildings.map(building => ({
      ...building,
      heightUnits: 0,
      floors: building.kind !== 'component' ? [] : [{
        files: building.floors.flatMap(floor => floor.files),
        facadeFileType: building.floors[0]?.facadeFileType ?? '',
        heightUnits: 0,
        footprint: { w: building.rect.w, d: building.rect.d },
      }],
    })),
  }
  const projected = projectScene(flat, profile, OVERHEAD_POSE)
  return sceneAtSeparation({
    ...projected,
    slabs: projected.slabs.map(item => ({ ...item, faces: item.faces.filter(face => face.side === 'top') })),
    buildings: projected.buildings.map(item => ({
      ...item, floors: item.floors.map(floor => floor.filter(face => face.side === 'top')),
    })),
  }, 0)
}

/** Every view projects the same layout, identities and directed routes. */
export function presentScene(
  sheet: SheetScene,
  profile: ProjectProfile | undefined,
  view: MapView,
  pose: LayerPose,
): LayeredScene {
  return view === '2d'
    ? overhead(sheet, profile)
    : sceneAtSeparation(projectScene(sheet, profile, pose), pose.separation)
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
