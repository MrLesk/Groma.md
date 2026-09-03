import type { AnnotatedElement, Bounds, C4Kind, TerminalLevel } from '../../types.ts'
import type { TerminalViewModel } from './model.ts'
import type { MapDirection, ViewerState } from './navigation.ts'
import { mapAnchors } from './projection.ts'
import { firstBuilding, neighbourContainer } from './projection-container.ts'
import { rootStops } from './projection-root.ts'

function elementsById(model: TerminalViewModel): Map<string, AnnotatedElement> {
  return new Map(model.elements.map(element => [element.representationId, element]))
}

export function ancestorOfKind(
  element: AnnotatedElement | undefined,
  kind: C4Kind,
  byId: Map<string, AnnotatedElement>,
): AnnotatedElement | undefined {
  let current = element
  while (current && current.kind !== kind) {
    current = current.parent === null ? undefined : byId.get(current.parent)
  }
  return current
}

export function canEnter(element: AnnotatedElement): boolean {
  return !element.external
    && element.kind === 'container'
    && element.children.length > 0
}

/** Opens a container map on its first building in map order. */
export function enterView(
  model: TerminalViewModel,
  element: AnnotatedElement,
): Pick<ViewerState, 'level' | 'currentId'> {
  return { level: 'components', currentId: firstBuilding(model, element) ?? element.representationId }
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

function nearestInDirection(
  anchors: ReadonlyMap<string, Bounds>,
  selectedId: string,
  originBounds: Bounds,
  direction: MapDirection,
  sameLane = false,
): string | undefined {
  const origin = directionalBounds(originBounds, direction)
  let best: { id: string; cross: number; forward: number; distance: number } | undefined
  for (const [id, bounds] of anchors) {
    if (id === selectedId) continue
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

/** Root stops: Up and Down walk an island's rows with the system one stop above them; Left and Right cross to the neighbouring island. */
function moveRoot(model: TerminalViewModel, currentId: string, direction: MapDirection): string | undefined {
  const islands = rootStops(model)
  const at = islands.findIndex(stops => stops.includes(currentId))
  if (at < 0) return undefined
  const stops = islands[at]!
  const index = stops.indexOf(currentId)
  if (direction === 'up') return stops[index - 1]
  if (direction === 'down') return stops[index + 1]
  return islands[at + (direction === 'right' ? 1 : -1)]?.[0]
}

/** Reading order, band by band and line by line; past the first or last building, the neighbouring container's first. */
function readOn(model: TerminalViewModel, anchors: ReadonlyMap<string, Bounds>, selected: AnnotatedElement, direction: 'left' | 'right'): string | undefined {
  const keys = [...anchors.keys()]
  const next = keys[keys.indexOf(selected.representationId) + (direction === 'right' ? 1 : -1)]
  if (next !== undefined) return next
  const container = ancestorOfKind(selected, 'container', elementsById(model))
  const neighbour = container === undefined ? undefined : neighbourContainer(model, container, direction)
  return neighbour === undefined ? undefined : firstBuilding(model, neighbour)
}

/**
 * In a container map Left and Right walk the buildings in reading order and cross to the neighbouring
 * container past the first or last one; Up and Down take the nearest building in that direction, a same-lane one first.
 */
export function moveView(
  model: TerminalViewModel,
  state: ViewerState,
  selected: AnnotatedElement,
  direction: MapDirection,
): Pick<ViewerState, 'level' | 'currentId'> {
  const level = state.level
  if (level === 'context') {
    return { level, currentId: moveRoot(model, selected.representationId, direction) ?? selected.representationId }
  }
  const anchors = mapAnchors(model, level, selected.representationId, state.mapWidth)
  const origin = anchors.get(selected.representationId)
  if (origin === undefined) return { level, currentId: selected.representationId }
  const next = direction === 'left' || direction === 'right'
    ? readOn(model, anchors, selected, direction)
    : nearestInDirection(anchors, selected.representationId, origin, direction, true)
      ?? nearestInDirection(anchors, selected.representationId, origin, direction)
  return { level, currentId: next ?? selected.representationId }
}
