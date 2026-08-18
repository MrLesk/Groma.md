import { defaultSelection } from './navigation.ts'
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
} from './projection-camera.ts'
import { attachableRole, displayFor, letterName } from './projection-display.ts'
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
import { semanticView } from '../../semantic-view.ts'
import type {
  ArchitectureWorld,
  Bounds,
  ProjectedGroup,
  ProjectedRelationship,
  ProjectionOptions,
  SemanticEdge,
  SemanticItem,
  SemanticLevel,
  WorldElement,
  WorldProjection,
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

type ProjectedElement = ReturnType<typeof projectElements>[number]

/**
 * The element a drawn route attaches to: a named, mark, or campus
 * item on screen, else its nearest such ancestor. Underlay is drawn
 * but never an attach point. Lit walks may fall back to a hidden
 * endpoint so the walk still crosses what this level does not name.
 */
function resolveEndpoint(
  startId: string,
  projectedById: Map<string, ProjectedElement>,
  elementsById: Map<string, WorldElement>,
  viewport: Bounds,
  attachableIds: Set<string>,
  mode: 'attachable' | 'any',
): ProjectedElement | undefined {
  let current: WorldElement | undefined = elementsById.get(startId)
  while (current) {
    const projected = projectedById.get(current.representationId)
    if (projected) {
      if (mode === 'any') return projected
      if (
        projected.display !== 'hidden'
        && attachableIds.has(projected.representationId)
        && visibleIn(projected.cellBounds, viewport)
      ) return projected
    }
    current = current.parent === null ? undefined : elementsById.get(current.parent)
  }
  return undefined
}

function projectElements(
  world: ArchitectureWorld,
  itemsById: Map<string, SemanticItem>,
  transform: ReturnType<typeof transformFor>,
  viewport: Bounds,
  level: SemanticLevel,
) {
  const elements = world.elements.map(element => {
    const item = itemsById.get(element.representationId)
    const display = displayFor(item, element)
    const source = item?.bounds ?? element.bounds
    return { ...element, display, cellBounds: projectBounds(source, transform) }
  })
  for (const element of elements) {
    if (element.display !== 'card' || !leafCard(element)) continue
    const desired = titledCardBounds(element.cellBounds, element)
    const growing = desired.width > element.cellBounds.width
      || desired.height > element.cellBounds.height
    if (!growing) continue
    const placed = keepTitledCardInView(desired, viewport)
    const origin = {
      x: element.cellBounds.x + element.cellBounds.width / 2,
      y: element.cellBounds.y + element.cellBounds.height / 2,
    }
    if (!pointInside(origin, placed)) continue
    const blocked = elements.some(other => {
      return other !== element
        && other.display === 'card'
        && letterName(other, level)
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
  elementsById: Map<string, WorldElement>,
  projectedElements: ReturnType<typeof projectElements>,
  projectedGroups: ProjectedGroup[],
  transform: ReturnType<typeof transformFor>,
  viewport: Bounds,
  edges: Map<string, SemanticEdge>,
  attachableIds: Set<string>,
  litIds: Set<string> | undefined,
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
      .filter(element => element.display === 'card' && letterName(element, level))
      .map(element => ({
        x: element.cellBounds.x - 1,
        y: element.cellBounds.y - 1,
        width: element.cellBounds.width + 2,
        height: element.cellBounds.height + 2,
      })),
    ...projectedElements
      .filter(element => {
        return element.display.endsWith('-boundary') && letterName(element, level)
      })
      .map(element => titleRow(element.cellBounds)),
    ...projectedGroups.map(group => titleRow(group.cellBounds)),
  ]
  const promotedPairs = new Set<string>()
  const attach = (startId: string, mode: 'attachable' | 'any') => {
    return resolveEndpoint(
      startId,
      projectedById,
      elementsById,
      viewport,
      attachableIds,
      mode,
    )
  }
  return world.relationships
    // A lit walk is drawn whole: its legs cross whatever the level hides.
    .filter(relationship => litIds?.has(relationship.id) || edges.has(relationship.id))
    .map(relationship => {
      const edge = edges.get(relationship.id)
      const lit = litIds?.has(relationship.id) === true
      let source = attach(edge?.source ?? relationship.source, 'attachable')
      let target = attach(edge?.target ?? relationship.target, 'attachable')
      if (
        lit
        && (
          source === undefined
          || target === undefined
          || source.representationId === target.representationId
        )
      ) {
        source = attach(relationship.source, 'any')
        target = attach(relationship.target, 'any')
      }
      if (!source || !target) return null
      if (source.representationId === target.representationId) return null
      const sourceBounds = source.cellBounds
      const targetBounds = target.cellBounds
      const promoted = source.representationId !== relationship.source
        || target.representationId !== relationship.target
      if (promoted) {
        // Promoted arrows are synthesized box-to-box; identical pairs
        // would draw the exact same arrow, so only the first survives.
        const pair = `${source.representationId}\0${target.representationId}`
        if (promotedPairs.has(pair)) return null
        promotedPairs.add(pair)
      }
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
  const view = semanticView(world, {
    level,
    ...(focus ? { focusId: focus.representationId } : {}),
  })
  const itemsById = new Map(view.items.map(item => [item.representationId, item]))
  const attachableIds = new Set(
    view.items
      .filter(item => attachableRole(item.role))
      .map(item => item.representationId),
  )
  const edges = new Map(view.edges.map(edge => [edge.id, edge]))
  let transform = transformFor(camera, viewport)
  let elements = projectElements(world, itemsById, transform, viewport, level)
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
      elements = projectElements(world, itemsById, transform, viewport, level)
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
      elementsById,
      elements,
      groups,
      transform,
      viewport,
      edges,
      attachableIds,
      options.litIds,
    ),
  }
}
