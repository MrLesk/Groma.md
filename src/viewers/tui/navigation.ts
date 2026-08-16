import type { PaneVisibility } from './layout.ts'
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

export type ViewerFocus = 'architecture' | 'hierarchy' | 'details'
export type ViewerAction =
  | 'enter'
  | 'leave'
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'tab'
  | 'toggle-hierarchy'
  | 'toggle-details'
  | 'dismiss'

export type FilterInput =
  | { type: 'open' }
  | { type: 'char'; char: string }
  | { type: 'delete' }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'accept' }
  | { type: 'cancel' }

export interface FilterState {
  query: string
  index: number
  /** The view to restore when the filter is cancelled. */
  before: { level: SemanticLevel; currentId?: string }
}

export interface ViewerState {
  level: SemanticLevel
  currentId?: string
  focus: ViewerFocus
  tree: TreeState
  panes: PaneVisibility
  /** First hidden content row of an overflowing details pane. */
  detailsScroll: number
  filter?: FilterState
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
    tree: initialTree(),
    panes: { hierarchy: true, details: true },
    detailsScroll: 0,
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
    // Entering selects a child, so arrows immediately move among siblings.
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
  // Arrows stay inside the boundary: only siblings of the same parent are
  // peers. Leaving the boundary selects the outer item in that direction.
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

/**
 * Selection changes keep the panes in step: the tree cursor follows,
 * its path unhides, and the details scroll returns to the top.
 */
function syncTree(world: ArchitectureWorld, state: ViewerState): ViewerState {
  const path = ancestorsOf(state.currentId, elementsById(world))
  const collapsed = new Set(
    [...state.tree.collapsed].filter(id => !path.has(id)),
  )
  return {
    ...state,
    tree: { ...state.tree, cursor: state.currentId, collapsed },
    detailsScroll: 0,
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
    // Nothing left to expand: Right keeps moving, back onto the map.
    if (!cursor.hasChildren || cursor.expanded) {
      return { ...current, focus: 'architecture' }
    }
    return { ...current, tree: expandRow(current.tree, cursor.id) }
  }
  if (action === 'enter') {
    const element = elementsById(world).get(cursor.id)
    if (!element) return current
    // Enter opens what it selects: a collapsed parent expands in place.
    const tree = cursor.hasChildren && !cursor.expanded
      ? expandRow(current.tree, cursor.id)
      : current.tree
    return syncTree(world, {
      ...current,
      tree,
      level: levelFor(element),
      currentId: element.representationId,
    })
  }
  return current
}

function expandRow(tree: TreeState, id: string): TreeState {
  const expanded = new Set(tree.expanded)
  expanded.add(id)
  const collapsed = new Set(tree.collapsed)
  collapsed.delete(id)
  return { ...tree, expanded, collapsed }
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

  if (action === 'tab') {
    if (current.focus === 'hierarchy') return { ...current, focus: 'architecture' }
    return syncTree(world, {
      ...current,
      focus: 'hierarchy',
      panes: { ...current.panes, hierarchy: true },
    })
  }
  if (action === 'toggle-hierarchy') {
    const hierarchy = !current.panes.hierarchy
    return {
      ...current,
      panes: { ...current.panes, hierarchy },
      focus: !hierarchy && current.focus === 'hierarchy'
        ? 'architecture'
        : current.focus,
    }
  }
  if (action === 'toggle-details') {
    const details = !current.panes.details
    return {
      ...current,
      panes: { ...current.panes, details },
      focus: !details && current.focus === 'details' ? 'architecture' : current.focus,
    }
  }
  if (action === 'dismiss') {
    if (current.focus !== 'architecture') return { ...current, focus: 'architecture' }
    return current
  }
  if (current.focus === 'hierarchy') {
    return reduceTree(world, current, action)
  }
  if (current.focus === 'details') {
    if (action === 'up' || action === 'down') {
      const step = action === 'down' ? 1 : -1
      // The upper bound lives in drawDetails: content height is a render fact.
      return { ...current, detailsScroll: Math.max(0, current.detailsScroll + step) }
    }
    if (action === 'left') return { ...current, focus: 'architecture' }
    return current
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
  if (!resolved.selected) {
    return current
  }
  const moved = moveView(world, current, resolved.selected, action)
  if (moved.level === current.level && moved.currentId === current.currentId) {
    // Nothing lies further that way; the next stop is the side pane.
    if (action === 'left') return reduceViewer(world, current, 'tab')
    if (action === 'right') {
      return {
        ...current,
        focus: 'details',
        panes: { ...current.panes, details: true },
      }
    }
  }
  return syncTree(world, { ...current, ...moved })
}

export function filterMatches(
  world: ArchitectureWorld,
  query: string,
): WorldElement[] {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) return []
  return world.elements
    .filter(element => element.name.toLowerCase().includes(needle))
    .sort(compareElements)
}

/** The current match drives selection live; no match leaves the view alone. */
function followMatch(world: ArchitectureWorld, state: ViewerState): ViewerState {
  const filter = state.filter
  if (!filter) return state
  const match = filterMatches(world, filter.query)[filter.index]
  if (!match) return state
  return syncTree(world, {
    ...state,
    level: levelFor(match),
    currentId: match.representationId,
  })
}

export function reduceFilter(
  world: ArchitectureWorld,
  state: ViewerState,
  input: FilterInput,
): ViewerState {
  if (input.type === 'open') {
    return {
      ...state,
      filter: {
        query: '',
        index: 0,
        before: { level: state.level, currentId: state.currentId },
      },
    }
  }
  const filter = state.filter
  if (!filter) return state
  if (input.type === 'char') {
    return followMatch(world, {
      ...state,
      filter: { ...filter, query: filter.query + input.char, index: 0 },
    })
  }
  if (input.type === 'delete') {
    return followMatch(world, {
      ...state,
      filter: { ...filter, query: filter.query.slice(0, -1), index: 0 },
    })
  }
  if (input.type === 'next' || input.type === 'previous') {
    const count = filterMatches(world, filter.query).length
    if (count === 0) return state
    const step = input.type === 'next' ? 1 : -1
    const index = (filter.index + step + count) % count
    return followMatch(world, { ...state, filter: { ...filter, index } })
  }
  if (input.type === 'accept') {
    return { ...state, filter: undefined }
  }
  return syncTree(world, {
    ...state,
    filter: undefined,
    level: filter.before.level,
    currentId: filter.before.currentId,
  })
}
