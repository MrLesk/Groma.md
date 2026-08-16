import { ancestorsOf, compareElements, initialTree, treeRows } from './tree.ts'
import type { TreeState } from './tree.ts'
import type {
  ArchitectureWorld,
  Bounds,
  C4Kind,
  Point,
  SemanticLevel,
  WorldElement,
} from '../../types.ts'

export type ViewerFocus = 'architecture' | 'zoom' | 'hierarchy'
const zoomSlots = [
  'leave',
  'context',
  'containers',
  'components',
  'enter',
] as const
export type ZoomSlot = (typeof zoomSlots)[number]
export type ViewerAction =
  | 'enter'
  | 'leave'
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'zoom'
  | 'tab'
  | 'dismiss'

export interface ViewerState {
  level: SemanticLevel
  currentId?: string
  focus: ViewerFocus
  zoomSlot: ZoomSlot
  tree: TreeState
}

function elementsById(world: ArchitectureWorld): Map<string, WorldElement> {
  return new Map(world.elements.map(element => [element.representationId, element]))
}

export function defaultSelection(
  world: ArchitectureWorld,
  level: SemanticLevel,
): WorldElement | undefined {
  const ranked = [...world.elements].sort(compareElements)
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
    zoomSlot: 'context',
    tree: initialTree(),
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

function enterView(
  world: ArchitectureWorld,
  element: WorldElement,
): Pick<ViewerState, 'level' | 'currentId'> {
  if (element.kind === 'system') {
    return { level: 'containers', currentId: element.representationId }
  }
  const component = firstComponentUnder(element, elementsById(world))
  return {
    level: 'components',
    currentId: component?.representationId ?? element.representationId,
  }
}

function jumpView(
  world: ArchitectureWorld,
  selected: WorldElement | undefined,
  target: SemanticLevel,
): Pick<ViewerState, 'level' | 'currentId'> {
  const byId = elementsById(world)
  if (target === 'context') {
    let top = selected
    while (top && top.parent !== null) {
      const parent = byId.get(top.parent)
      if (!parent) break
      top = parent
    }
    return { level: 'context', currentId: top?.representationId }
  }
  if (target === 'containers') {
    const system = ancestorOfKind(selected, 'system', byId)
    if (!system || system.external) {
      return { level: 'context', currentId: selected?.representationId }
    }
    return { level: 'containers', currentId: system.representationId }
  }
  const container = ancestorOfKind(selected, 'container', byId)
    ?? firstChildOfKind(ancestorOfKind(selected, 'system', byId), 'container', byId)
  if (!container) return { level: 'context', currentId: selected?.representationId }
  const component = selected?.kind === 'component'
    ? selected
    : firstComponentUnder(container, byId)
      ?? firstComponentUnder(ancestorOfKind(selected, 'system', byId), byId)
  return {
    level: 'components',
    currentId: component?.representationId ?? container.representationId,
  }
}

function moveZoomSlot(slot: ZoomSlot, direction: 'left' | 'right'): ZoomSlot {
  const index = zoomSlots.indexOf(slot)
  const next = direction === 'right' ? index + 1 : index - 1
  return zoomSlots[Math.max(0, Math.min(zoomSlots.length - 1, next))]!
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

/** Selection changes keep the tree in step: cursor follows, its path unhides. */
function syncTree(world: ArchitectureWorld, state: ViewerState): ViewerState {
  const path = ancestorsOf(state.currentId, elementsById(world))
  const collapsed = new Set(
    [...state.tree.collapsed].filter(id => !path.has(id)),
  )
  return {
    ...state,
    tree: { ...state.tree, cursor: state.currentId, collapsed },
  }
}

function reduceTree(
  world: ArchitectureWorld,
  current: ViewerState,
  action: ViewerAction,
): ViewerState {
  const rows = treeRows(world, current.currentId, current.tree)
  const index = Math.max(0, rows.findIndex(row => row.id === current.tree.cursor))
  const cursor = rows[index]
  if (!cursor) return current
  if (action === 'up' || action === 'down') {
    const step = action === 'down' ? 1 : -1
    const next = rows[Math.max(0, Math.min(rows.length - 1, index + step))]!
    return { ...current, tree: { ...current.tree, cursor: next.id } }
  }
  if (action === 'left') {
    if (cursor.expanded) {
      const collapsed = new Set(current.tree.collapsed)
      collapsed.add(cursor.id)
      const expanded = new Set(current.tree.expanded)
      expanded.delete(cursor.id)
      return { ...current, tree: { ...current.tree, expanded, collapsed } }
    }
    const parent = elementsById(world).get(cursor.id)?.parent
    if (parent === null || parent === undefined) return current
    return { ...current, tree: { ...current.tree, cursor: parent } }
  }
  if (action === 'right') {
    if (!cursor.hasChildren || cursor.expanded) return current
    const collapsed = new Set(current.tree.collapsed)
    collapsed.delete(cursor.id)
    const expanded = new Set(current.tree.expanded)
    expanded.add(cursor.id)
    return { ...current, tree: { ...current.tree, expanded, collapsed } }
  }
  if (action === 'enter') {
    const element = elementsById(world).get(cursor.id)
    if (!element) return current
    return syncTree(world, {
      ...current,
      level: levelFor(element),
      currentId: element.representationId,
    })
  }
  return current
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
      zoomSlot: current.level,
    }
  }
  if (action === 'tab') {
    if (current.focus === 'hierarchy') return { ...current, focus: 'architecture' }
    return syncTree(world, { ...current, focus: 'hierarchy' })
  }
  if (action === 'dismiss') {
    if (current.focus !== 'architecture') return { ...current, focus: 'architecture' }
    return current
  }
  if (current.focus === 'hierarchy') {
    return reduceTree(world, current, action)
  }
  if (current.focus === 'zoom' && (action === 'left' || action === 'right')) {
    return { ...current, zoomSlot: moveZoomSlot(current.zoomSlot, action) }
  }
  if (current.focus === 'zoom' && action === 'enter') {
    if (current.zoomSlot === 'leave' || current.zoomSlot === 'enter') {
      return current
    }
    return syncTree(world, {
      ...current,
      ...jumpView(world, resolved.selected, current.zoomSlot),
    })
  }
  if (action === 'enter') {
    const next = resolved.selected && canEnter(resolved.selected)
      ? enterView(world, resolved.selected)
      : { level: current.level, currentId: current.currentId }
    return syncTree(world, { ...current, ...next })
  }
  if (action === 'leave') {
    return syncTree(world, { ...current, ...leaveView(world, current, resolved.selected) })
  }
  if (current.focus !== 'architecture' || !resolved.selected) {
    return current
  }
  return syncTree(world, {
    ...current,
    ...moveView(world, current, resolved.selected, action),
  })
}
