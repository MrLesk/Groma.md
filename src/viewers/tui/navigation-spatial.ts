import { compareSemanticElements } from '../../element-order.ts'
import type { AnnotatedElement, Bounds, C4Kind, TerminalLevel } from '../../types.ts'
import type { TerminalViewModel } from './model.ts'
import { ancestorOfKind, type MapDirection, type ViewerState } from './navigation.ts'
import { mapAnchors } from './projection.ts'

function elementsById(model: TerminalViewModel): Map<string, AnnotatedElement> {
  return new Map(model.elements.map(element => [element.representationId, element]))
}

function children(
  element: AnnotatedElement | undefined,
  byId: ReadonlyMap<string, AnnotatedElement>,
): AnnotatedElement[] {
  if (!element) return []
  return element.children
    .flatMap(id => {
      const child = byId.get(id)
      return child === undefined ? [] : [child]
    })
    .sort(compareSemanticElements)
}

function firstChildOfKind(
  element: AnnotatedElement | undefined,
  kind: C4Kind,
  byId: ReadonlyMap<string, AnnotatedElement>,
): AnnotatedElement | undefined {
  return children(element, byId).find(child => child.kind === kind)
}

export function canEnter(element: AnnotatedElement): boolean {
  return !element.external
    && element.kind === 'container'
    && element.children.length > 0
}

export function enterView(
  model: TerminalViewModel,
  element: AnnotatedElement,
): Pick<ViewerState, 'level' | 'currentId'> {
  const component = firstChildOfKind(element, 'component', elementsById(model))
  return {
    level: 'components',
    currentId: component?.representationId ?? element.representationId,
  }
}

export function leaveView(
  model: TerminalViewModel,
  state: ViewerState,
  selected: AnnotatedElement | undefined,
): Pick<ViewerState, 'level' | 'currentId'> {
  if (state.level === 'context') {
    return { level: state.level, currentId: selected?.representationId }
  }
  const container = ancestorOfKind(selected, 'container', elementsById(model))
  return {
    level: 'context',
    currentId: container?.representationId ?? selected?.representationId,
  }
}

export function levelFor(element: AnnotatedElement): TerminalLevel {
  return element.kind === 'component' ? 'components' : 'context'
}

interface DirectionalBounds {
  start: number
  end: number
  crossStart: number
  crossEnd: number
}

/** Makes every direction increase from start to end along one primary axis. */
function directionalBounds(bounds: Bounds, direction: MapDirection): DirectionalBounds {
  const horizontal = direction === 'left' || direction === 'right'
  const reversed = direction === 'left' || direction === 'up'
  const rawStart = horizontal ? bounds.x : bounds.y
  const rawEnd = rawStart + (horizontal ? bounds.width : bounds.height)
  return {
    start: reversed ? -rawEnd : rawStart,
    end: reversed ? -rawStart : rawEnd,
    crossStart: horizontal ? bounds.y : bounds.x,
    crossEnd: (horizontal ? bounds.y + bounds.height : bounds.x + bounds.width),
  }
}

function middle(start: number, end: number): number {
  return (start + end) / 2
}

function inDirection(from: DirectionalBounds, to: DirectionalBounds): boolean {
  return middle(to.start, to.end) > middle(from.start, from.end)
}

function perpendicularGap(from: DirectionalBounds, to: DirectionalBounds): number {
  return Math.max(
    0,
    Math.max(from.crossStart, to.crossStart) - Math.min(from.crossEnd, to.crossEnd),
  )
}

function crossesPerpendicularCentre(
  from: DirectionalBounds,
  to: DirectionalBounds,
): boolean {
  const coordinate = middle(from.crossStart, from.crossEnd)
  return coordinate >= to.crossStart && coordinate <= to.crossEnd
}

function forwardEdgeGap(from: DirectionalBounds, to: DirectionalBounds): number {
  return Math.max(0, to.start - from.end)
}

function nearestChildAcrossBoundary(
  anchors: ReadonlyMap<string, Bounds>,
  elements: ReadonlyMap<string, AnnotatedElement>,
  parentId: string,
  originBounds: Bounds,
  direction: MapDirection,
): string | undefined {
  const origin = directionalBounds(originBounds, direction)
  return [...anchors]
    .filter(([id, bounds]) => {
      return elements.get(id)?.parent === parentId
        && inDirection(origin, directionalBounds(bounds, direction))
    })
    .map(([id, bounds]) => {
      const candidate = directionalBounds(bounds, direction)
      return {
        id,
        edge: forwardEdgeGap(origin, candidate),
        missesCentre: Number(!crossesPerpendicularCentre(origin, candidate)),
        cross: perpendicularGap(origin, candidate),
        perpendicular: Math.abs(
          middle(candidate.crossStart, candidate.crossEnd)
          - middle(origin.crossStart, origin.crossEnd),
        ),
      }
    })
    .sort((left, right) => left.edge - right.edge
      || left.missesCentre - right.missesCentre
      || left.cross - right.cross
      || left.perpendicular - right.perpendicular
      || left.id.localeCompare(right.id))[0]?.id
}

function nearestInDirection(
  anchors: ReadonlyMap<string, Bounds>,
  selectedId: string,
  originBounds: Bounds,
  direction: MapDirection,
  include: (id: string) => boolean,
  sameLane = false,
): string | undefined {
  const origin = directionalBounds(originBounds, direction)
  let best: { id: string; cross: number; forward: number; distance: number } | undefined
  for (const [id, bounds] of anchors) {
    if (id === selectedId || !include(id)) continue
    const candidate = directionalBounds(bounds, direction)
    if (!inDirection(origin, candidate)) continue
    const cross = perpendicularGap(origin, candidate)
    if (sameLane && cross > 0) continue
    const forward = middle(candidate.start, candidate.end) - middle(origin.start, origin.end)
    const perpendicular = middle(candidate.crossStart, candidate.crossEnd)
      - middle(origin.crossStart, origin.crossEnd)
    const distance = forward * forward + perpendicular * perpendicular
    if (
      best === undefined
      || cross < best.cross
      || (cross === best.cross && forward < best.forward)
      || (cross === best.cross && forward === best.forward && distance < best.distance)
      || (
        cross === best.cross
        && forward === best.forward
        && distance === best.distance
        && id < best.id
      )
    ) {
      best = { id, cross, forward, distance }
    }
  }
  return best?.id
}

export function moveView(
  model: TerminalViewModel,
  state: ViewerState,
  selected: AnnotatedElement,
  direction: MapDirection,
): Pick<ViewerState, 'level' | 'currentId'> {
  const anchors = mapAnchors(model, state.level, selected.representationId)
  const originBounds = anchors.get(selected.representationId)
  if (!originBounds) return { level: state.level, currentId: selected.representationId }
  const byId = elementsById(model)
  const previous = state.mapStep?.direction === direction
    ? byId.get(state.mapStep.fromId)
    : undefined
  const previousBounds = previous === undefined
    ? undefined
    : anchors.get(previous.representationId)
  if (
    previous !== undefined
    && previousBounds !== undefined
    && previous.parent !== selected.representationId
  ) {
    const child = nearestChildAcrossBoundary(
      anchors,
      byId,
      selected.representationId,
      previousBounds,
      direction,
    )
    if (child !== undefined) return { level: state.level, currentId: child }
  }
  const sibling = nearestInDirection(
    anchors,
    selected.representationId,
    originBounds,
    direction,
    id => byId.get(id)?.parent === selected.parent,
    true,
  )
  const parent = selected.parent !== null && anchors.has(selected.parent)
    ? selected.parent
    : undefined
  const next = sibling ?? parent ?? nearestInDirection(
    anchors,
    selected.representationId,
    originBounds,
    direction,
    () => true,
  )
  return {
    level: state.level,
    currentId: next ?? selected.representationId,
  }
}
