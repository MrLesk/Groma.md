import { ancestorOfKind, defaultSelection } from './navigation.ts'
import type {
  ArchitectureWorld,
  Bounds,
  DisplayRole,
  MapCamera,
  Point,
  ProjectedGroup,
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

function viewportFor(width: number, height: number): Bounds {
  return {
    x: 1,
    y: 3,
    width: Math.max(1, width - 2),
    height: Math.max(1, height - 4),
  }
}

function fitZoomFor(subject: Bounds, viewport: Bounds): number {
  return Math.min(
    viewport.width / Math.max(1, subject.width),
    viewport.height / Math.max(1, subject.height * CELL_ASPECT),
    1,
  )
}

function overviewCamera(subject: Bounds, viewport: Bounds): MapCamera {
  return {
    zoom: fitZoomFor(subject, viewport),
    centerX: subject.x + subject.width / 2,
    centerY: subject.y + subject.height / 2,
  }
}

export function fitView(
  world: ArchitectureWorld,
  width: number,
  height: number,
): MapCamera {
  return overviewCamera(padded(world.bounds), viewportFor(width, height))
}

export function fitLayer(
  world: ArchitectureWorld,
  width: number,
  height: number,
  level: SemanticLevel,
  currentId?: string,
): MapCamera {
  if (level === 'context') return fitView(world, width, height)
  const elementsById = new Map(world.elements.map(element => [
    element.representationId,
    element,
  ]))
  const selected = currentId === undefined
    ? defaultSelection(world, level)
    : elementsById.get(currentId) ?? defaultSelection(world, level)
  const subject = focusElement(level, selected, elementsById)
  return overviewCamera(
    padded(subject?.bounds ?? world.bounds),
    viewportFor(width, height),
  )
}

const levelDepth: Record<SemanticLevel, number> = {
  context: 0,
  containers: 1,
  components: 2,
}

export function followSelection(
  world: ArchitectureWorld,
  width: number,
  height: number,
  previous: { level: SemanticLevel; currentId?: string },
  next: { level: SemanticLevel; currentId?: string },
  current: MapCamera,
): MapCamera | undefined {
  if (next.level === previous.level) return undefined
  const target = fitLayer(world, width, height, next.level, next.currentId)
  if (levelDepth[next.level] < levelDepth[previous.level]) {
    // `+`/`-` can already be wider than the outer level; do not zoom in on the way out.
    return { ...target, zoom: Math.min(current.zoom, target.zoom) }
  }
  return target
}

function transformFor(camera: MapCamera, viewport: Bounds): Transform {
  const xScale = camera.zoom
  const yScale = camera.zoom * CELL_ASPECT
  return {
    xScale,
    yScale,
    x: viewport.x + viewport.width / 2 - camera.centerX * xScale,
    y: viewport.y + viewport.height / 2 - camera.centerY * yScale,
  }
}

function visibleIn(bounds: Bounds, viewport: Bounds): boolean {
  return bounds.x < viewport.x + viewport.width
    && bounds.x + bounds.width > viewport.x
    && bounds.y < viewport.y + viewport.height
    && bounds.y + bounds.height > viewport.y
}

function uncoveredViewport(viewport: Bounds, coveredFromX?: number): Bounds {
  if (coveredFromX === undefined) return viewport
  // Keep the same one-cell margin the viewport leaves at screen edges,
  // so the selection ring stays clear of the overlay too.
  return {
    ...viewport,
    width: Math.max(1, coveredFromX - viewport.x - 1),
  }
}

function panCells(bounds: Bounds, viewport: Bounds): Point {
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
  const width = Math.max(titledCard.width, element.name.length + 5)
  return centeredBounds(bounds, width, titledCard.height)
}

function keepTitledCardInView(bounds: Bounds, viewport: Bounds): Bounds {
  let x = bounds.x
  let y = bounds.y
  if (x < viewport.x) x = viewport.x
  if (y < viewport.y) y = viewport.y
  if (x + bounds.width > viewport.x + viewport.width) {
    x = viewport.x + viewport.width - bounds.width
  }
  if (y + bounds.height > viewport.y + viewport.height) {
    y = viewport.y + viewport.height - bounds.height
  }
  return { ...bounds, x, y }
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

function leafCard(element: WorldElement): boolean {
  return element.kind === 'person' || element.external
}

function displayRole(
  element: WorldElement,
  level: SemanticLevel,
  focus: WorldElement | null,
): DisplayRole {
  if (leafCard(element) && level !== 'context') return 'hidden'
  if (
    level === 'components'
    && focus
    && element.kind === 'component'
    && element.parent !== focus.representationId
  ) return 'hidden'
  if (element.kind === 'component') return 'card'
  if (element.kind === 'container') return 'container-boundary'
  if (element.kind === 'system' && !element.external) return 'system-boundary'
  return 'card'
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
): Pick<Bounds, 'x' | 'y' | 'width'> {
  const topLeft = projectPoint(label, transform)
  const bottomRight = projectPoint({
    x: label.x + label.width,
    y: label.y + label.height,
  }, transform)
  const width = Math.max(10, bottomRight.x - topLeft.x)
  const center = (topLeft.x + bottomRight.x) / 2
  return {
    x: Math.round(center - width / 2),
    y: topLeft.y,
    width,
  }
}

function boundsOverlap(left: Bounds, right: Bounds): boolean {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y
}

function labelHits(
  label: Pick<Bounds, 'x' | 'y' | 'width'>,
  obstacles: Bounds[],
): boolean {
  const box = {
    x: label.x - 1,
    y: label.y,
    width: label.width + 2,
    height: 1,
  }
  return obstacles.some(obstacle => boundsOverlap(box, obstacle))
}

function compactRouteLabel(
  route: Point[],
  description: string,
  preferred: Pick<Bounds, 'x' | 'y' | 'width'>,
  obstacles: Bounds[],
): Pick<Bounds, 'x' | 'y' | 'width'> {
  const width = description.split(' ', 1)[0].length
  const blocked = [
    ...obstacles,
    ...[route[0], route.at(-1)].flatMap(point => {
      return point === undefined ? [] : [{ x: point.x, y: point.y, width: 1, height: 1 }]
    }),
  ]
  const candidates: Array<Pick<Bounds, 'x' | 'y' | 'width'> & { distance: number }> = []
  function consider(label: Pick<Bounds, 'x' | 'y' | 'width'>, distance: number): void {
    const placed = { ...label, width }
    if (!labelHits(placed, blocked)) {
      candidates.push({ ...placed, distance })
    }
  }

  for (let index = 1; index < route.length; index += 1) {
    const from = route[index - 1]
    const to = route[index]
    if (from.x === to.x) continue
    const left = Math.min(from.x, to.x) + 1
    const right = Math.max(from.x, to.x) - 1
    if (right - left + 1 < width) continue
    consider(
      {
        x: Math.round((left + right - width + 1) / 2),
        y: from.y,
        width,
      },
      Math.abs((left + right) / 2 - (preferred.x + preferred.width / 2)),
    )
  }
  consider(preferred, 0)
  for (const point of route) {
    consider({ x: point.x, y: point.y - 1, width }, 20)
  }
  candidates.sort((left, right) => left.distance - right.distance)
  if (candidates[0]) {
    return {
      x: candidates[0].x,
      y: candidates[0].y,
      width: candidates[0].width,
    }
  }
  return { x: preferred.x, y: preferred.y, width }
}

function projectElements(
  world: ArchitectureWorld,
  level: SemanticLevel,
  focus: WorldElement | null,
  transform: Transform,
  viewport: Bounds,
) {
  const elements = world.elements.map(element => {
    const display = displayRole(element, level, focus)
    const projected = projectBounds(element.bounds, transform)
    return { ...element, display, cellBounds: projected }
  })
  for (const element of elements) {
    if (element.display !== 'card' || !leafCard(element)) continue
    const desired = titledCardBounds(element.cellBounds, element)
    const growing = desired.width > element.cellBounds.width
      || desired.height > element.cellBounds.height
    if (!growing) {
      element.cellBounds = desired
      continue
    }
    const placed = keepTitledCardInView(desired, viewport)
    const origin = {
      x: element.cellBounds.x + element.cellBounds.width / 2,
      y: element.cellBounds.y + element.cellBounds.height / 2,
    }
    if (!pointInside(origin, placed)) continue
    const blocked = elements.some(other => {
      return other !== element
        && other.display !== 'hidden'
        && boundsOverlap(placed, other.cellBounds)
    })
    if (!blocked) element.cellBounds = placed
  }
  return elements
}

function projectGroups(
  world: ArchitectureWorld,
  projectedElements: ReturnType<typeof projectElements>,
  transform: Transform,
): ProjectedGroup[] {
  // A group is only as visible as its members: when every member is hidden
  // at this level, the empty boundary would point at nothing.
  return world.groups
    .filter(group => projectedElements.some(element => {
      return element.display !== 'hidden'
        && element.group === group.name
        && element.parent === group.parent
    }))
    .map(group => ({
      ...group,
      cellBounds: projectBounds(group.bounds, transform),
    }))
}

function projectRelationships(
  world: ArchitectureWorld,
  level: SemanticLevel,
  focus: WorldElement | null,
  elementsById: Map<string, WorldElement>,
  projectedElements: ReturnType<typeof projectElements>,
  projectedGroups: ProjectedGroup[],
  transform: Transform,
  viewport: Bounds,
): ProjectedRelationship[] {
  const projectedById = new Map(projectedElements.map(element => [
    element.representationId,
    element,
  ]))
  const titleRow = (bounds: Bounds): Bounds => ({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: 1,
  })
  const cardBounds = [
    ...projectedElements
      .filter(element => element.display === 'card')
      .map(element => ({
        x: element.cellBounds.x - 1,
        y: element.cellBounds.y - 1,
        width: element.cellBounds.width + 2,
        height: element.cellBounds.height + 2,
      })),
    // Boundary and group titles sit on their top border; a route label
    // placed there would erase the name.
    ...projectedElements
      .filter(element => element.display.endsWith('-boundary'))
      .map(element => titleRow(element.cellBounds)),
    ...projectedGroups.map(group => titleRow(group.cellBounds)),
  ]
  return visibleRelationships(world, level, focus, elementsById)
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
        : projectLabel(relationship.label, transform)
      return {
        ...relationship,
        cellRoute,
        cellLabel: cellLabel === null || level === 'components'
          ? cellLabel
          : compactRouteLabel(
              cellRoute,
              relationship.description,
              cellLabel,
              cardBounds,
            ),
        displaySource: source.representationId,
        displayTarget: target.representationId,
      }
    })
    .filter((relationship): relationship is ProjectedRelationship => {
      return relationship !== null
    })
}

export function projectWorld(
  world: ArchitectureWorld,
  options: ProjectionOptions,
): WorldProjection {
  const { width, height, level = 'context', currentId } = options
  if (!Object.hasOwn(levelNames, level)) {
    throw new Error(`Unsupported semantic level: ${level}`)
  }

  const viewport = viewportFor(width, height)
  const elementsById = new Map(world.elements.map(element => [
    element.representationId,
    element,
  ]))
  const selected = currentId === undefined
    ? defaultSelection(world, level)
    : elementsById.get(currentId) ?? defaultSelection(world, level)
  const focus = focusElement(level, selected, elementsById)
  const overview = padded(world.bounds)
  const fitZoom = fitZoomFor(overview, viewport)
  let camera = options.camera ?? overviewCamera(overview, viewport)
  if (!options.lockCamera) {
    camera = {
      ...camera,
      zoom: clamp(camera.zoom, fitZoom, 1),
    }
  }
  let transform = transformFor(camera, viewport)
  let elements = projectElements(world, level, focus, transform, viewport)
  const selectedElement = elements.find(element => {
    return element.representationId === selected?.representationId
  })
  if (
    !options.lockCamera
    && selectedElement
    && selectedElement.display !== 'hidden'
  ) {
    const nudge = panCells(
      selectedElement.cellBounds,
      uncoveredViewport(viewport, options.coveredFromX),
    )
    if (nudge.x !== 0 || nudge.y !== 0) {
      camera = {
        ...camera,
        centerX: camera.centerX - nudge.x / transform.xScale,
        centerY: camera.centerY - nudge.y / transform.yScale,
      }
      transform = transformFor(camera, viewport)
      elements = projectElements(world, level, focus, transform, viewport)
    }
  }
  const groups = projectGroups(world, elements, transform)

  return {
    level,
    levelName: levelNames[level],
    currentId: selected?.representationId ?? null,
    currentName: selected?.name ?? 'Architecture',
    fitZoom,
    camera,
    viewport,
    elements,
    groups,
    relationships: projectRelationships(
      world,
      level,
      focus,
      elementsById,
      elements,
      groups,
      transform,
      viewport,
    ),
  }
}
