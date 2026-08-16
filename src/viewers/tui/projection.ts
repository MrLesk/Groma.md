import { ancestorOfKind, defaultSelection } from './navigation.ts'
import {
  clamp,
  fitZoomFor,
  focusElement,
  overviewCamera,
  padded,
  panCells,
  projectBounds,
  projectPoint,
  transformFor,
  visibleIn,
  within,
} from './projection-camera.ts'
import {
  attachRouteToBounds,
  boundsOverlap,
  compactRouteLabel,
  orthogonalRoute,
  pointInside,
  projectLabel,
  routeBetweenBoxes,
  trimRouteToDisplayedEndpoints,
} from './projection-routes.ts'
import type {
  ArchitectureWorld,
  Bounds,
  DisplayRole,
  ProjectedGroup,
  ProjectedRelationship,
  ProjectionOptions,
  SemanticLevel,
  WorldElement,
  WorldProjection,
  WorldRelationship,
} from '../../types.ts'

export { fitLayer, fitView, followSelection } from './projection-camera.ts'

const titledCard = {
  height: 5,
  width: 21,
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
  const width = Math.max(titledCard.width, element.name.length + 7)
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

function leafCard(element: WorldElement): boolean {
  return element.kind === 'person' || element.external
}

function displayRole(
  element: WorldElement,
  level: SemanticLevel,
  focus: WorldElement | null,
): DisplayRole {
  if (element.external && level !== 'context') return 'hidden'
  if (element.kind === 'person' && level === 'components') return 'hidden'
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
  const displaySource = displayEndpoint(source, level, focus, elementsById)
  const displayTarget = displayEndpoint(target, level, focus, elementsById)
  if (displaySource.representationId === displayTarget.representationId) return false
  if (level === 'context') return true
  if (level === 'containers') {
    if (focus === null) return false
    const sourceIn = within(displaySource, focus.representationId, elementsById)
    const targetIn = within(displayTarget, focus.representationId, elementsById)
    if (sourceIn && targetIn) return true
    return (source.kind === 'person' && targetIn) || (target.kind === 'person' && sourceIn)
  }
  return focus !== null && (
    within(source, focus.representationId, elementsById)
    || within(target, focus.representationId, elementsById)
  )
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

function projectElements(
  world: ArchitectureWorld,
  level: SemanticLevel,
  focus: WorldElement | null,
  transform: ReturnType<typeof transformFor>,
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
  transform: ReturnType<typeof transformFor>,
): ProjectedGroup[] {
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
  transform: ReturnType<typeof transformFor>,
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
      const promoted = source.representationId !== relationship.source
        || target.representationId !== relationship.target
      const projectedRoute = promoted
        ? routeBetweenBoxes(sourceBounds, targetBounds)
        : trimRouteToDisplayedEndpoints(
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

const levelDepth: Record<SemanticLevel, number> = {
  context: 0,
  containers: 1,
  components: 2,
}

export function projectWorld(
  world: ArchitectureWorld,
  options: ProjectionOptions,
): WorldProjection {
  const { viewport, level = 'context', currentId } = options
  if (!Object.hasOwn(levelDepth, level)) {
    throw new Error(`Unsupported semantic level: ${level}`)
  }

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
    const nudge = panCells(selectedElement.cellBounds, viewport)
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
    currentId: selected?.representationId ?? null,
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
