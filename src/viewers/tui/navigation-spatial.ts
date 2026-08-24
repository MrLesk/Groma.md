import { compareElements } from '../../element-order.ts'
import { ancestorOfKind, type ViewerState } from './navigation.ts'
import type {
  ArchitectureWorld,
  Bounds,
  C4Kind,
  Point,
  TerminalLevel,
  WorldElement,
} from '../../types.ts'

function elementsById(world: ArchitectureWorld): Map<string, WorldElement> {
  return new Map(world.elements.map(element => [element.representationId, element]))
}

function childElements(
  element: WorldElement | undefined,
  byId: Map<string, WorldElement>,
): WorldElement[] {
  if (!element) return []
  return element.children
    .map(id => byId.get(id))
    .filter((child): child is WorldElement => child !== undefined)
    .sort(compareElements)
}

function firstChildOfKind(
  element: WorldElement | undefined,
  kind: C4Kind,
  byId: Map<string, WorldElement>,
): WorldElement | undefined {
  return childElements(element, byId).find(child => child.kind === kind)
}

function firstComponentUnder(
  element: WorldElement | undefined,
  byId: Map<string, WorldElement>,
): WorldElement | undefined {
  if (!element) return undefined
  if (element.kind === 'component') return element
  const direct = firstChildOfKind(element, 'component', byId)
  if (direct) return direct
  for (const child of childElements(element, byId)) {
    const found = firstComponentUnder(child, byId)
    if (found) return found
  }
}

export function canEnter(element: WorldElement): boolean {
  return !element.external
    && element.kind === 'container'
    && element.children.length > 0
}

export function enterView(
  world: ArchitectureWorld,
  element: WorldElement,
): Pick<ViewerState, 'level' | 'currentId'> {
  const component = firstComponentUnder(element, elementsById(world))
  return {
    level: 'components',
    currentId: component?.representationId ?? element.representationId,
  }
}

export function leaveView(
  world: ArchitectureWorld,
  state: ViewerState,
  selected: WorldElement | undefined,
): Pick<ViewerState, 'level' | 'currentId'> {
  if (state.level === 'context') {
    return { level: state.level, currentId: selected?.representationId }
  }
  const byId = elementsById(world)
  const container = ancestorOfKind(selected, 'container', byId)
  return {
    level: 'context',
    currentId: container?.representationId ?? selected?.representationId,
  }
}

function scopeItems(
  world: ArchitectureWorld,
  level: TerminalLevel,
  selected: WorldElement,
): WorldElement[] {
  if (level === 'context') {
    return world.elements.filter(element => element.kind !== 'component')
  }
  const byId = elementsById(world)
  const container = ancestorOfKind(selected, 'container', byId)
  if (!container) return []
  return [container, ...world.elements.filter(element => {
    return element.kind === 'component' && element.parent === container.representationId
  })]
}

export function levelFor(element: WorldElement): TerminalLevel {
  if (element.kind === 'component') return 'components'
  return 'context'
}

function center(bounds: Bounds): Point {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  }
}

function descendsFrom(
  element: WorldElement,
  ancestorId: string,
  byId: Map<string, WorldElement>,
): boolean {
  let current: WorldElement | undefined = element
  while (current?.parent !== null) {
    if (current?.parent === ancestorId) return true
    current = current?.parent === undefined ? undefined : byId.get(current.parent)
  }
  return false
}

function inDirection(
  from: Point,
  to: Point,
  direction: 'up' | 'down' | 'left' | 'right',
): boolean {
  if (direction === 'right') return to.x > from.x
  if (direction === 'left') return to.x < from.x
  if (direction === 'down') return to.y > from.y
  return to.y < from.y
}

function nearestInDirection(
  from: WorldElement,
  candidates: WorldElement[],
  direction: 'up' | 'down' | 'left' | 'right',
): WorldElement | undefined {
  const origin = center(from.bounds)
  let best: WorldElement | undefined
  let bestDistance = Infinity
  for (const candidate of candidates) {
    const point = center(candidate.bounds)
    if (!inDirection(origin, point, direction)) continue
    const dx = point.x - origin.x
    const dy = point.y - origin.y
    const distance = dx * dx + dy * dy
    if (
      distance < bestDistance
      || (
        distance === bestDistance
        && best !== undefined
        && candidate.representationId < best.representationId
      )
    ) {
      best = candidate
      bestDistance = distance
    }
  }
  return best
}

export function moveView(
  world: ArchitectureWorld,
  state: ViewerState,
  selected: WorldElement,
  direction: 'up' | 'down' | 'left' | 'right',
): Pick<ViewerState, 'level' | 'currentId'> {
  const current = { level: state.level, currentId: selected.representationId }
  const byId = elementsById(world)
  const candidates = scopeItems(world, state.level, selected).filter(element => {
    return element.representationId !== selected.representationId
      && !descendsFrom(element, selected.representationId, byId)
      && !descendsFrom(selected, element.representationId, byId)
  })
  const hit = nearestInDirection(selected, candidates, direction)
  return hit === undefined
    ? current
    : { level: state.level, currentId: hit.representationId }
}
