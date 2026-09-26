import type { Bounds, Point } from '../../../../types.ts'
import type { MapFrame } from '../../chrome/frame.ts'
import { fitCamera, pan, zoomAbout, zoomReadout, type Camera } from './camera.ts'
import { createCameraAnimator } from './motion.ts'

export interface CameraSessionOptions {
  /** The frame the visible chrome leaves for the map now. */
  frame(): MapFrame
  /** The projected scene the fit shows. */
  bounds(): Bounds
  /** Comparison views fit their changed components using the existing highlight camera. */
  focus?(frame: MapFrame, fitted: Camera): Camera | undefined
  /** Draws the map at a camera and its zoom relative to the fit; true when the drawing scale changed. */
  move(camera: Camera, zoom: number): boolean
  /** Announces where a navigation is going before it animates there. */
  approach(camera: Camera, zoom: number): void
  /** Shows the zoom relative to the fit. */
  readout: HTMLElement
  /** The map pane whose resizes refit or recentre the camera. */
  host: HTMLElement
}

/** The page's map camera: its fit to the frame the chrome leaves, the viewer's own moves, and the zoom readout. */
export function createCameraSession(options: CameraSessionOptions) {
  const fitTo = (frame: MapFrame): Camera => pan(fitCamera(options.bounds(), frame), frame.x, frame.y)
  const focused = (frame: MapFrame, fitted: Camera): Camera => {
    const next = options.focus?.(frame, fitted)
    return next === undefined ? fitted : pan(next, frame.x, frame.y)
  }
  let fitted = fitTo(options.frame())
  /** Once an interaction positions the camera, live refits stop until the viewer presses 0. */
  let touched = false
  const zoom = (view: Camera): number => view.k / fitted.k
  const animator = createCameraAnimator(focused(options.frame(), fitted), paint, to => options.approach(to, zoom(to)))
  function paint(): void {
    const current = animator.current
    if (options.move(current, zoom(current))) options.readout.textContent = zoomReadout(current, fitted) || '100%'
  }
  const refit = (): void => {
    fitted = fitTo(options.frame())
    animator.navigate(focused(options.frame(), fitted))
    touched = false
  }

  // A resize refits an untouched camera; a moved one keeps the same point in the centre of the frame.
  let last = options.frame()
  new ResizeObserver(() => {
    const next = options.frame()
    if (touched) {
      animator.navigate(pan(
        animator.target,
        next.x + next.width / 2 - last.x - last.width / 2,
        next.y + next.height / 2 - last.y - last.height / 2,
      ))
      fitted = fitTo(next)
    } else refit()
    last = next
  }).observe(options.host)

  return {
    get current() { return animator.current },
    get target() { return animator.target },
    navigate: animator.navigate,
    track: animator.track,
    frame: animator.frame,
    hold: animator.hold,
    glide: animator.glide,
    get fitted() { return fitted },
    get touched() { return touched },
    set touched(value: boolean) { touched = value },
    paint,
    refit,
    /** Fits the scene to a frame measured by the caller, without moving the camera. */
    refitTo(frame: MapFrame): Camera {
      fitted = fitTo(frame)
      return focused(frame, fitted)
    },
    /** Zooms about the centre of the frame, starting from where the camera is heading. */
    zoomBy(factor: number): void {
      const frame = options.frame()
      animator.navigate(zoomAbout(animator.target, factor, { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 }, fitted))
      touched = true
    },
    zoomAt(factor: number, point: Point): void {
      animator.track(zoomAbout(animator.current, factor, point, fitted))
      touched = true
    },
    panBy(dx: number, dy: number): void {
      animator.track(pan(animator.current, dx, dy))
      touched = true
    },
    /** Moves to a focus fitted in a frame; nothing to focus leaves the camera where it is. */
    focus(next: Camera | undefined, frame: MapFrame): void {
      if (next === undefined) return
      animator.navigate(pan(next, frame.x, frame.y))
      touched = true
    },
  }
}
