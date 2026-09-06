import type { ProjectProfile } from '../../project-profile.ts'
import type { AnnotatedElement, AnnotatedRelationship, WorkItem } from '../../types.ts'
import { elementWorkGroups, touchedElements } from '../../work/pins.ts'
import { elementOnPath } from '../flows.ts'
import type { FlowRef } from '../flows.ts'
import { initialTree, semanticTreeRows, toggleExpansion } from '../tui/tree.ts'
import type { TreeRow } from '../tui/tree.ts'
import { createAddControl } from './chrome/add.ts'
import { createEmptyState } from './chrome/empty.ts'
import { createMapDebugPanel } from './chrome/map-debug.ts'
import { animateControl } from './chrome/motion.ts'
import { bindChromeActions, createWebShell, mapFrame, type MapFrame } from './chrome/shell.ts'
import { bindThemeControl, readSavedTheme } from './chrome/theme-control.ts'
import { paintWorldStats, primarySystem } from './chrome/stats.ts'
import { createWebDataSource } from './data.ts'
import { createFlowList } from './flow/list.ts'
import { flowFocus, flowHighlight, flowSelection, retainFlows, toggleFlowActivation, type WebFlowRef } from './flow/state.ts'
import { paintFlowReturn, paintFlowDetails } from './flow/reader.ts'
import { fitArchitecture, fitHighlights, fitCamera, pan, wheelAction, zoomAbout, zoomLimits, zoomReadout } from './iso/camera.ts'
import type { Camera } from './iso/camera.ts'
import { createMap } from './iso/map.ts'
import { createCameraAnimator } from './iso/motion.ts'
import { bindMapPointer } from './iso/pointer.ts'
import { projectScene } from './iso/project.ts'
import { sceneAtSeparation } from './layers/separation.ts'
import { createLayerAnimator, createLayerMotion } from './layers/orbit.ts'
import { paintRelationship } from './organisms/relationship-details.ts'
import { detailsTabAfterSelection, detailsTabAfterWork, type DetailsTab, inspectDetails, paintDetails } from './organisms/details.ts'
import { paintHierarchy } from './organisms/hierarchy.ts'
import { createPins } from './work/pins.ts'
import { createTip } from './organisms/tip.ts'
import { createProjectEditor } from './project/editor.ts'
import { createAuthoring } from './authoring.ts'
import { createRevisionControl } from './revision/control.ts'
import { createSearchSession } from './search/session.ts'
import { createWorkIsland } from './work/island.ts'
import { openWorkSelection, toggleWorkSelection } from './work/selection.ts'
import type { WebBootPayload, WebPayload, WebWorkPayload } from './payload.ts'
import { noSelection, primarySelection, retainSelection, selectArchitecture, selectedArchitecture, selectTask } from './selection.ts'
import { createSourceControl } from './source/control.ts'
import { createTaskDiffControl } from './task-diff/control.ts'
import { readView, writeView } from './url.ts'

const ZOOM_STEP = 1.25
const boot = JSON.parse(document.getElementById('world')!.textContent!) as WebBootPayload
const data = createWebDataSource(boot)
let world = boot.world
let work = boot.work
let sheet = boot.sheet
let project: ProjectProfile | undefined = boot.project ?? undefined
let currentPins = boot.pins
let mapMeta = { generation: boot.generation, timings: boot.timings }
const layerMotion = createLayerMotion()
const debug = createMapDebugPanel(document.body, () => ({ ...mapMeta, world, sheet }))
function projectedLayerScene() {
  return debug.project(() => {
    const pose = layerMotion.pose
    return sceneAtSeparation(projectScene(sheet, project, pose), pose.separation)
  })
}
let scene = projectedLayerScene()
const host = document.getElementById('map')!
const headerHost = document.getElementById('header')!
const hierarchyHost = document.getElementById('hierarchy')!
const treeHost = document.getElementById('tree')!
const flowsHost = document.getElementById('flows')!
const paintFlows = createFlowList()
const statsHost = document.getElementById('stats')!
const revisionSelect = document.getElementById('revision') as HTMLDetailsElement
const searchRoot = document.getElementById('web-search')!
const detailsHost = document.getElementById('details')!
const zoomHost = document.getElementById('zoom')!
const hierarchyContent = document.getElementById('hierarchy-content')!
const hierarchyToggle = document.getElementById('hierarchy-toggle') as HTMLButtonElement
const map = createMap(host)
const edit = data.edit
const projectEditor = edit === undefined ? undefined : createProjectEditor(input => edit({ id: 'project', ...input }))
const emptyState = createEmptyState(document.getElementById('empty')!, data.draft)
if (data.add !== undefined) createAddControl(document.getElementById('add')!, data.add)
const shell = createWebShell(document.body, hierarchyContent, hierarchyToggle, detailsHost, map.svg)
const tip = createTip(host)
const pins = createPins(host, id => map.anchorOf(id), id => toggleTask(id, false), tip)
const island = createWorkIsland(host, id => toggleTask(id), pins.show, tip)
let tree = initialTree()
const opened = readView(location.search, world, work.items, boot.revisions, readSavedTheme(localStorage))
const themeControl = bindThemeControl(document.getElementById('theme') as HTMLDetailsElement, opened.theme, syncUrl)
let hudVisible = opened.hudVisible
shell.setHud(hudVisible)
let selection = opened.selection
let activeFlows: WebFlowRef[] = opened.flows
const initial = primarySystem(world)
if (boot.revision === null && selection.kind === 'none' && initial !== undefined) {
  selection = selectArchitecture(noSelection, initial.representationId, false)
}
/** Tasks activated from pins or chips, in activation order; selection is independent and this order supplies its deactivation fallback. */
let activeTaskIds: string[] = selection.kind === 'task' ? [selection.id] : []
let detailsTab: DetailsTab = opened.tab
const revisionControl = createRevisionControl({
  control: revisionSelect, body: document.body, boot, data,
  applyRevision: payload => applyWorld(payload, true), applyWorld, applyWork,
})
const authoring = createAuthoring(host, map, data, {
  live: () => revisionControl.selected === undefined,
  world: () => world,
  repaint: () => paintViewState(),
})
const source = createSourceControl({
  host: detailsHost, initialFile: opened.file, initialLine: opened.line,
  element: () => worldElement(primarySelection(selection)), readCode: data.readCode, readSource: data.readSource,
  revision: () => revisionControl.selected, repaint: paintViewState,
})
const taskDiff = createTaskDiffControl({
  host: detailsHost, world: () => world, readDetails: data.readTask, readDiff: data.readTaskDiff,
  repaint: paintViewState, select,
})
/** The full-screen grid surrounds a safe camera frame between the floating chrome. */
function viewport(): MapFrame {
  return mapFrame(
    host.getBoundingClientRect(),
    headerHost.getBoundingClientRect(),
    hierarchyHost.getBoundingClientRect(),
    { left: detailsHost.offsetLeft, hidden: detailsHost.inert },
    hudVisible,
  )
}
function fitScene(frame: MapFrame): Camera {
  return pan(fitCamera(scene.bounds, frame), frame.x, frame.y)
}

let fitted: Camera = fitScene(viewport())
const camera = createCameraAnimator(fitted, applyCamera, map.prepareCamera)
/** Once an interaction positions the camera, live refits stop until the viewer presses 0. */
let touched = false
function worldElement(id: string | undefined): AnnotatedElement | undefined { return id === undefined ? undefined : world.elements.find(element => element.representationId === id) }
function worldRelationship(id: string | undefined): AnnotatedRelationship | undefined { return id === undefined ? undefined : world.relationships.find(item => item.id === id) }
function workItem(id: string | undefined): WorkItem | undefined { return id === undefined ? undefined : work.items.find(item => item.id === id) }

/** True for an element, relationship or task id the current payload has. */
function known(id: string | undefined): boolean {
  return worldElement(id) !== undefined || worldRelationship(id) !== undefined || workItem(id) !== undefined
    || world.flows.some(flow => flow.id === id)
}

function applyCamera(): void {
  const current = camera.current
  const scaleChanged = map.move(current, current.k / fitted.k)
  pins.place(current)
  if (scaleChanged) zoomHost.textContent = zoomReadout(current, fitted) || '100%'
}

function refit(): void {
  fitted = fitScene(viewport())
  camera.move(fitted)
  touched = false
}

function fitControl(): void { animateControl(document.getElementById('fit')!, 'fit'); refit() }
function zoomStep(factor: number, control: HTMLElement): void {
  animateControl(control, 'zoom')
  const frame = viewport()
  camera.move(zoomAbout(camera.target, factor, { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 }, fitted))
  touched = true
}

/** The URL follows the view, without adding history entries. */
function syncUrl(): void {
  const query = writeView({
    ...(revisionControl.selected === undefined ? {} : { revision: revisionControl.selected }),
    ...(source.file === undefined ? {} : { file: source.file }),
    ...(source.line === undefined ? {} : { line: source.line }),
    selection, flows: activeFlows,
    tab: detailsTab,
    theme: themeControl.mode,
    hudVisible,
  }, world, work.items)
  history.replaceState(null, '', `${location.pathname}${query}`)
}

function paintMapState(task: WorkItem | undefined, activeTaskItems: WorkItem[]): void {
  const selectedIds = selectedArchitecture(selection)
  const { routes: litIds, focusedRoute } = flowHighlight(activeFlows, world)
  map.select(selectedIds)
  map.mark(new Set(activeFlows.length === 0 ? activeTaskItems.flatMap(item => touchedElements(item, world)) : []))
  pins.activate(activeTaskIds, task?.id)
  island.activate(activeTaskIds, task?.id)
  map.setLitRoutes(litIds, id => elementOnPath(id, litIds, world), focusedRoute)
}

function paintViewState(commitUrl = true): void {
  const activeFlow = activeFlows.at(-1)
  if (commitUrl) syncUrl()
  shell.paint(selection)
  const selectedId = primarySelection(selection)
  const task = selection.kind === 'task' ? workItem(selection.id) : undefined
  const activeTaskItems = activeTaskIds.map(id => workItem(id)).filter((item): item is WorkItem => item !== undefined)
  paintMapState(task, activeTaskItems)
  paintTree()
  paintFlows(flowsHost, world, activeFlows, toggleFlow, {
    title: 'Actors', selectedIds: selectedArchitecture(selection), onSelectActor: select,
  })
  paintWorldStats(statsHost, world)
  paintFlowReturn(detailsHost, activeFlow, selection.kind === 'flow', world, select, showFlows)
  const flow = world.flows.find(item => item.id === selectedId)
  if (selection.kind === 'flow' && flow !== undefined && activeFlow !== undefined) {
    paintFlowDetails(detailsHost, flow, activeFlow, world, selectFlowStep, select)
    return
  }
  const selected = worldElement(selectedId)
  const relationship = worldRelationship(selectedId)
  if (source.paint(selected)) return
  if (taskDiff.paint(task)) return
  if (relationship !== undefined) {
    paintRelationship(detailsHost, relationship, world, select, authoring.relationWrites)
  } else if (selected !== undefined) {
    paintDetails(detailsHost, inspectDetails(selected, world), {
      world,
      onSelect: select,
      onToggleFlow: flow => toggleFlow(flow, selected.representationId),
      activeFlows,
      tab: detailsTab,
      onTab: tab => {
        detailsTab = tab
        paintViewState()
      },
      code: detailsTab === 'how' ? source.code() : [],
      onSource: source.open,
      workGroups: selected.kind === 'component' ? elementWorkGroups(work, selected.representationId, world) : [],
      onTask: toggleTask,
      ...authoring.paneWrites(selected.id, selectedArchitecture(selection)),
    })
  }
}

function paintTree(): void {
  paintHierarchy(
    treeHost,
    semanticTreeRows(world, selectedArchitecture(selection), tree).filter(row => row.kind !== 'actor'),
    new Set(selectedArchitecture(selection)),
    select,
    toggleRow,
  )
}

function toggleRow(row: TreeRow): void {
  tree = toggleExpansion(tree, row)
  paintTree()
}

function select(id: string, additive = false, focus = true): void {
  if (worldElement(id) === undefined && worldRelationship(id) === undefined) return
  source.clear()
  const next = selectArchitecture(selection, id, additive)
  detailsTab = detailsTabAfterSelection(detailsTab, primarySelection(selection), primarySelection(next))
  selection = next
  touched = true
  if (!focus) camera.move(camera.current, false)
  paintViewState()
  if (focus) focusArchitecture(selectedArchitecture(selection))
}

function applyFocus(next: Camera | undefined, frame: MapFrame): void {
  if (next === undefined) return
  camera.move(pan(next, frame.x, frame.y))
  touched = true
}
function focusActiveTasks(): void {
  const elementIds = activeTaskIds.flatMap(id => {
    const task = workItem(id)
    return task === undefined ? [] : touchedElements(task, world)
  })
  const frame = viewport()
  applyFocus(fitHighlights(scene, elementIds, frame, zoomLimits(fitted).max), frame)
}
function focusArchitecture(ids: readonly string[]): void {
  const frame = viewport()
  applyFocus(fitArchitecture(scene, world, ids, frame), frame)
}

/** Task pins preserve the camera; panel and search selections bring active work into view. */
function applyTaskSelection(next: ReturnType<typeof toggleWorkSelection>, focus = true): void {
  activeFlows = []
  activeTaskIds = next.active
  source.clear()
  selection = next.selected === undefined ? noSelection : selectTask(next.selected)
  touched = true
  if (!focus) camera.move(camera.current, false)
  paintViewState()
  if (focus) focusActiveTasks()
}

function toggleTask(id: string, focus = true): void {
  applyTaskSelection(toggleWorkSelection(activeTaskIds, selection.kind === 'task' ? selection.id : undefined, id), focus)
}

function deselect(): void {
  authoring.cancel()
  source.clear()
  selection = noSelection
  activeTaskIds = []
  activeFlows = []
  paintViewState()
}

const searchControl = createSearchSession({
  root: searchRoot, elements: world.elements, tasks: work.items, viewport,
  clearSource: source.clear, anchorOf: id => map.anchorOf(id),
  taskElements: task => touchedElements(task, world),
  openTask: id => applyTaskSelection(openWorkSelection(activeTaskIds, id)),
  snapshot: () => ({ selection, camera: { ...camera.current }, touched, detailsTab }),
  previewMap(ids, nextCamera) {
    if (nextCamera !== undefined) { camera.move(nextCamera); touched = true }
    map.select(ids ?? selectedArchitecture(selection))
  },
  apply(next, commitUrl) {
    ({ selection, touched, detailsTab } = next)
    if (!commitUrl) camera.move(next.camera)
    paintViewState(commitUrl)
    if (commitUrl) focusArchitecture(selectedArchitecture(selection))
  },
})

function showFlows(): void {
  source.clear()
  selection = flowSelection(activeFlows)
  paintViewState()
  focusArchitecture([...flowHighlight(activeFlows, world).routes])
}

function selectFlowStep(step: number | undefined): void {
  activeFlows = activeFlows.map((flow, index) => index === activeFlows.length - 1 ? { ...flow, step } : flow)
  paintViewState()
  focusArchitecture(flowFocus(activeFlows, world))
}

function toggleFlow(flow: FlowRef, returnTo?: string): void {
  activeFlows = toggleFlowActivation(activeFlows, flow, returnTo)
  activeTaskIds = []
  showFlows()
}

/** The pane takes the wheel wherever the cursor is, pins included; the Live work island keeps it for its chip strip. */
host.addEventListener('wheel', event => {
  if (event.target instanceof Element && event.target.closest('#work')) return
  event.preventDefault()
  const action = wheelAction(event)
  if (action.kind === 'pan') camera.move(pan(camera.current, action.dx, action.dy), false)
  else {
    const rect = host.getBoundingClientRect()
    camera.move(zoomAbout(camera.current, action.factor, { x: event.clientX - rect.left, y: event.clientY - rect.top }, fitted), false)
  }
  touched = true
}, { passive: false })

bindMapPointer(map, {
  orbiting: () => layerMotion.active,
  pan(dx, dy) {
    camera.move(pan(camera.current, dx, dy), false)
    touched = true
  },
  orbit(dx, dy) {
    touched = true
    layerAnimator.orbit(dx, dy)
  },
  select: (id, additive) => select(id, additive, false),
  deselect,
  editProject() {
    if (revisionControl.selected === undefined && project !== undefined) projectEditor?.open(project)
  },
})
map.svg.addEventListener('keydown', event => {
  if (!map.isProjectEdit(event.target) || (event.key !== 'Enter' && event.key !== ' ')) return
  event.preventDefault()
  if (revisionControl.selected === undefined && project !== undefined) projectEditor?.open(project)
})

function toggleHud(): void {
  hudVisible = !hudVisible
  shell.setHud(hudVisible)
  refit()
  syncUrl()
}

function sceneCentre(bounds: typeof scene.bounds): { x: number; y: number } {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
}

/** Reprojects from one pose, then either fits a mode transition or keeps an orbited map centred. */
function repaintLayerScene(fit: boolean): void {
  const before = sceneCentre(scene.bounds)
  scene = projectedLayerScene()
  const after = sceneCentre(scene.bounds)
  debug.paint(() => map.paint(scene))
  pins.paint(currentPins)
  fitted = fitScene(viewport())
  if (fit) {
    camera.move(fitted)
    touched = false
  } else camera.move(pan(camera.current, (before.x - after.x) * camera.current.k, (before.y - after.y) * camera.current.k), false)
  applyCamera()
  const task = selection.kind === 'task' ? workItem(selection.id) : undefined
  paintMapState(task, activeTaskIds.map(id => workItem(id)).filter((item): item is WorkItem => item !== undefined))
}

const layerAnimator = createLayerAnimator(layerMotion, repaintLayerScene)

bindChromeActions({
  hud: toggleHud,
  layers: () => layerAnimator.toggle(),
  debug: debug.toggle,
  zoomIn: () => zoomStep(ZOOM_STEP, document.getElementById('zoom-in')!),
  zoomOut: () => zoomStep(1 / ZOOM_STEP, document.getElementById('zoom-out')!),
  fit: fitControl,
  deselect,
})

let lastViewport = viewport()
const resizeObserver = new ResizeObserver(() => {
  const next = viewport()
  if (touched) {
    camera.move(pan(
      camera.target,
      next.x + next.width / 2 - lastViewport.x - lastViewport.width / 2,
      next.y + next.height / 2 - lastViewport.y - lastViewport.height / 2,
    ))
    fitted = fitScene(next)
  } else refit()
  lastViewport = next
})
resizeObserver.observe(host)

function applyWorld(payload: WebPayload, reset = false): void {
  mapMeta = { generation: payload.generation, timings: payload.timings }
  world = payload.world
  work = payload.work
  sheet = payload.sheet
  project = payload.project ?? undefined
  currentPins = payload.pins
  scene = projectedLayerScene()
  fitted = fitScene(viewport())
  if (reset) {
    authoring.cancel()
    source.clear()
    tree = initialTree()
    activeTaskIds = []
    activeFlows = []
    selection = noSelection
    detailsTab = 'what'
    camera.move(fitted)
    touched = false
  } else {
    if (!touched) camera.move(fitted)
    activeTaskIds = activeTaskIds.filter(id => workItem(id) !== undefined)
    activeFlows = retainFlows(activeFlows, world)
    if (selection.kind === 'flow') selection = flowSelection(activeFlows)
    selection = retainSelection(selection, id => known(id))
  }
  taskDiff.invalidate()
  paintWorld()
  searchControl.update(world.elements, work.items)
}
/** Repaints only the optional Backlog layer; map projection, painting and camera state stay unchanged. */
function applyWork(payload: WebWorkPayload): void {
  work = payload.work
  currentPins = payload.pins
  const selected = worldElement(primarySelection(selection))
  const hasTasks = selected?.kind === 'component'
    && elementWorkGroups(work, selected.representationId, world).length > 0
  detailsTab = detailsTabAfterWork(detailsTab, hasTasks)
  activeTaskIds = activeTaskIds.filter(id => workItem(id) !== undefined)
  selection = retainSelection(selection, id => known(id))
  pins.paint(payload.pins)
  island.paint(payload.pins, work)
  paintViewState()
  searchControl.updateTasks(work.items)
}
function paintWorld(): void {
  debug.paint(() => map.paint(scene))
  revisionControl.paintProjectEdit(map.svg)
  authoring.refresh()
  pins.paint(currentPins)
  island.paint(currentPins, work)
  emptyState.paint(world, project, revisionControl.selected !== undefined)
  applyCamera()
  paintViewState()
  source.restore()
}
paintWorld()
if (selection.kind === 'task') focusActiveTasks()
else if (opened.selection.kind === 'architecture') focusArchitecture(selectedArchitecture(selection))
else if (selection.kind === 'flow') focusArchitecture(flowFocus(activeFlows, world))
