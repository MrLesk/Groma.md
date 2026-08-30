import type { WebMapPayload } from '../payload.ts'

const SAMPLE_MS = 500

export interface ClientMapTimings {
  projectionMilliseconds: number
  paintMilliseconds: number
}

export interface MapDebugSnapshot {
  generation: number
  timings: WebMapPayload['timings'] & ClientMapTimings
  counts: {
    elements: number
    relationships: number
    buildings: number
    routes: number
    routePoints: number
    surfaces: number
    sheetWidth: number
    sheetHeight: number
    sheetCells: number
  }
}

export const mapDebugCss = `
  #map-debug {
    position: fixed; z-index: 30; top: 74px; left: calc(var(--hierarchy-column) + 24px); width: 224px;
    padding: 10px 12px; border: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
    border-radius: 8px; background: var(--chrome-surface);
    backdrop-filter: blur(14px); box-shadow: 0 4px 14px color-mix(in srgb, var(--ink) 6%, transparent);
    color: var(--muted); font-size: 10px; letter-spacing: 0.04em; font-variant-numeric: tabular-nums;
    pointer-events: none;
  }
  #map-debug header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; }
  #map-debug h1, #map-debug h2 { margin: 0; color: var(--ink); font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; }
  #map-debug h2 { margin: 9px 0 4px; color: var(--muted); font-size: 9px; }
  #map-debug output { color: var(--ink); font-size: 12px; font-weight: 650; }
  #map-debug dl { display: grid; grid-template-columns: 1fr auto; gap: 3px 12px; margin: 0; }
  #map-debug dt, #map-debug dd { margin: 0; }
  #map-debug dd { color: var(--ink); text-align: right; }
  body.hud-hidden #map-debug { top: 12px; left: 12px; }
`

/** Frames per second across one positive sample window. */
export function framesPerSecond(frames: number, elapsedMs: number): number {
  return Math.round(frames * 1000 / elapsedMs)
}

/** One immutable diagnostic snapshot derived from the exact map generation. */
export function mapDebugSnapshot(
  map: Pick<WebMapPayload, 'generation' | 'timings' | 'world' | 'sheet'>,
  client: ClientMapTimings,
): MapDebugSnapshot {
  return {
    generation: map.generation,
    timings: { ...map.timings, ...client },
    counts: {
      elements: map.world.elements.length,
      relationships: map.world.relationships.length,
      buildings: map.sheet.buildings.length,
      routes: map.sheet.routes.length,
      routePoints: map.sheet.routes.reduce((total, route) => total + route.points.length, 0),
      surfaces: map.sheet.islands.length + map.sheet.slabs.length + map.sheet.zones.length,
      sheetWidth: map.sheet.sheet.w,
      sheetHeight: map.sheet.sheet.d,
      sheetCells: map.sheet.sheet.w * map.sheet.sheet.d,
    },
  }
}

function milliseconds(value: number): string {
  return `${value < 100 ? value.toFixed(1) : Math.round(value)} ms`
}

/** Display values for one exact diagnostic snapshot. */
export function mapDebugValues(snapshot: MapDebugSnapshot) {
  return {
    total: milliseconds(snapshot.timings.totalMilliseconds),
    architecture: milliseconds(snapshot.timings.architectureLoadMilliseconds),
    placement: milliseconds(snapshot.timings.placementMilliseconds),
    routing: milliseconds(snapshot.timings.routingMilliseconds),
    projection: milliseconds(snapshot.timings.projectionMilliseconds),
    paint: milliseconds(snapshot.timings.paintMilliseconds),
    generation: String(snapshot.generation),
    elements: String(snapshot.counts.elements),
    relationships: String(snapshot.counts.relationships),
    buildings: String(snapshot.counts.buildings),
    surfaces: String(snapshot.counts.surfaces),
    routes: String(snapshot.counts.routes),
    routePoints: String(snapshot.counts.routePoints),
    sheet: `${snapshot.counts.sheetWidth.toFixed(1)} × ${snapshot.counts.sheetHeight.toFixed(1)}`,
    sheetCells: String(Math.round(snapshot.counts.sheetCells)),
  }
}

/** One independent debug overlay whose animation loop runs only while it is visible. */
export function createMapDebugPanel(
  host: HTMLElement,
  currentMap: () => Pick<WebMapPayload, 'generation' | 'timings' | 'world' | 'sheet'>,
) {
  const panel = document.createElement('aside')
  panel.id = 'map-debug'
  panel.setAttribute('aria-label', 'Map debug')
  panel.hidden = true
  panel.innerHTML = `
    <header><h1>Map debug</h1><output data-value="fps" aria-live="polite">-- FPS</output></header>
    <h2>Server</h2><dl>
      <dt>Map total</dt><dd data-value="total"></dd>
      <dt>Architecture</dt><dd data-value="architecture"></dd>
      <dt>Placement</dt><dd data-value="placement"></dd>
      <dt>Routing</dt><dd data-value="routing"></dd>
    </dl>
    <h2>Browser</h2><dl>
      <dt>Projection</dt><dd data-value="projection"></dd>
      <dt>SVG paint</dt><dd data-value="paint"></dd>
    </dl>
    <h2>Map</h2><dl>
      <dt>Generation</dt><dd data-value="generation"></dd>
      <dt>Elements</dt><dd data-value="elements"></dd>
      <dt>Relationships</dt><dd data-value="relationships"></dd>
      <dt>Buildings</dt><dd data-value="buildings"></dd>
      <dt>Surfaces</dt><dd data-value="surfaces"></dd>
      <dt>Routes</dt><dd data-value="routes"></dd>
      <dt>Route points</dt><dd data-value="routePoints"></dd>
      <dt>Sheet</dt><dd data-value="sheet"></dd>
      <dt>Cells</dt><dd data-value="sheetCells"></dd>
    </dl>`
  host.append(panel)

  const value = (key: string): HTMLElement => panel.querySelector(`[data-value="${key}"]`)!
  const fps = value('fps')
  const client = { projectionMilliseconds: 0, paintMilliseconds: 0 }
  let animation: number | undefined
  let sampleStart: number | undefined
  let frames = 0

  const tick = (now: number): void => {
    if (sampleStart === undefined) sampleStart = now
    else {
      frames += 1
      const elapsed = now - sampleStart
      if (elapsed >= SAMPLE_MS) {
        fps.textContent = `${framesPerSecond(frames, elapsed)} FPS`
        sampleStart = now
        frames = 0
      }
    }
    animation = requestAnimationFrame(tick)
  }
  const update = (snapshot: MapDebugSnapshot): void => {
    for (const [key, text] of Object.entries(mapDebugValues(snapshot))) value(key).textContent = text
  }

  return {
    project<T>(work: () => T): T {
      const started = performance.now()
      const result = work()
      client.projectionMilliseconds = performance.now() - started
      return result
    },
    paint(work: () => void): void {
      const started = performance.now()
      work()
      client.paintMilliseconds = performance.now() - started
      update(mapDebugSnapshot(currentMap(), client))
    },
    toggle() {
      panel.hidden = !panel.hidden
      if (panel.hidden) {
        if (animation !== undefined) cancelAnimationFrame(animation)
        animation = undefined
        return
      }
      fps.textContent = '-- FPS'
      sampleStart = undefined
      frames = 0
      animation = requestAnimationFrame(tick)
    },
  }
}
