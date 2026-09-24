import type { Camera } from './camera.ts'

/** The layer settles this long after its camera last moved or the scene was last redrawn: a zoom-in or gesture draws its SVG scale, a layer the compositor scaled is rebuilt sharp, and hover and glows return. Panning keeps the cached picture. */
const SETTLE_MS = 250

/** A camera with the zoom ratio its stroke weight follows. */
export interface CameraView {
  camera: Camera
  zoomRatio: number
}

/** What the cached layer asks of the map drawn inside it. */
export interface LayerPainter {
  /** Writes the SVG for `view`: its transform and everything drawn at that zoom's scale. */
  draw(view: CameraView): void
  /** The map starts moving; glows wait until it settles. */
  moving(): void
  /** The map has settled; hover and glows return. */
  settled(): void
}

/**
 * The cached camera layer: one promoted element whose CSS transform moves the picture the SVG last drew, so pans and
 * zooms need no redraw. It draws the shown camera into the SVG when the map settles after a scale change, or at once
 * when navigation zooms out, and rebuilds the layer sharp once the compositor has scaled it.
 */
export function createCameraLayer(painter: LayerPainter) {
  const element = document.createElement('div')
  element.className = 'camera'
  // The cached layer stays promoted at rest: promoting it again when a pan starts makes Safari redraw the whole map.
  element.style.willChange = 'transform'
  /** The camera shown now, and the one the SVG was last drawn for; between them the cached picture moves. */
  let shown: CameraView | undefined
  let drawn: CameraView | undefined
  /** True from a scene redraw until the camera is next drawn or the map settles: the cached picture no longer shows the scene. */
  let stale = false
  /** True once the compositor has scaled the layer since it was last rebuilt. */
  let scaled = false
  /**
   * True from a camera change or a scene redraw until the map settles; hover highlights and glows wait for it. It lives
   * here rather than as an attribute on the map host, because flipping such an attribute restyles every map element.
   */
  let moving = false
  let settleTimer: ReturnType<typeof setTimeout> | undefined
  let movedAt = 0

  /** Refresh scale-dependent SVG together; per-frame writes invalidate Safari's cached layer. */
  const draw = (view: CameraView): void => {
    painter.draw(view)
    drawn = view
    stale = false
    // The cached layer keeps a transform at rest: removing it and setting it again on the next pan makes Safari redraw the whole map.
    element.style.transform = 'translate(0px, 0px) scale(1)'
  }

  /** Shows `camera` by moving the cached picture that the SVG holds for `from`. */
  const showCached = (camera: Camera, from: Camera): void => {
    const ratio = camera.k / from.k
    element.style.transform = `translate(${camera.x - from.x * ratio}px, ${camera.y - from.y * ratio}px) scale(${ratio})`
    if (ratio !== 1) scaled = true
  }

  /**
   * Once the compositor has scaled the cached layer, Safari keeps drawing it below full resolution, even with the zoom
   * drawn into the SVG. Changing its will-change around a forced layout makes Safari rebuild it sharp without drawing a
   * frame uncached, which would hold Safari for hundreds of milliseconds on a zoomed-out map. It runs in the frame
   * after the settle: in the settle's own frame, where a zoom-in draws, it leaves the map soft.
   */
  const rebuild = (): void => {
    element.style.willChange = 'auto'
    void element.offsetWidth
    element.style.willChange = 'transform'
  }

  /**
   * The map settles once nothing has moved it for SETTLE_MS; one timer waits for that instead of restarting on every
   * frame. The timer hands over to an animation frame, which runs after the camera's own: a long frame can hold a
   * camera transition past SETTLE_MS, and settling in between would draw a camera that the next frame replaces.
   */
  const settle = (): void => {
    const wait = movedAt + SETTLE_MS - performance.now()
    if (wait > 0) {
      waitToSettle(wait)
      return
    }
    settleTimer = undefined
    moving = false
    stale = false
    if (shown !== undefined && (shown.camera.k !== drawn?.camera.k || shown.zoomRatio !== drawn?.zoomRatio)) draw(shown)
    if (scaled) {
      scaled = false
      requestAnimationFrame(rebuild)
    }
    painter.settled()
  }

  const waitToSettle = (ms: number): void => {
    settleTimer = setTimeout(() => requestAnimationFrame(settle), ms)
  }

  const markMoving = (): void => {
    if (!moving) {
      moving = true
      painter.moving()
    }
    movedAt = performance.now()
    if (settleTimer === undefined) waitToSettle(SETTLE_MS)
  }

  return {
    element,
    /** The camera the SVG was last drawn for. */
    get drawn(): Camera | undefined { return drawn?.camera },
    /** The camera shown now, once one has been shown. */
    get shown(): Camera | undefined { return shown?.camera },
    get moving(): boolean { return moving },
    /** Shows `view` and reports whether its scale changed. */
    move(view: CameraView): boolean {
      const scaleChanged = view.camera.k !== shown?.camera.k || view.zoomRatio !== shown?.zoomRatio
      if (!scaleChanged && view.camera.x === shown?.camera.x && view.camera.y === shown?.camera.y) return false
      shown = view
      markMoving()
      // A stale picture has no cached layer worth moving, so the camera goes straight into the SVG.
      if (drawn === undefined || stale) draw(view)
      else showCached(view.camera, drawn.camera)
      return scaleChanged
    },
    /**
     * Navigation is about to head for `destination`. A zoom-out draws the destination into the SVG at once and shows
     * the current view from it, enlarged: shrinking a close-up picture instead makes Safari paint the whole map at
     * close-up resolution.
     */
    approach(destination: CameraView): void {
      if (shown === undefined || drawn === undefined || destination.camera.k >= drawn.camera.k) return
      draw(destination)
      showCached(shown.camera, destination.camera)
      markMoving()
    },
    /** The scene was redrawn, so the cached picture no longer shows it: the next move draws the camera into the SVG. */
    invalidate(): void {
      stale = true
      markMoving()
    },
  }
}
