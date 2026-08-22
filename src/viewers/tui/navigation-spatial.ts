import { compareElements } from '../../element-order.ts'
import { ancestorOfKind, type ViewerState } from './navigation.ts'
import type {
  ArchitectureWorld,
  Bounds,
  C4Kind,
  Point,
  SemanticLevel,
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
    && (element.kind === 'system' || element.kind === 'container')
    && element.children.length > 0
}

export function enterView(
  world: ArchitectureWorld,
  element: WorldElement,
): Pick<ViewerState, 'level' | 'currentId'> {
  if (element.kind === 'system') {
    const container = firstChildOfKind(element, 'container', elementsById(world))
    return {
      level: 'containers',
      currentId: container?.representationId ?? element.representationId,
    }
  }
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
  if (state.level === 'containers') {
    const system = ancestorOfKind(selected, 'system', byId)
    return { level: 'context', currentId: system?.representationId ?? selected?.representationId }
  }
  const container = ancestorOfKind(selected, 'container', byId)
  return {
    level: 'containers',
    currentId: container?.representationId ?? selected?.representationId,
  }
}

function sameLevelItems(world: ArchitectureWorld, level: SemanticLevel): WorldElement[] {
  if (level === 'context') return world.elements.filter(element => element.parent === null)
  if (level === 'containers') {
    return world.elements.filter(element => element.kind === 'container')
  }
  return world.elements.filter(element => element.kind === 'component')
}

function higherLevelItems(world: ArchitectureWorld, level: SemanticLevel): WorldElement[] {
  if (level === 'context') return []
  if (level === 'containers') {
    return world.elements.filter(element => element.parent === null)
  }
  return world.elements.filter(element => {
    return element.kind === 'container' || element.parent === null
  })
}

export function levelFor(element: WorldElement): SemanticLevel {
  if (element.kind === 'component') return 'components'
  if (element.kind === 'container') return 'containers'
  return 'context'
}

function ancestorIds(
  element: WorldElement,
  byId: Map<string, WorldElement>,
): Set<string> {
  const ids = new Set<string>()
  let current: WorldElement | undefined = element
  while (current) {
    ids.add(current.representationId)
    current = current.parent === null ? undefined : byId.get(current.parent)
  }
  return ids
}

function center(bounds: Bounds): Point {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  }
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
  const same = sameLevelItems(world, state.level).filter(element => {
    return element.representationId !== selected.representationId
      && element.parent === selected.parent
  })
  const sameHit = nearestInDirection(selected, same, direction)
  if (sameHit) return { level: state.level, currentId: sameHit.representationId }

  const excluded = ancestorIds(selected, elementsById(world))
  const higher = higherLevelItems(world, state.level).filter(element => {
    return !excluded.has(element.representationId)
  })
  const higherHit = nearestInDirection(selected, higher, direction)
  if (!higherHit) return current
  return { level: levelFor(higherHit), currentId: higherHit.representationId }
}
