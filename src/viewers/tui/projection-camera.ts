import { ancestorOfKind, defaultSelection } from './navigation.ts'
import type {
  ArchitectureWorld,
  Bounds,
  MapCamera,
  Point,
  SemanticLevel,
  WorldElement,
} from '../../types.ts'

export const CELL_ASPECT = 0.5

export interface Transform {
  xScale: number
  yScale: number
  x: number
  y: number
}

export function focusElement(
  level: SemanticLevel,
  selected: WorldElement | undefined,
  elementsById: Map<string, WorldElement>,
): WorldElement | null {
  if (level === 'context') return null
  const kind = level === 'containers' ? 'system' : 'container'
  return ancestorOfKind(selected, kind, elementsById) ?? null
}

export function padded(bounds: Bounds): Bounds {
  const padding = 16
  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  }
}

function unionBounds(bounds: Bounds[]): Bounds {
  const first = bounds[0]
  if (first === undefined) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
  let minX = first.x
  let minY = first.y
  let maxX = first.x + first.width
  let maxY = first.y + first.height
  for (const box of bounds.slice(1)) {
    minX = Math.min(minX, box.x)
    minY = Math.min(minY, box.y)
    maxX = Math.max(maxX, box.x + box.width)
    maxY = Math.max(maxY, box.y + box.height)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function fitZoomFor(subject: Bounds, viewport: Bounds): number {
  return Math.min(
    viewport.width / Math.max(1, subject.width),
    viewport.height / Math.max(1, subject.height * CELL_ASPECT),
    1,
  )
}

export function overviewCamera(subject: Bounds, viewport: Bounds): MapCamera {
  return {
    zoom: fitZoomFor(subject, viewport),
    centerX: subject.x + subject.width / 2,
    centerY: subject.y + subject.height / 2,
  }
}

export function fitView(
  world: ArchitectureWorld,
  viewport: Bounds,
): MapCamera {
  return overviewCamera(padded(world.bounds), viewport)
}

export function within(
  element: WorldElement | undefined,
  ancestorId: string,
  elementsById: Map<string, WorldElement>,
): boolean {
  let current = element
  while (current) {
    if (current.representationId === ancestorId) return true
    current = current.parent === null
      ? undefined
      : elementsById.get(current.parent)
  }
  return false
}

function peopleUsing(
  focus: WorldElement,
  world: ArchitectureWorld,
  elementsById: Map<string, WorldElement>,
): WorldElement[] {
  return world.elements.filter(element => {
    if (element.kind !== 'person') return false
    return world.relationships.some(relationship => {
      const otherId = relationship.source === element.representationId
        ? relationship.target
        : relationship.target === element.representationId
          ? relationship.source
          : undefined
      if (otherId === undefined) return false
      const other = elementsById.get(otherId)
      return other !== undefined && within(other, focus.representationId, elementsById)
    })
  })
}

export function fitLayer(
  world: ArchitectureWorld,
  viewport: Bounds,
  level: SemanticLevel,
  currentId?: string,
): MapCamera {
  if (level === 'context') return fitView(world, viewport)
  const elementsById = new Map(world.elements.map(element => [
    element.representationId,
    element,
  ]))
  const selected = currentId === undefined
    ? defaultSelection(world, level)
    : elementsById.get(currentId) ?? defaultSelection(world, level)
  const subject = focusElement(level, selected, elementsById)
  if (subject === null) {
    return overviewCamera(padded(world.bounds), viewport)
  }
  const frame = level === 'containers'
    ? unionBounds([subject.bounds, ...peopleUsing(subject, world, elementsById).map(element => {
      return element.bounds
    })])
    : subject.bounds
  return overviewCamera(padded(frame), viewport)
}

const levelDepth: Record<SemanticLevel, number> = {
  context: 0,
  containers: 1,
  components: 2,
}

export function followSelection(
  world: ArchitectureWorld,
  viewport: Bounds,
  previous: { level: SemanticLevel; currentId?: string },
  next: { level: SemanticLevel; currentId?: string },
  current: MapCamera,
): MapCamera | undefined {
  if (next.level === previous.level) return undefined
  const target = fitLayer(world, viewport, next.level, next.currentId)
  if (levelDepth[next.level] < levelDepth[previous.level]) {
    return { ...target, zoom: Math.min(current.zoom, target.zoom) }
  }
  return target
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

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
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
