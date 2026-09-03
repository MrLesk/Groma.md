import { outgoingActions, travelledBy, worldCommands } from '../action-path.ts'
import { elementWorkGroups } from '../../work/pins.ts'
import { parentOfElements, promotedPeer } from '../relationship-text.ts'
import { litLegs } from './flow.ts'
import type { PaneVisibility } from './layout.ts'
import {
  canEnter,
  enterView,
  leaveView,
  levelFor,
  moveView,
} from './navigation-spatial.ts'
import { compareSemanticElements } from '../../element-order.ts'
import { ancestorsOf, initialTree, semanticTreeRows } from './tree.ts'
import type { TreeState } from './tree.ts'
import type { TerminalViewModel } from './model.ts'
import type { SearchState } from './navigation-search.ts'
import { reduceHistoryNavigation, type HistoryState } from './navigation-history.ts'
import {
  reduceDetailsNavigation,
  type CodeStructureState,
  type DiffViewState,
  type SourceViewState,
} from './navigation-details.ts'
import { initialWorkFocus } from './work/model.ts'
import type { WorkFocus } from './work/model.ts'
import { reduceWorkFocus } from './work/navigation.ts'
import type {
  AnnotatedElement,
  AnnotatedRelationship,
  TerminalLevel,
  WorkItemDetails,
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
  | 'toggle-hierarchy'
  | 'toggle-profile'
  | 'toggle-keys'
  | 'toggle-history'
  | 'dismiss'
  | 'clear-action'
  | 'step-action'
  | 'toggle-details-tab'
  | 'toggle-work'

type MapViewerAction = Exclude<ViewerAction, 'toggle-history'>

export interface ViewerState {
  level: TerminalLevel
  currentId?: string
  focus: ViewerFocus
  tree: TreeState
  panes: PaneVisibility
  /** First hidden content row of an overflowing details pane. */
  detailsScroll: number
  detailsTab: DetailsTab
  /** The project profile is showing in the details pane instead of the selection. */
  profile?: boolean
  /** The keys box is showing in the details pane, over whatever it showed before. */
  keys?: boolean
  /** The full record of one task is showing in the details pane; its details arrive from the work source. */
  taskRecord?: { id: string; details?: WorkItemDetails }
  /** The declarations of the selected component's TypeScript files, read once per selection for the How tab. */
  codeStructure?: CodeStructureState
  /** A source file open read-only in the details pane at one line; its text arrives from the reader. */
  sourceView?: SourceViewState
  /** A task's modified file open as a unified diff in the details pane; the diff arrives from the reader. */
  diffView?: DiffViewState
  /** One actor command. Survives leaving the actor until x or another pick. */
  activeActionId?: string
  /** The actor the command was picked from; scopes the walk's approach to them. */
  activeActionActorId?: string
  /** The traced leg of the active command's walk; absent while the whole walk shows. */
  actionStep?: number
  /** The command row the details cursor rests on; Enter picks it. */
  actionCursor?: string
  search?: SearchState
  /** The current-branch revision list shown in the hierarchy pane. */
  history?: HistoryState
  /** The commit the viewer should show; absent means the live working tree. */
  revisionId?: string
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

export function initialState(world: TerminalViewModel): ViewerState {
  return {
    level: 'context',
    currentId: defaultSelection(world, 'context')?.representationId,
    focus: 'architecture',
    tree: initialTree(),
    panes: { hierarchy: true, details: true },
    detailsScroll: 0,
    detailsTab: 'what',
    revisionId: world.revision?.id,
  }
}

/** The pickable command rows the details pane shows for its tab. */
export function detailsCommands(
  world: TerminalViewModel,
  state: Pick<ViewerState, 'currentId' | 'detailsTab' | 'profile' | 'keys'>,
): AnnotatedRelationship[] {
  if (state.profile || state.keys) return []
  if (state.currentId === undefined) return []
  return state.detailsTab === 'how' ? travelledBy(state.currentId, world) : selectionRelationships(world, state.currentId)
}

/** The tasks touching the selection, in the details pane's order: to do, in progress, done. */
export function detailsTasks(world: TerminalViewModel, state: Pick<ViewerState, 'currentId' | 'detailsTab' | 'profile' | 'keys'>): string[] {
  if (state.currentId === undefined || state.detailsTab === 'how' || state.profile || state.keys || world.work === undefined) return []
  return elementWorkGroups(world.work, state.currentId, world).flatMap(group => group.items.map(item => item.id))
}

/** The selection's relationships in the details pane's order: its own outgoing ones, then everything pointing at it or its promoted parent. */
export function selectionRelationships(world: TerminalViewModel, elementId: string): AnnotatedRelationship[] {
  const parentOf = parentOfElements(world.elements)
  const incoming = world.relationships.filter(relationship => promotedPeer(relationship, elementId, parentOf)?.outgoing === false)
  return [...outgoingActions(elementId, world), ...incoming]
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
export function syncTree(world: TerminalViewModel, state: ViewerState): ViewerState {
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

function reduceMapNavigation(
  world: TerminalViewModel,
  state: ViewerState,
  action: MapViewerAction,
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
        panes: current.panes,
        detailsScroll: current.detailsScroll,
        actionCursor: current.actionCursor,
      }),
      focus: 'hierarchy',
      panes: { hierarchy: true, details: true },
      profile: false,
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
      panes: { ...current.panes, hierarchy: true },
    })
  }
  if (action === 'toggle-details' || action === 'toggle-hierarchy' || action === 'toggle-profile' || action === 'toggle-keys') {
    return reducePaneKeys(world, current, action)
  }
  if (action === 'dismiss' && current.sourceView !== undefined) return { ...current, sourceView: undefined, detailsScroll: 0 }
  if (action === 'dismiss' && current.diffView !== undefined) return { ...current, diffView: undefined, detailsScroll: 0 }
  if (action === 'dismiss' && current.taskRecord !== undefined) return { ...current, taskRecord: undefined, detailsScroll: 0 }
  if (action === 'dismiss' && current.keys) return { ...current, keys: false, detailsScroll: 0 }
  if (action === 'dismiss' && current.profile) return { ...current, profile: false, detailsScroll: 0 }
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
    const legs = litLegs(world, lit)
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
    })
  }
  if (action === 'leave') {
    return syncTree(world, {
      ...current,
      ...leaveView(world, current, resolved.selected),
      focus: 'architecture',
    })
  }
  if (current.focus === 'hierarchy') {
    return reduceTree(world, current, action)
  }
  if (current.focus === 'details') {
    const commands = detailsCommands(world, current)
    const tasks = detailsTasks(world, current)
    const handled = reduceDetailsNavigation(
      world,
      current,
      action,
      commands.map(item => item.id),
      tasks,
    )
    if (handled !== undefined) return handled
    if (action === 'enter') {
      const picked = commands.find(item => item.id === current.actionCursor)
      if (picked === undefined) return current
      // Enter on the row already lit follows the relationship to its other end.
      if (picked.id === current.activeActionId) return followRelationship(world, current, picked)
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
  return syncTree(world, { ...current, ...moved })
}

/** The one terminal reducer: history owns its modal rules, then the normal map handles everything else. */
export function reduceViewer(
  world: TerminalViewModel,
  state: ViewerState,
  action: ViewerAction,
): ViewerState {
  if (action === 'toggle-history') return reduceHistoryNavigation(world, state, action) ?? state
  return reduceHistoryNavigation(world, state, action) ?? reduceMapNavigation(world, state, action)
}

/**
 * The pane keys: [ and ] fold or open a pane, p shows the project profile, ? the keys box. A folding pane
 * drops its focus to the map and folding the details ends the profile and the box; the profile needs a project.
 */
function reducePaneKeys(
  world: TerminalViewModel,
  current: ViewerState,
  action: 'toggle-details' | 'toggle-hierarchy' | 'toggle-profile' | 'toggle-keys',
): ViewerState {
  if (action === 'toggle-keys') return toggleDetailsMode(current, 'keys')
  if (action === 'toggle-profile') return world.project === undefined ? current : toggleDetailsMode(current, 'profile')
  if (action === 'toggle-details' || action === 'toggle-hierarchy') {
    const pane = action === 'toggle-details' ? 'details' : 'hierarchy'
    const open = !current.panes[pane]
    return {
      ...current,
      panes: { ...current.panes, [pane]: open },
      focus: !open && current.focus === pane ? 'architecture' : current.focus,
      profile: current.profile === true && !(pane === 'details' && !open),
      keys: current.keys === true && !(pane === 'details' && !open),
    }
  }
  return current
}

/** A details mode, the profile or the keys box, closes when showing and otherwise opens the pane with it. */
function toggleDetailsMode(current: ViewerState, mode: 'profile' | 'keys'): ViewerState {
  return current[mode]
    ? { ...current, [mode]: false, detailsScroll: 0 }
    : { ...current, [mode]: true, panes: { ...current.panes, details: true }, detailsScroll: 0 }
}

/** The other end of a relationship becomes the selection, at its own level. */
function followRelationship(world: TerminalViewModel, current: ViewerState, relationship: AnnotatedRelationship): ViewerState {
  const peerId = relationship.source === current.currentId ? relationship.target : relationship.source
  const peer = elementsById(world).get(peerId)
  if (peer === undefined) return current
  return syncTree(world, { ...current, level: levelFor(peer), currentId: peer.representationId, actionCursor: undefined })
}

/** A click on the map: the element under the cell becomes the selection. */
export function selectMapItem(world: TerminalViewModel, state: ViewerState, id: string): ViewerState {
  if (state.work !== undefined) return state
  return syncTree(world, { ...state, currentId: id, focus: 'architecture' })
}

/** A click on a hierarchy row: the cursor lands there and Enter follows. */
export function clickTreeRow(world: TerminalViewModel, state: ViewerState, id: string): ViewerState {
  return reduceViewer(world, { ...state, focus: 'hierarchy', tree: { ...state.tree, cursor: id } }, 'enter')
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
