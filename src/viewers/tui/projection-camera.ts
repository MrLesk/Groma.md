import type { Bounds, Point } from '../../types.ts'

export interface TerminalCamera {
  /** Top-left world cell shown in the map viewport. */
  x: number
  y: number
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

export function centeredCamera(
  world: Bounds,
  subject: Bounds,
  viewport: Bounds,
): TerminalCamera {
  return clampCamera({
    x: Math.round(subject.x + subject.width / 2 - viewport.width / 2),
    y: Math.round(subject.y + subject.height / 2 - viewport.height / 2),
  }, world, viewport)
}

export function clampCamera(
  camera: TerminalCamera,
  world: Bounds,
  viewport: Bounds,
): TerminalCamera {
  const centeredX = world.x - Math.floor((viewport.width - world.width) / 2)
  const centeredY = world.y - Math.floor((viewport.height - world.height) / 2)
  const maximumX = Math.max(world.x, world.x + world.width - viewport.width)
  const maximumY = Math.max(world.y, world.y + world.height - viewport.height)
  return {
    x: world.width <= viewport.width ? centeredX : clamp(camera.x, world.x, maximumX),
    y: world.height <= viewport.height ? centeredY : clamp(camera.y, world.y, maximumY),
  }
}

/** Moves only enough to keep a selected shape inside the viewport. */
export function reveal(
  camera: TerminalCamera,
  selection: Bounds,
  world: Bounds,
  viewport: Bounds,
): TerminalCamera {
  let x = camera.x
  let y = camera.y
  const margin = 1
  if (selection.width <= viewport.width - 2 * margin) {
    if (selection.x < x + margin) x = selection.x - margin
    if (selection.x + selection.width > x + viewport.width - margin) {
      x = selection.x + selection.width - viewport.width + margin
    }
  } else if (selection.x + selection.width <= x || selection.x >= x + viewport.width) {
    x = selection.x
  }
  if (selection.height <= viewport.height - 2 * margin) {
    if (selection.y < y + margin) y = selection.y - margin
    if (selection.y + selection.height > y + viewport.height - margin) {
      y = selection.y + selection.height - viewport.height + margin
    }
  } else if (selection.y + selection.height <= y || selection.y >= y + viewport.height) {
    y = selection.y
  }
  return x === camera.x && y === camera.y
    ? camera
    : clampCamera({ x, y }, world, viewport)
}

export function projectPoint(
  point: Point,
  camera: TerminalCamera,
  viewport: Bounds,
): Point {
  return {
    x: viewport.x + point.x - camera.x,
    y: viewport.y + point.y - camera.y,
  }
}

export function projectBounds(
  bounds: Bounds,
  camera: TerminalCamera,
  viewport: Bounds,
): Bounds {
  const point = projectPoint(bounds, camera, viewport)
  return { ...bounds, ...point }
}

export function visibleIn(bounds: Bounds, viewport: Bounds): boolean {
  return bounds.x < viewport.x + viewport.width
    && bounds.x + bounds.width > viewport.x
    && bounds.y < viewport.y + viewport.height
    && bounds.y + bounds.height > viewport.y
}
