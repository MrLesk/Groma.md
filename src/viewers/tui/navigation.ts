import type {
  ArchitectureWorld,
  Bounds,
  C4Kind,
  Point,
  SemanticLevel,
  WorldElement,
} from '../../types.ts'

export type ViewerFocus = 'architecture' | 'zoom'
export type ViewerPanel = 'closed' | 'side' | 'full'
export type ViewerAction =
  | 'enter'
  | 'leave'
  | 'inspect'
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'zoom'
  | 'flip'
  | 'dismiss'

export interface ViewerState {
  level: SemanticLevel
  currentId?: string
  focus: ViewerFocus
  panel: ViewerPanel
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function elementsById(world: ArchitectureWorld): Map<string, WorldElement> {
  return new Map(world.elements.map(element => [element.representationId, element]))
}

export function defaultSelection(
  world: ArchitectureWorld,
  level: SemanticLevel,
): WorldElement | undefined {
  const ranked = [...world.elements].sort((left, right) => {
    return compareStrings(left.id, right.id)
      || compareStrings(left.representationId, right.representationId)
  })
  if (level === 'context') {
    return ranked.find(element => element.kind === 'system' && !element.external)
  }
  if (level === 'containers') {
    return ranked.find(element => element.kind === 'container')
  }
  return ranked.find(element => element.kind === 'component')
}

export function ancestorOfKind(
  element: WorldElement | undefined,
  kind: C4Kind,
  byId: Map<string, WorldElement>,
): WorldElement | undefined {
  let current = element
  while (current && current.kind !== kind) {
    current = current.parent === null ? undefined : byId.get(current.parent)
  }
  return current
}

export function initialState(world: ArchitectureWorld): ViewerState {
  return {
    level: 'context',
    currentId: defaultSelection(world, 'context')?.representationId,
    focus: 'architecture',
    panel: 'closed',
  }
}

function resolve(
  world: ArchitectureWorld,
  state: ViewerState,
): { selected?: WorldElement; currentId?: string } {
  const byId = elementsById(world)
  const selected = state.currentId === undefined
    ? defaultSelection(world, state.level)
    : byId.get(state.currentId) ?? defaultSelection(world, state.level)
  return { selected, currentId: selected?.representationId }
}

function canEnter(element: WorldElement): boolean {
  return !element.external
    && (element.kind === 'system' || element.kind === 'container')
    && element.children.length > 0
}

function enterView(
  element: WorldElement,
): Pick<ViewerState, 'level' | 'currentId'> {
  return {
    level: element.kind === 'system' ? 'containers' : 'components',
    currentId: element.representationId,
  }
}

function leaveView(
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

function levelFor(element: WorldElement): SemanticLevel {
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

function moveView(
  world: ArchitectureWorld,
  state: ViewerState,
  selected: WorldElement,
  direction: 'up' | 'down' | 'left' | 'right',
): Pick<ViewerState, 'level' | 'currentId'> {
  const current = { level: state.level, currentId: selected.representationId }
  const same = sameLevelItems(world, state.level).filter(element => {
    return element.representationId !== selected.representationId
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

export function reduceViewer(
  world: ArchitectureWorld,
  state: ViewerState,
  action: ViewerAction,
): ViewerState {
  const resolved = resolve(world, state)
  const current: ViewerState = {
    ...state,
    currentId: resolved.currentId,
  }

  if (action === 'zoom') {
    return {
      ...current,
      focus: current.focus === 'zoom' ? 'architecture' : 'zoom',
    }
  }
  if (action === 'flip') {
    if (current.panel === 'closed') return current
    return { ...current, panel: current.panel === 'full' ? 'side' : 'full' }
  }
  if (action === 'dismiss') {
    if (current.panel === 'closed') return current
    return { ...current, panel: 'closed' }
  }
  if (action === 'enter' || action === 'inspect') {
    const next = resolved.selected && canEnter(resolved.selected)
      ? enterView(resolved.selected)
      : { level: current.level, currentId: current.currentId }
    return {
      ...current,
      ...next,
      panel: action === 'inspect' && current.panel === 'closed' ? 'side' : current.panel,
    }
  }
  if (action === 'leave') {
    return { ...current, ...leaveView(world, current, resolved.selected) }
  }
  if (current.focus !== 'architecture' || current.panel !== 'closed' || !resolved.selected) {
    return current
  }
  return { ...current, ...moveView(world, current, resolved.selected, action) }
}
