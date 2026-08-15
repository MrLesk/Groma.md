import { ancestorOfKind, defaultSelection } from './navigation.ts'
import type {
  ArchitectureWorld,
  Bounds,
  DisplayRole,
  Point,
  ProjectedRelationship,
  ProjectionOptions,
  SemanticLevel,
  WorldElement,
  WorldProjection,
  WorldRelationship,
} from '../../types.ts'

const levelNames: Record<SemanticLevel, string> = {
  components: 'Components',
  containers: 'Containers',
  context: 'System Context',
}

const CELL_ASPECT = 0.5

const titledCard = {
  height: 5,
  width: 21,
}

export function sidePanelWidth(totalWidth: number): number {
  return Math.max(24, Math.floor(totalWidth / 3))
}

function unionBounds(boxes: Bounds[]): Bounds | undefined {
  const first = boxes[0]
  if (!first) return undefined
  let x = first.x
  let y = first.y
  let right = first.x + first.width
  let bottom = first.y + first.height
  for (const box of boxes.slice(1)) {
    x = Math.min(x, box.x)
    y = Math.min(y, box.y)
    right = Math.max(right, box.x + box.width)
    bottom = Math.max(bottom, box.y + box.height)
  }
  return { x, y, width: right - x, height: bottom - y }
}

function cameraBounds(
  world: ArchitectureWorld,
  level: SemanticLevel,
  selected: WorldElement | undefined,
  panel: ProjectionOptions['panel'],
  elementsById: Map<string, WorldElement>,
): Bounds {
  if (panel === 'side' && selected) {
    const children = selected.children.flatMap(id => {
      const child = elementsById.get(id)
      return child ? [child.bounds] : []
    })
    return padded(unionBounds(children) ?? selected.bounds)
  }
  return padded(focusElement(level, selected, elementsById)?.bounds ?? world.bounds)
}

function focusElement(
  level: SemanticLevel,
  selected: WorldElement | undefined,
  elementsById: Map<string, WorldElement>,
): WorldElement | null {
  if (level === 'context') return null
  const kind = level === 'containers' ? 'system' : 'container'
  return ancestorOfKind(selected, kind, elementsById) ?? null
}

function padded(bounds: Bounds): Bounds {
  const padding = 4
  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  }
}

interface Transform {
  xScale: number
  yScale: number
  x: number
  y: number
}

function transformFor(camera: Bounds, viewport: Bounds): Transform {
  const scale = Math.min(
    viewport.width / camera.width,
    viewport.height / (camera.height * CELL_ASPECT),
  )
  const renderedWidth = camera.width * scale
  const renderedHeight = camera.height * scale * CELL_ASPECT

  return {
    xScale: scale,
    yScale: scale * CELL_ASPECT,
    x: viewport.x + (viewport.width - renderedWidth) / 2 - camera.x * scale,
    y: viewport.y + (viewport.height - renderedHeight) / 2
      - camera.y * scale * CELL_ASPECT,
  }
}

function projectPoint(point: Point, transform: Transform): Point {
  return {
    x: Math.round(transform.x + point.x * transform.xScale),
    y: Math.round(transform.y + point.y * transform.yScale),
  }
}

function centeredBounds(bounds: Bounds, width: number, height: number): Bounds {
  return {
    x: Math.round(bounds.x + bounds.width / 2 - width / 2),
    y: Math.round(bounds.y + bounds.height / 2 - height / 2),
    width,
    height,
  }
}

function titledCardBounds(bounds: Bounds, element: WorldElement): Bounds {
  const width = Math.max(
    titledCard.width,
    element.name.length + 4,
    element.origin.length + 4,
  )
  const compound = element.children.length > 0
  if (compound) return centeredBounds(bounds, width, titledCard.height)

  return centeredBounds(
    bounds,
    Math.max(bounds.width, width),
    Math.max(bounds.height, titledCard.height),
  )
}

function compactBounds(bounds: Bounds, element: WorldElement): Bounds {
  const width = Math.max(6, Math.min(18, element.name.length + 2))
  return centeredBounds(bounds, width, 1)
}

function fitWithin(bounds: Bounds, viewport: Bounds): Bounds {
  return {
    ...bounds,
    x: clamp(
      bounds.x,
      viewport.x,
      Math.max(viewport.x, viewport.x + viewport.width - bounds.width),
    ),
    y: clamp(
      bounds.y,
      viewport.y,
      Math.max(viewport.y, viewport.y + viewport.height - bounds.height),
    ),
  }
}

function inset(bounds: Bounds, amount: number): Bounds {
  return {
    x: bounds.x + amount,
    y: bounds.y + amount,
    width: Math.max(1, bounds.width - amount * 2),
    height: Math.max(1, bounds.height - amount * 2),
  }
}

function projectBounds(bounds: Bounds, transform: Transform): Bounds {
  const topLeft = projectPoint(bounds, transform)
  const bottomRight = projectPoint({
    x: bounds.x + bounds.width,
    y: bounds.y + bounds.height,
  }, transform)

  const projected = {
    x: topLeft.x,
    y: topLeft.y,
    width: Math.max(1, bottomRight.x - topLeft.x),
    height: Math.max(1, bottomRight.y - topLeft.y),
  }
  return projected
}

function within(
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

function displayRole(
  element: WorldElement,
  level: SemanticLevel,
  focus: WorldElement | null,
  elementsById: Map<string, WorldElement>,
): DisplayRole {
  if (level === 'context') return element.parent === null ? 'card' : 'hidden'
  if (!focus) return 'hidden'

  if (level === 'containers') {
    if (element.representationId === focus.representationId) return 'system-boundary'
    if (element.parent === focus.representationId && element.kind === 'container') {
      return 'card'
    }
    return element.parent === null ? 'compact' : 'hidden'
  }

  const system = ancestorOfKind(focus, 'system', elementsById)
  if (system && element.representationId === system.representationId) {
    return 'system-boundary'
  }
  if (element.representationId === focus.representationId) {
    return 'container-boundary'
  }
  if (element.parent === focus.representationId && element.kind === 'component') {
    return 'card'
  }
  if (system && element.parent === system.representationId && element.kind === 'container') {
    return 'compact'
  }
  return element.parent === null ? 'compact' : 'hidden'
}

function displayEndpoint(
  element: WorldElement,
  level: SemanticLevel,
  focus: WorldElement | null,
  elementsById: Map<string, WorldElement>,
): WorldElement {
  if (level === 'context') return topAncestor(element, elementsById)
  if (level === 'containers') {
    return ancestorOfKind(element, 'container', elementsById) ?? element
  }
  if (focus && within(element, focus.representationId, elementsById)) return element
  return ancestorOfKind(element, 'container', elementsById)
    ?? topAncestor(element, elementsById)
}

function relationshipVisibleAtLevel(
  relationship: WorldRelationship,
  level: SemanticLevel,
  focus: WorldElement | null,
  elementsById: Map<string, WorldElement>,
): boolean {
  const source = elementsById.get(relationship.source)
  const target = elementsById.get(relationship.target)
  if (!source || !target) return false
  if (level === 'context') {
    return source.parent === null || target.parent === null
  }
  if (level === 'containers') {
    return source.kind !== 'component'
      && target.kind !== 'component'
      && focus !== null
      && within(source, focus.representationId, elementsById)
      && within(target, focus.representationId, elementsById)
  }
  return focus !== null && (
    within(source, focus.representationId, elementsById)
    || within(target, focus.representationId, elementsById)
  )
}

function topAncestor(
  element: WorldElement,
  elementsById: Map<string, WorldElement>,
): WorldElement {
  let current = element
  while (current.parent !== null) {
    const parent = elementsById.get(current.parent)
    if (!parent) throw new Error(`Unknown parent representation: ${current.parent}`)
    current = parent
  }
  return current
}

function visibleRelationships(
  world: ArchitectureWorld,
  level: SemanticLevel,
  focus: WorldElement | null,
  elementsById: Map<string, WorldElement>,
): WorldRelationship[] {
  const visible = world.relationships.filter(relationship => {
    return relationshipVisibleAtLevel(
      relationship,
      level,
      focus,
      elementsById,
    )
  })
  if (level !== 'context') return visible

  const seenPairs = new Set<string>()
  return visible.filter(relationship => {
    const sourceElement = elementsById.get(relationship.source)
    const targetElement = elementsById.get(relationship.target)
    if (!sourceElement || !targetElement) return false
    const source = topAncestor(sourceElement, elementsById)
    const target = topAncestor(targetElement, elementsById)
    const pair = `${source.representationId}\0${target.representationId}`
    if (seenPairs.has(pair)) return false
    seenPairs.add(pair)
    return true
  })
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function insideSpan(value: number, start: number, size: number): number {
  if (size <= 2) return Math.round(start + (size - 1) / 2)
  return clamp(value, start + 1, start + size - 2)
}

function orthogonalRoute(route: Point[]): Point[] {
  const points: Point[] = []
  function add(point: Point): void {
    const previous = points.at(-1)
    if (!previous || previous.x !== point.x || previous.y !== point.y) {
      points.push(point)
    }
  }

  for (const [index, point] of route.entries()) {
    if (index > 0) {
      const previous = route[index - 1]
      if (previous.x !== point.x && previous.y !== point.y) {
        add({ x: point.x, y: previous.y })
      }
    }
    add({ ...point })
  }
  return points
}

function pointInside(point: Point, bounds: Bounds): boolean {
  return point.x >= bounds.x
    && point.x < bounds.x + bounds.width
    && point.y >= bounds.y
    && point.y < bounds.y + bounds.height
}

function trimRouteToDisplayedEndpoints(
  route: Point[],
  source: Bounds,
  target: Bounds,
): Point[] {
  if (route.length <= 2) return route
  const sourceCenter = {
    x: source.x + source.width / 2,
    y: source.y + source.height / 2,
  }
  const targetCenter = {
    x: target.x + target.width / 2,
    y: target.y + target.height / 2,
  }
  const horizontal = Math.abs(targetCenter.x - sourceCenter.x)
    >= Math.abs(targetCenter.y - sourceCenter.y)
  const minimum = horizontal
    ? sourceCenter.x <= targetCenter.x
      ? source.x + source.width
      : target.x + target.width
    : sourceCenter.y <= targetCenter.y
      ? source.y + source.height
      : target.y + target.height
  const maximum = horizontal
    ? sourceCenter.x <= targetCenter.x
      ? target.x - 1
      : source.x - 1
    : sourceCenter.y <= targetCenter.y
      ? target.y - 1
      : source.y - 1
  const intermediates = route.slice(1, -1).filter(point => {
    const coordinate = horizontal ? point.x : point.y
    return coordinate >= minimum
      && coordinate <= maximum
      && !pointInside(point, source)
      && !pointInside(point, target)
  })
  return [route[0]!, ...intermediates, route.at(-1)!]
}

function attachRouteToBounds(route: Point[], source: Bounds, target: Bounds): Point[] {
  if (route.length < 2) return route
  const attached = route.map(point => ({ ...point }))
  const first = attached[0]!
  const second = attached[1]!
  if (second.x > first.x) {
    first.x = source.x + source.width
    first.y = insideSpan(first.y, source.y, source.height)
  } else if (second.x < first.x) {
    first.x = source.x - 1
    first.y = insideSpan(first.y, source.y, source.height)
  } else if (second.y > first.y) {
    first.y = source.y + source.height
    first.x = insideSpan(first.x, source.x, source.width)
  } else {
    first.y = source.y - 1
    first.x = insideSpan(first.x, source.x, source.width)
  }

  const last = attached.at(-1)!
  const previous = attached.at(-2)!
  if (last.x > previous.x) {
    last.x = target.x - 1
    last.y = insideSpan(last.y, target.y, target.height)
  } else if (last.x < previous.x) {
    last.x = target.x + target.width
    last.y = insideSpan(last.y, target.y, target.height)
  } else if (last.y > previous.y) {
    last.y = target.y - 1
    last.x = insideSpan(last.x, target.x, target.width)
  } else {
    last.y = target.y + target.height
    last.x = insideSpan(last.x, target.x, target.width)
  }
  return attached
}

function projectLabel(
  label: Bounds,
  transform: Transform,
  viewport: Bounds,
): Pick<Bounds, 'x' | 'y' | 'width'> {
  const topLeft = projectPoint(label, transform)
  const bottomRight = projectPoint({
    x: label.x + label.width,
    y: label.y + label.height,
  }, transform)
  const width = Math.min(
    viewport.width,
    Math.max(10, bottomRight.x - topLeft.x),
  )
  const center = (topLeft.x + bottomRight.x) / 2
  return {
    x: clamp(
      Math.round(center - width / 2),
      viewport.x,
      viewport.x + viewport.width - width,
    ),
    y: clamp(
      topLeft.y,
      viewport.y,
      viewport.y + viewport.height - 1,
    ),
    width,
  }
}

function boundsOverlap(left: Bounds, right: Bounds): boolean {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y
}

function visibleIn(bounds: Bounds, viewport: Bounds): boolean {
  return bounds.x < viewport.x + viewport.width
    && bounds.x + bounds.width > viewport.x
    && bounds.y < viewport.y + viewport.height
    && bounds.y + bounds.height > viewport.y
}

function compactRouteLabel(
  route: Point[],
  description: string,
  preferred: Pick<Bounds, 'x' | 'y' | 'width'>,
  viewport: Bounds,
  endpoints: Bounds[],
): Pick<Bounds, 'x' | 'y' | 'width'> {
  const width = description.split(' ', 1)[0].length
  const candidates: Array<Pick<Bounds, 'x' | 'y' | 'width'> & { distance: number }> = []
  for (let index = 1; index < route.length; index += 1) {
    const from = route[index - 1]
    const to = route[index]
    if (from.x === to.x) continue
    const left = Math.min(from.x, to.x) + 1
    const right = Math.max(from.x, to.x) - 1
    if (right - left + 1 < width) continue
    const candidate = {
      x: Math.round((left + right - width + 1) / 2),
      y: from.y,
      width,
      distance: Math.abs((left + right) / 2 - (preferred.x + preferred.width / 2)),
    }
    if (!endpoints.some(endpoint => boundsOverlap(
      { ...candidate, width, height: 1 },
      endpoint,
    ))) candidates.push(candidate)
  }
  candidates.sort((left, right) => left.distance - right.distance)
  const candidate = candidates[0]
  if (!candidate) return preferred
  return {
    x: clamp(
      candidate.x,
      viewport.x,
      viewport.x + viewport.width - width,
    ),
    y: clamp(
      candidate.y,
      viewport.y,
      viewport.y + viewport.height - 1,
    ),
    width,
  }
}

export function projectWorld(
  world: ArchitectureWorld,
  options: ProjectionOptions,
): WorldProjection {
  const { width, height, level = 'context', currentId, panel } = options
  if (!Object.hasOwn(levelNames, level)) {
    throw new Error(`Unsupported semantic level: ${level}`)
  }

  const reserved = panel === 'side' ? sidePanelWidth(width) : 0
  const viewport = {
    x: 1,
    y: 3,
    width: Math.max(1, width - 2 - reserved),
    height: Math.max(1, height - 4),
  }
  const elementsById = new Map(world.elements.map(element => [
    element.representationId,
    element,
  ]))
  const selected = currentId === undefined
    ? defaultSelection(world, level)
    : elementsById.get(currentId) ?? defaultSelection(world, level)
  const focus = focusElement(level, selected, elementsById)
  const transform = transformFor(
    cameraBounds(world, level, selected, panel, elementsById),
    viewport,
  )
  const projectedElements = world.elements.map(element => {
    const display = displayRole(element, level, focus, elementsById)
    const projected = projectBounds(element.bounds, transform)
    const cellBounds = display === 'card'
      ? titledCardBounds(projected, element)
      : display === 'compact'
        ? compactBounds(projected, element)
        : projected
    return { ...element, display, cellBounds }
  })
  const initialById = new Map(projectedElements.map(element => [
    element.representationId,
    element,
  ]))
  const cardBoundary = focus === null ? null : initialById.get(focus.representationId)
  const fittedElements = projectedElements.map(element => {
    if (element.display !== 'card') return element
    const available = cardBoundary == null
      ? viewport
      : inset(cardBoundary.cellBounds, 2)
    return {
      ...element,
      cellBounds: fitWithin(fitWithin(element.cellBounds, available), viewport),
    }
  })
  const projectedById = new Map(fittedElements.map(element => [
    element.representationId,
    element,
  ]))

  return {
    level,
    levelName: levelNames[level],
    currentId: selected?.representationId ?? null,
    currentName: selected?.name ?? 'Architecture',
    scale: transform.xScale,
    viewport,
    elements: fittedElements,
    relationships: visibleRelationships(world, level, focus, elementsById)
      .map(relationship => {
        const sourceElement = elementsById.get(relationship.source)
        const targetElement = elementsById.get(relationship.target)
        if (!sourceElement || !targetElement) return null
        const source = displayEndpoint(
          sourceElement,
          level,
          focus,
          elementsById,
        )
        const target = displayEndpoint(
          targetElement,
          level,
          focus,
          elementsById,
        )
        if (source.representationId === target.representationId) return null
        const projectedSource = projectedById.get(source.representationId)
        const projectedTarget = projectedById.get(target.representationId)
        if (!projectedSource || !projectedTarget) return null
        const sourceBounds = projectedSource.cellBounds
        const targetBounds = projectedTarget.cellBounds
        if (!visibleIn(sourceBounds, viewport) || !visibleIn(targetBounds, viewport)) {
          return null
        }
        const projectedRoute = trimRouteToDisplayedEndpoints(
          orthogonalRoute(
            relationship.route.map(point => projectPoint(point, transform)),
          ),
          sourceBounds,
          targetBounds,
        )
        const cellRoute = orthogonalRoute(attachRouteToBounds(
          projectedRoute,
          sourceBounds,
          targetBounds,
        ))
        const cellLabel = relationship.label === null
          ? null
          : projectLabel(relationship.label, transform, viewport)
        return {
          ...relationship,
          cellRoute,
          cellLabel: cellLabel === null || level === 'components'
            ? cellLabel
            : compactRouteLabel(
                cellRoute,
                relationship.description,
                cellLabel,
                viewport,
                [sourceBounds, targetBounds],
              ),
          displaySource: source.representationId,
          displayTarget: target.representationId,
        }
      })
      .filter((relationship): relationship is ProjectedRelationship => {
        return relationship !== null
      }),
  }
}
