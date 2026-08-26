const SAMPLE_MS = 500

export const fpsCss = `
  #fps {
    position: fixed; z-index: 30; top: 74px; left: calc(var(--hierarchy-column) + 24px);
    min-width: 54px; padding: 5px 8px; border: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
    border-radius: 6px; background: color-mix(in srgb, var(--paper) 65%, transparent);
    backdrop-filter: blur(14px); box-shadow: 0 4px 14px color-mix(in srgb, var(--ink) 6%, transparent);
    color: var(--muted); font-size: 10px; letter-spacing: 0.08em; text-align: right;
    font-variant-numeric: tabular-nums; pointer-events: none;
  }
  body.hud-hidden #fps { top: 12px; left: 12px; }
`

/** Frames per second across one positive sample window. */
export function framesPerSecond(frames: number, elapsedMs: number): number {
  return Math.round(frames * 1000 / elapsedMs)
}

/** One independent performance overlay whose animation loop runs only while it is visible. */
export function createFpsCounter(host: HTMLElement) {
  const counter = document.createElement('output')
  counter.id = 'fps'
  counter.hidden = true
  host.append(counter)

  let animation: number | undefined
  let sampleStart: number | undefined
  let frames = 0

  const tick = (now: number): void => {
    if (sampleStart === undefined) sampleStart = now
    else {
      frames += 1
      const elapsed = now - sampleStart
      if (elapsed >= SAMPLE_MS) {
        counter.textContent = `${framesPerSecond(frames, elapsed)} FPS`
        sampleStart = now
        frames = 0
      }
    }
    animation = requestAnimationFrame(tick)
  }

  return {
    toggle() {
      counter.hidden = !counter.hidden
      if (counter.hidden) {
        if (animation !== undefined) cancelAnimationFrame(animation)
        animation = undefined
        return
      }
      counter.textContent = '-- FPS'
      sampleStart = undefined
      frames = 0
      animation = requestAnimationFrame(tick)
    },
  }
}
