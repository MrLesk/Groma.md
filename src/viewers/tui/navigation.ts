import type { TaskDiffPayload } from '../source/diff.ts'
import { outgoingActions, travelledBy } from '../action-path.ts'
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
import { ancestorsOf, initialTree } from './tree.ts'
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
import type { WorkFocus, WorkListSettings } from './work/model.ts'
import { reduceComponentTasks, reduceWorkFocus } from './work/navigation.ts'
import { reduceTree } from './navigation-tree.ts'
import { firstRootRow } from './projection-root.ts'
import type {
  AnnotatedElement,
  AnnotatedRelationship,
  TerminalLevel,
  WorkItemDetails,
} from '../../types.ts'

export type ViewerFocus = 'architecture' | 'hierarchy' | 'details'
export type DetailsTab = 'what' | 'how' | 'tasks'
export type MapDirection = 'up' | 'down' | 'left' | 'right'
export type ViewerAction =
  | 'enter'
  | 'toggle-selection'
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
  | 'toggle-work'

type MapViewerAction = Exclude<ViewerAction, 'toggle-history'>

export interface ViewerState {
  level: TerminalLevel
  currentId?: string
  focus: ViewerFocus
  tree: TreeState
  panes: PaneVisibility
  /** Rows beyond the selected link, or from the top in a plain reading view. */
  detailsScroll: number
  detailsTab: DetailsTab
  /** The project profile is showing in the details pane instead of the selection. */
  profile?: boolean
  /** The keys box is showing in the details pane, over whatever it showed before. */
  keys?: boolean
  /** The full record of one task is showing in the details pane; its details arrive from the work source. */
  taskRecord?: { id: string; row: number; details?: WorkItemDetails; diff?: TaskDiffPayload | null }
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
  /** Map selection restored when the checked flow is cleared. */
  beforeFlow?: Pick<ViewerState, 'level' | 'currentId'>
  /** The traced leg of the active command's walk; absent while the whole walk shows. */
  actionStep?: number
  /** The relationship, task, file or reference under the details cursor. */
  actionCursor?: string
  search?: SearchState
  /** The current-branch revision list shown in the hierarchy pane. */
  history?: HistoryState
  /** The commit the viewer should show; absent means the live working tree. */
  revisionId?: string
  /** The map columns used by the fitted layouts and their arrow order. */
  mapWidth: number
  /** Terminal columns used by the shared pane and reading layout. */
  terminalWidth: number
  /** Present only while the terminal is using its task-focused side panes. */
  work?: WorkFocus
  workList?: WorkListSettings
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
    return firstRootRow(world)
      ?? ranked.find(element => element.kind === 'system' && !element.external)
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
    mapWidth: 80,
    terminalWidth: 120,
    revisionId: world.revision?.id,
  }
}

/** Actor flows have no build tab; component tasks remain beside meaning and evidence. */
export function detailsTabs(world: TerminalViewModel, currentId: string | undefined): DetailsTab[] {
  const element = world.elements.find(item => item.representationId === currentId)
  if (element?.kind === 'actor') return ['what']
  return element?.kind === 'component' ? ['what', 'how', 'tasks'] : ['what', 'how']
}

/** The pickable command rows the details pane shows for its tab. */
export function detailsCommands(
  world: TerminalViewModel,
  state: Pick<ViewerState, 'currentId' | 'detailsTab' | 'profile' | 'keys'>,
): AnnotatedRelationship[] {
  if (state.profile || state.keys || state.detailsTab !== 'what') return []
  if (state.currentId === undefined) return []
  return [...selectionRelationships(world, state.currentId), ...selectionFlows(world, state.currentId)]
}

/** Actor commands crossing a software element appear as flow checkboxes. */
export function selectionFlows(world: TerminalViewModel, elementId: string): AnnotatedRelationship[] {
  return world.elements.some(element => element.representationId === elementId && element.kind === 'actor')
    ? [] : travelledBy(elementId, world)
}

/** The selection's relationships in the details pane's order: its own outgoing ones, then everything pointing at it or its promoted parent. */
export function selectionRelationships(world: TerminalViewModel, elementId: string): AnnotatedRelationship[] {
  const parentOf = parentOfElements(world.elements)
  const incoming = world.relationships.filter(relationship => promotedPeer(relationship, elementId, parentOf)?.outgoing === false)
  const flows = new Set(selectionFlows(world, elementId).map(flow => flow.id))
  return [...outgoingActions(elementId, world), ...incoming].filter(relationship => !flows.has(relationship.id))
}

/** A lit walk: its command and, for an actor's own pick, the picker. */
export interface LitAction {
  id?: string
  actorId?: string
}

/** The one selected flow or relationship, temporarily quiet while Work owns the map. */
export function litAction(
  _world: TerminalViewModel,
  state: ViewerState,
): LitAction {
  if (state.work !== undefined) return {}
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
    detailsTab: detailsTabs(world, state.currentId).includes(state.detailsTab) ? state.detailsTab : 'what',
  }
}

function reduceMapNavigation(world: TerminalViewModel, state: ViewerState, action: MapViewerAction): ViewerState {
  const { selected, currentId } = resolve(world, state)
  const current = { ...state, currentId }
  if (action === 'toggle-keys' || action === 'toggle-details' || action === 'toggle-hierarchy') return reducePaneKeys(world, current, action)
  const workAction = current.work === undefined ? undefined : reduceWorkFocus(world, current, action)
  if (workAction !== undefined) return workAction
  const shortcut = reduceShortcuts(world, current, action)
  if (shortcut !== undefined) return shortcut
  if (action === 'dismiss') return { ...current, focus: 'architecture' }
  if (action === 'leave') {
    return syncTree(world, {
      ...current, ...leaveView(world, current, selected), focus: 'architecture',
    })
  }
  if (current.focus === 'hierarchy') return reduceTree(world, current, action)
  if (current.focus === 'details') return reduceSelectionDetails(world, current, action)
  if (action === 'enter') {
    return selected && canEnter(selected)
      ? syncTree(world, { ...current, ...enterView(world, selected) })
      : enterDetails(current)
  }
  if (!selected || !isMapDirection(action)) return current
  return syncTree(world, { ...current, ...moveView(world, current, selected, action) })
}

function isMapDirection(action: ViewerAction): action is MapDirection {
  return action === 'up' || action === 'down' || action === 'left' || action === 'right'
}

function reduceShortcuts(world: TerminalViewModel, current: ViewerState, action: MapViewerAction): ViewerState | undefined {
  if (action === 'toggle-work') {
    return {
      ...current, work: initialWorkFocus(world.work, current, current.workList), focus: 'hierarchy',
      panes: { hierarchy: true, details: true }, profile: false, detailsScroll: 0, actionCursor: undefined,
    }
  }
  if (action === 'tab') {
    if (current.focus !== 'details' || current.taskRecord || current.sourceView || current.diffView || current.profile || current.keys) return current
    const tabs = detailsTabs(world, current.currentId)
    if (tabs.length < 2) return current
    return { ...current, detailsTab: tabs[(tabs.indexOf(current.detailsTab) + 1) % tabs.length]!, detailsScroll: 0, actionCursor: undefined }
  }
  if (action === 'toggle-profile') {
    return reducePaneKeys(world, current, action)
  }
  if (action === 'dismiss') return dismissDetailsMode(current)
  return reduceFlowKeys(world, current, action)
}

function dismissDetailsMode(current: ViewerState): ViewerState | undefined {
  if (current.sourceView !== undefined) return { ...current, sourceView: undefined, detailsScroll: current.sourceView.returnScroll }
  if (current.diffView !== undefined) return { ...current, diffView: undefined, detailsScroll: 0 }
  if (current.taskRecord !== undefined) return { ...current, taskRecord: undefined, detailsScroll: 0 }
  if (current.keys) return { ...current, keys: false, focus: 'architecture', detailsScroll: 0 }
  if (current.profile) return { ...current, profile: false, focus: 'architecture', detailsScroll: 0 }
  return undefined
}

function reduceFlowKeys(world: TerminalViewModel, current: ViewerState, action: MapViewerAction): ViewerState | undefined {
  if (action === 'clear-action') {
    return clearFlow(current)
  }
  if (action !== 'step-action') return undefined
  const legs = litLegs(world, litAction(world, current))
  return legs.length === 0 ? current : { ...current, actionStep: ((current.actionStep ?? -1) + 1) % legs.length }
}

function clearFlow(current: ViewerState): ViewerState {
  return { ...current, ...current.beforeFlow, beforeFlow: undefined, activeActionId: undefined, activeActionActorId: undefined, actionStep: undefined, detailsScroll: 0 }
}

/** A single checked flow temporarily opens the root, preserving the original map selection. */
export function toggleFlow(current: ViewerState, id: string, actorId?: string): ViewerState {
  if (current.activeActionId === id) return clearFlow(current)
  return {
    ...current, beforeFlow: current.beforeFlow ?? { level: current.level, currentId: current.currentId },
    level: 'context', activeActionId: id, activeActionActorId: actorId, actionStep: undefined,
    panes: { ...current.panes, details: true }, detailsScroll: 0,
  }
}

function reduceSelectionDetails(world: TerminalViewModel, current: ViewerState, action: MapViewerAction): ViewerState {
  if (current.detailsTab === 'tasks' && !current.profile && !current.keys && current.taskRecord === undefined) {
    return reduceComponentTasks(world, current, action)
  }
  const commands = detailsCommands(world, current)
  const handled = reduceDetailsNavigation(world, current, action, commands.map(item => item.id))
  if (handled !== undefined) return handled
  if (action !== 'enter' && action !== 'toggle-selection') return current
  const picked = commands.find(item => item.id === current.actionCursor)
  if (picked === undefined) return current
  const actorFlow = current.detailsTab === 'what' && world.elements.some(element => element.representationId === current.currentId && element.kind === 'actor')
  const flow = actorFlow || selectionFlows(world, current.currentId!).some(flow => flow.id === picked.id)
  if (!flow && action === 'enter' && picked.id === current.activeActionId) return followRelationship(world, current, picked)
  return toggleFlow(current, picked.id, actorFlow ? current.currentId : undefined)
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
 * The pane keys focus their pane, or fold it when already focused. A folding pane
 * drops its focus to the map and folding the details ends the profile and the box; the profile needs a project.
 */
function reducePaneKeys(
  world: TerminalViewModel,
  current: ViewerState,
  action: 'toggle-details' | 'toggle-hierarchy' | 'toggle-profile' | 'toggle-keys',
): ViewerState {
  if (action === 'toggle-keys') return toggleDetailsMode(current, 'keys')
  if (action === 'toggle-profile') return world.project === undefined ? current : toggleDetailsMode(current, 'profile')
  const pane = action === 'toggle-details' ? 'details' : 'hierarchy'
  const open = current.focus !== pane || !current.panes[pane]
  const closingDetails = pane === 'details' && !open
  return {
    ...current, panes: { ...current.panes, [pane]: open },
    tree: pane === 'hierarchy' && open ? { ...current.tree, cursor: current.tree.cursor ?? current.currentId } : current.tree,
    focus: open ? pane : current.focus === pane ? 'architecture' : current.focus,
    profile: closingDetails ? false : current.profile,
    keys: closingDetails ? false : current.keys,
  }
}

/** A details mode, the profile or the keys box, closes when showing and otherwise opens the pane with it. */
function toggleDetailsMode(current: ViewerState, mode: 'profile' | 'keys'): ViewerState {
  return current[mode]
    ? { ...current, [mode]: false, detailsScroll: 0 }
    : { ...current, [mode]: true, focus: 'details', panes: { ...current.panes, details: true }, detailsScroll: 0 }
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
