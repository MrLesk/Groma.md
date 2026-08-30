import {
  actionLegs,
  pickableActions,
  travelledBy,
  worldCommands,
} from '../action-path.ts'
import type { PaneVisibility } from './layout.ts'
import {
  canEnter,
  enterView,
  leaveView,
  levelFor,
  moveView,
} from './navigation-spatial.ts'
import { compareSemanticElements } from '../../element-order.ts'
import type { ArchitectureSearch } from '../../search.ts'
import { ancestorsOf, initialTree, semanticTreeRows } from './tree.ts'
import type { TreeState } from './tree.ts'
import type { TerminalViewModel } from './model.ts'
import { initialWorkFocus } from './work/model.ts'
import type { WorkFocus } from './work/model.ts'
import { reduceWorkFocus } from './work/navigation.ts'
import type {
  AnnotatedElement,
  AnnotatedRelationship,
  C4Kind,
  TerminalLevel,
} from '../../types.ts'

export type ViewerFocus = 'architecture' | 'hierarchy' | 'details'
export type DetailsTab = 'what' | 'how'
export type MapDirection = 'up' | 'down' | 'left' | 'right'
export type ViewerAction =
  | 'enter'
  | 'leave'
  | MapDirection
  | 'tab'
  | 'toggle-details'
  | 'dismiss'
  | 'clear-action'
  | 'step-action'
  | 'toggle-details-tab'
  | 'toggle-work'

export type SearchInput =
  | { type: 'open' }
  | { type: 'char'; char: string }
  | { type: 'delete' }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'accept' }
  | { type: 'cancel' }

export interface SearchState {
  query: string
  index: number
  matches: AnnotatedElement[]
  /** The view to restore when search is cancelled. */
  before: { level: TerminalLevel; currentId?: string }
}

export interface ViewerState {
  level: TerminalLevel
  currentId?: string
  focus: ViewerFocus
  tree: TreeState
  panes: PaneVisibility
  /** First hidden content row of an overflowing details pane. */
  detailsScroll: number
  detailsTab: DetailsTab
  /** One actor command. Survives leaving the actor until x or another pick. */
  activeActionId?: string
  /** The actor the command was picked from; scopes the walk's approach to them. */
  activeActionActorId?: string
  /** The traced leg of the active command's walk; absent while the whole walk shows. */
  actionStep?: number
  /** The command row the details cursor rests on; Enter picks it. */
  actionCursor?: string
  search?: SearchState
  /** The map edge just crossed, used to step through a containing boundary. */
  mapStep?: { fromId: string; direction: MapDirection }
  /** Present only while the terminal is using its task-focused side panes. */
  work?: WorkFocus
}

function elementsById(world: TerminalViewModel): Map<string, AnnotatedElement> {
  return new Map(world.elements.map(element => [element.representationId, element]))
}

export function defaultSelection(
  world: TerminalViewModel,
  level: TerminalLevel,
): AnnotatedElement | undefined {
  const ranked = [...world.elements].sort(compareSemanticElements)
  if (level === 'context') {
    return ranked.find(element => element.kind === 'system' && !element.external)
  }
  return ranked.find(element => element.kind === 'component')
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

export function initialState(world: TerminalViewModel): ViewerState {
  return {
    level: 'context',
    currentId: defaultSelection(world, 'context')?.representationId,
    focus: 'architecture',
    tree: initialTree(),
    panes: { details: true },
    detailsScroll: 0,
    detailsTab: 'what',
  }
}

/** The pickable command rows the details pane shows for its tab. */
export function detailsCommands(
  world: TerminalViewModel,
  state: Pick<ViewerState, 'currentId' | 'detailsTab'>,
): AnnotatedRelationship[] {
  if (state.detailsTab === 'how') {
    return state.currentId === undefined ? [] : travelledBy(state.currentId, world)
  }
  return pickableActions(state.currentId, world)
}

/** A lit walk: its command and, for an actor's own pick, the picker. */
export interface LitAction {
  id?: string
  actorId?: string
}

/**
 * The walk the map lights: while the details cursor rests on a command
 * that row is previewed, otherwise the committed pick shows.
 */
export function litAction(
  world: TerminalViewModel,
  state: ViewerState,
): LitAction {
  if (state.work !== undefined) return {}
  if (state.focus === 'details' && state.actionCursor !== undefined) {
    const browsing = detailsCommands(world, state)
      .some(command => command.id === state.actionCursor)
    if (browsing) {
      return {
        id: state.actionCursor,
        actorId: state.detailsTab === 'what' ? state.currentId : undefined,
      }
    }
  }
  return { id: state.activeActionId, actorId: state.activeActionActorId }
}

function resolve(
  world: TerminalViewModel,
  state: ViewerState,
): { selected?: AnnotatedElement; currentId?: string } {
  const byId = elementsById(world)
  const selected = state.currentId === undefined
    ? defaultSelection(world, state.level)
    : byId.get(state.currentId) ?? defaultSelection(world, state.level)
  return { selected, currentId: selected?.representationId }
}

/**
 * Selection changes keep the panes in step: the tree cursor follows,
 * its path unhides, and the details scroll returns to the top.
 */
function syncTree(world: TerminalViewModel, state: ViewerState): ViewerState {
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
  world: TerminalViewModel,
  current: ViewerState,
  action: ViewerAction,
): ViewerState {
  // One cursor space: the flow rows sit above the tree rows.
  const commands = worldCommands(world)
  const rows = semanticTreeRows(world, current.currentId === undefined ? [] : [current.currentId], current.tree)
  const ids = [...commands.map(command => command.id), ...rows.map(row => row.id)]
  if (ids.length === 0) return current
  const index = Math.max(0, ids.indexOf(current.tree.cursor ?? ''))
  if (action === 'up' || action === 'down') {
    const step = action === 'down' ? 1 : -1
    const next = ids[Math.max(0, Math.min(ids.length - 1, index + step))]!
    return { ...current, tree: { ...current.tree, cursor: next } }
  }
  if (index < commands.length) {
    if (action === 'enter') {
      return {
        ...current,
        activeActionId: commands[index]!.id,
        activeActionActorId: undefined,
        actionStep: undefined,
      }
    }
    if (action === 'right') return { ...current, focus: 'architecture' }
    return current
  }
  const cursor = rows[index - commands.length]!
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
      mapStep: undefined,
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
  world: TerminalViewModel,
  state: ViewerState,
  action: ViewerAction,
): ViewerState {
  const resolved = resolve(world, state)
  const current: ViewerState = {
    ...state,
    currentId: resolved.currentId,
  }

  if (action === 'toggle-work' && current.work === undefined) {
    return {
      ...current,
      work: initialWorkFocus(world.work, {
        focus: current.focus,
        details: current.panes.details,
        detailsScroll: current.detailsScroll,
        actionCursor: current.actionCursor,
      }),
      focus: 'hierarchy',
      panes: { ...current.panes, details: true },
      detailsScroll: 0,
      actionCursor: undefined,
    }
  }
  if (current.work !== undefined) return reduceWorkFocus(world, current, action)
  if (action === 'toggle-work') return current
  if (action === 'tab') {
    if (current.focus === 'hierarchy') return { ...current, focus: 'architecture' }
    return syncTree(world, {
      ...current,
      focus: 'hierarchy',
    })
  }
  if (action === 'toggle-details') {
    const details = !current.panes.details
    return {
      ...current,
      panes: { ...current.panes, details },
      focus: !details && current.focus === 'details' ? 'architecture' : current.focus,
    }
  }
  if (action === 'clear-action') {
    return {
      ...current,
      activeActionId: undefined,
      activeActionActorId: undefined,
      actionStep: undefined,
    }
  }
  if (action === 'step-action') {
    const lit = litAction(world, current)
    const legs = actionLegs(lit.id, world, lit.actorId)
    if (legs.length === 0) return current
    return { ...current, actionStep: ((current.actionStep ?? -1) + 1) % legs.length }
  }
  if (action === 'toggle-details-tab') {
    return {
      ...current,
      detailsTab: current.detailsTab === 'what' ? 'how' : 'what',
      detailsScroll: 0,
    }
  }
  if (action === 'dismiss') {
    const view = current.level === 'components'
      ? leaveView(world, current, resolved.selected)
      : { level: current.level, currentId: current.currentId }
    return syncTree(world, {
      ...current,
      ...view,
      focus: 'architecture',
      panes: { ...current.panes, details: false },
      mapStep: undefined,
    })
  }
  if (action === 'leave') {
    return syncTree(world, {
      ...current,
      ...leaveView(world, current, resolved.selected),
      focus: 'architecture',
      mapStep: undefined,
    })
  }
  if (current.focus === 'hierarchy') {
    return reduceTree(world, current, action)
  }
  if (current.focus === 'details') {
    if (action === 'up' || action === 'down') {
      const step = action === 'down' ? 1 : -1
      const actions = detailsCommands(world, current)
      if (actions.length === 0) {
        return { ...current, detailsScroll: Math.max(0, current.detailsScroll + step) }
      }
      const index = actions.findIndex(item => item.id === current.actionCursor)
      const next = index < 0
        ? (step > 0 ? 0 : actions.length - 1)
        : Math.max(0, Math.min(actions.length - 1, index + step))
      // Each previewed walk starts unstepped.
      return { ...current, actionCursor: actions[next]!.id, actionStep: undefined }
    }
    if (action === 'enter') {
      const actions = detailsCommands(world, current)
      if (!actions.some(item => item.id === current.actionCursor)) return current
      // Enter commits the walk the map is already lighting.
      const lit = litAction(world, current)
      return {
        ...current,
        activeActionId: lit.id,
        activeActionActorId: lit.actorId,
        actionStep: undefined,
      }
    }
    if (action === 'left') return { ...current, focus: 'architecture' }
    return current
  }
  if (action === 'enter') {
    if (resolved.selected && canEnter(resolved.selected)) {
      return syncTree(world, {
        ...current,
        ...enterView(world, resolved.selected),
        mapStep: undefined,
      })
    }
    return enterDetails(current)
  }
  if (!resolved.selected) {
    return current
  }
  const moved = moveView(world, current, resolved.selected, action)
  if (moved.level === current.level && moved.currentId === current.currentId) {
    // Nothing lies further that way; the next stop is the side pane.
    if (action === 'left') return reduceViewer(world, current, 'tab')
    if (action === 'right') return enterDetails(current)
  }
  return syncTree(world, {
    ...current,
    ...moved,
    mapStep: { fromId: resolved.selected.representationId, direction: action },
  })
}

/** Details focus starts with the cursor on the already-picked command. */
function enterDetails(current: ViewerState): ViewerState {
  return {
    ...current,
    focus: 'details',
    actionCursor: current.activeActionId,
    panes: { ...current.panes, details: true },
  }
}

/** The current match drives selection live; no match leaves the view alone. */
function followMatch(world: TerminalViewModel, state: ViewerState): ViewerState {
  const search = state.search
  if (!search) return state
  const match = search.matches[search.index]
  if (!match) return state
  return syncTree(world, {
    ...state,
    level: levelFor(match),
    currentId: match.representationId,
    mapStep: undefined,
  })
}

export function reduceSearch(
  world: TerminalViewModel,
  architectureSearch: ArchitectureSearch,
  state: ViewerState,
  input: SearchInput,
): ViewerState {
  if (input.type === 'open') {
    return {
      ...state,
      search: {
        query: '',
        index: 0,
        matches: [],
        before: { level: state.level, currentId: state.currentId },
      },
    }
  }
  const search = state.search
  if (!search) return state
  if (input.type === 'char' || input.type === 'delete') {
    const query = input.type === 'char'
      ? search.query + input.char
      : search.query.slice(0, -1)
    const matches = architectureSearch.find(query).map(result => result.element)
    return followMatch(world, {
      ...state,
      search: { ...search, query, matches, index: 0 },
    })
  }
  if (input.type === 'next' || input.type === 'previous') {
    const count = search.matches.length
    if (count === 0) return state
    const step = input.type === 'next' ? 1 : -1
    const index = (search.index + step + count) % count
    return followMatch(world, { ...state, search: { ...search, index } })
  }
  if (input.type === 'accept') {
    return { ...state, search: undefined }
  }
  return syncTree(world, {
    ...state,
    search: undefined,
    level: search.before.level,
    currentId: search.before.currentId,
    mapStep: undefined,
  })
}
