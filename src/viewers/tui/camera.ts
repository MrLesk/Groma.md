import type { MapCamera } from '../../types.ts'

const CAMERA_TWEEN_MS = 750

interface Tween {
  fromLog: number
  toLog: number
  fromCenterX: number
  toCenterX: number
  fromCenterY: number
  toCenterY: number
  duration: number
  elapsed: number
}

interface LiveCamera extends MapCamera {
  snapTo(target: MapCamera): void
  startTween(target: MapCamera, duration?: number): void
  isAnimating(): boolean
  update(dt: number): boolean
}

export function createCamera(start: MapCamera): LiveCamera {
  let tween: Tween | null = null
  const camera: LiveCamera = {
    zoom: start.zoom,
    centerX: start.centerX,
    centerY: start.centerY,

    snapTo(target) {
      tween = null
      camera.zoom = target.zoom
      camera.centerX = target.centerX
      camera.centerY = target.centerY
    },

    startTween(target, duration = CAMERA_TWEEN_MS) {
      tween = {
        fromLog: Math.log(camera.zoom),
        toLog: Math.log(target.zoom),
        fromCenterX: camera.centerX,
        toCenterX: target.centerX,
        fromCenterY: camera.centerY,
        toCenterY: target.centerY,
        duration,
        elapsed: 0,
      }
    },

    isAnimating() {
      return tween !== null
    },

    update(dt) {
      if (!tween) return false

      tween.elapsed += dt
      const t = Math.min(1, tween.elapsed / tween.duration)
      const eased = easeInOutCubic(t)
      camera.zoom = Math.exp(tween.fromLog + (tween.toLog - tween.fromLog) * eased)
      camera.centerX = tween.fromCenterX
        + (tween.toCenterX - tween.fromCenterX) * eased
      camera.centerY = tween.fromCenterY
        + (tween.toCenterY - tween.fromCenterY) * eased
      if (t >= 1) tween = null
      return true
    },
  }

  return camera
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2
}
