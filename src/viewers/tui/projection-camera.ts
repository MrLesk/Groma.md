import { ancestorOfKind, defaultSelection } from './navigation.ts'
import type {
  ArchitectureWorld,
  Bounds,
  MapCamera,
  Point,
  TerminalLevel,
  WorldElement,
} from '../../types.ts'

export const CELL_ASPECT = 0.5
/** World layout reserves three units per terminal glyph. */
export const MAP_SCALE = 1 / 3

export interface Transform {
  xScale: number
  yScale: number
  x: number
  y: number
}

export function focusElement(
  level: TerminalLevel,
  selected: WorldElement | undefined,
  elementsById: Map<string, WorldElement>,
): WorldElement | null {
  if (level === 'context') return null
  return ancestorOfKind(selected, 'container', elementsById) ?? null
}

export function scopeCamera(
  world: ArchitectureWorld,
  level: TerminalLevel,
  currentId?: string,
): MapCamera {
  const elementsById = new Map(world.elements.map(element => [
    element.representationId,
    element,
  ]))
  const selected = currentId === undefined
    ? defaultSelection(world, level)
    : elementsById.get(currentId) ?? defaultSelection(world, level)
  const focus = focusElement(level, selected, elementsById) ?? selected
  const subject = focus?.bounds ?? world.bounds
  return {
    zoom: MAP_SCALE,
    centerX: subject.x + subject.width / 2,
    centerY: subject.y + subject.height / 2,
  }
}

export function transformFor(camera: MapCamera, viewport: Bounds): Transform {
  const xScale = camera.zoom
  const yScale = camera.zoom * CELL_ASPECT
  return {
    xScale,
    yScale,
    x: viewport.x + viewport.width / 2 - camera.centerX * xScale,
    y: viewport.y + viewport.height / 2 - camera.centerY * yScale,
  }
}

export function visibleIn(bounds: Bounds, viewport: Bounds): boolean {
  return bounds.x < viewport.x + viewport.width
    && bounds.x + bounds.width > viewport.x
    && bounds.y < viewport.y + viewport.height
    && bounds.y + bounds.height > viewport.y
}

export function panCells(bounds: Bounds, viewport: Bounds): Point {
  let x = 0
  let y = 0
  if (bounds.width <= viewport.width) {
    if (bounds.x < viewport.x) x = viewport.x - bounds.x
    else if (bounds.x + bounds.width > viewport.x + viewport.width) {
      x = viewport.x + viewport.width - bounds.x - bounds.width
    }
  } else if (!visibleIn(bounds, viewport)) {
    x = viewport.x - bounds.x
  }
  if (bounds.height <= viewport.height) {
    if (bounds.y < viewport.y) y = viewport.y - bounds.y
    else if (bounds.y + bounds.height > viewport.y + viewport.height) {
      y = viewport.y + viewport.height - bounds.y - bounds.height
    }
  } else if (!visibleIn(bounds, viewport)) {
    y = viewport.y - bounds.y
  }
  return { x, y }
}

export function projectPoint(point: Point, transform: Transform): Point {
  return {
    x: Math.round(transform.x + point.x * transform.xScale),
    y: Math.round(transform.y + point.y * transform.yScale),
  }
}

export function projectBounds(bounds: Bounds, transform: Transform): Bounds {
  const topLeft = projectPoint(bounds, transform)
  const bottomRight = projectPoint({
    x: bounds.x + bounds.width,
    y: bounds.y + bounds.height,
  }, transform)

  return {
    x: topLeft.x,
    y: topLeft.y,
    width: Math.max(1, bottomRight.x - topLeft.x),
    height: Math.max(1, bottomRight.y - topLeft.y),
  }
}
