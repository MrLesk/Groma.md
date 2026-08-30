import { compareSemanticElements } from '../../element-order.ts'
import type { ProjectProfile } from '../../project-profile.ts'
import type { AnnotatedElement, AnnotatedRelationship, ArchitectureGraph, WorkItem } from '../../types.ts'
import { touchedElements } from '../../work/pins.ts'
import { elementOnPath, flowRouteIds, worldCommands } from '../action-path.ts'
import type { FlowRef } from '../action-path.ts'
import { initialTree, semanticTreeRows, toggleExpansion } from '../tui/tree.ts'
import type { TreeRow } from '../tui/tree.ts'
import { nextTheme, themeLabel } from './atoms/theme.ts'
import { createMapDebugPanel } from './chrome/map-debug.ts'
import { animateControl, createThemeTransition } from './chrome/motion.ts'
import { createWebShell, mapFrame, type MapFrame } from './chrome/shell.ts'
import { paintFlows } from './flow/list.ts'
import { toggleFlowActivation } from './flow/state.ts'
import { fitHighlights, fitCamera, keyAction, keyTarget, pan, wheelAction, zoomAbout, zoomLimits, zoomReadout } from './iso/camera.ts'
import type { Camera } from './iso/camera.ts'
import { createMap } from './iso/map.ts'
import { bindMapPointer } from './iso/pointer.ts'
import { projectScene } from './iso/project.ts'
import { sceneAtSeparation } from './layers/separation.ts'
import { createLayerAnimator, createLayerMotion } from './layers/orbit.ts'
import { clearDetails, paintDetails, paintRelationship, inspectDetails } from './organisms/details.ts'
import type { DetailsTab } from './organisms/details.ts'
import { paintHierarchy } from './organisms/hierarchy.ts'
import { createPins } from './work/pins.ts'
import { createTip } from './organisms/tip.ts'
import { createProjectEditor } from './project/editor.ts'
import { createRevisionControl } from './revision/control.ts'
import { createWorkIsland } from './work/island.ts'
import { toggleWorkSelection } from './work/selection.ts'
import type { WebPayload, WebWorkPayload } from './payload.ts'
import { noSelection, primarySelection, retainSelection, selectArchitecture, selectedArchitecture, selectTask } from './selection.ts'
import { createSourceControl } from './source/control.ts'
import { createTaskDiffControl } from './task-diff/control.ts'
import { readView, writeView } from './url.ts'

const ZOOM_STEP = 1.25
const boot = JSON.parse(document.getElementById('world')!.textContent!) as WebPayload
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
const statsHost = document.getElementById('stats')!
const themeButton = document.getElementById('theme')!
const revisionSelect = document.getElementById('revision') as HTMLDetailsElement
const themeText = themeButton.querySelector<HTMLElement>('.label')!
const detailsHost = document.getElementById('details')!
const detailsClose = document.getElementById('details-close') as HTMLButtonElement
const zoomHost = document.getElementById('zoom')!
const hierarchyContent = document.getElementById('hierarchy-content')!
const hierarchyToggle = document.getElementById('hierarchy-toggle') as HTMLButtonElement
const map = createMap(host)
const projectEditor = createProjectEditor(async profile => {
  const response = await fetch('/project', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  })
  if (!response.ok) throw new Error(await response.text())
})
const shell = createWebShell(document.body, hierarchyContent, hierarchyToggle, detailsHost, map.svg)
const tip = createTip(host)
const pins = createPins(host, id => map.anchorOf(id), id => toggleTask(id), tip)
const island = createWorkIsland(host, id => toggleTask(id), pins.show, tip)
let tree = initialTree()
const opened = readView(location.search, world, work.items, boot.revisions)
let hudVisible = opened.hudVisible
shell.setHud(hudVisible)
let selection = opened.selection
let activeFlows: FlowRef[] = [...opened.flows]
const initial = firstSystem(world)
if (boot.revision === null && selection.kind === 'none' && initial !== undefined) {
  selection = selectArchitecture(noSelection, initial.representationId, false)
}
/** Tasks activated from pins or chips, in activation order; selection is independent and this order supplies its deactivation fallback. */
let activeTaskIds: string[] = selection.kind === 'task' ? [selection.id] : []
let detailsTab: DetailsTab = opened.tab
let theme = opened.theme
const revisionControl = createRevisionControl({
  control: revisionSelect, body: document.body, boot,
  applyRevision: payload => applyWorld(payload, true), applyWorld, applyWork,
})
const source = createSourceControl({
  host: detailsHost, initialFile: opened.file, initialLine: opened.line,
  element: () => worldElement(primarySelection(selection)),
  revision: () => revisionControl.selected, repaint: paintViewState,
})
const taskDiff = createTaskDiffControl({ host: detailsHost, world: () => world, repaint: paintViewState, select })
/** The full-screen grid surrounds a safe camera frame between the floating chrome. */
function viewport(): MapFrame {
  return mapFrame(
    host.getBoundingClientRect(),
    headerHost.getBoundingClientRect(),
    hierarchyHost.getBoundingClientRect(),
    detailsHost.getBoundingClientRect(),
    hudVisible,
  )
}

function fitScene(frame: MapFrame): Camera {
  return pan(fitCamera(scene.bounds, frame), frame.x, frame.y)
}

let fitted: Camera = fitScene(viewport())
let camera: Camera = fitted
/** Once an interaction positions the camera, live refits stop until the viewer presses 0. */
let touched = false
function firstSystem(current: ArchitectureGraph): AnnotatedElement | undefined {
  return current.elements
    .filter(element => element.kind === 'system' && !element.external)
    .sort(compareSemanticElements)[0]
}

function worldElement(id: string | undefined): AnnotatedElement | undefined {
  return id === undefined
    ? undefined
    : world.elements.find(element => element.representationId === id)
}

function worldRelationship(id: string | undefined): AnnotatedRelationship | undefined {
  return id === undefined ? undefined : world.relationships.find(item => item.id === id)
}

function workItem(id: string | undefined): WorkItem | undefined {
  return id === undefined ? undefined : work.items.find(item => item.id === id)
}

/** True for an element, relationship or task id the current payload has. */
function known(id: string | undefined): boolean {
  return worldElement(id) !== undefined || worldRelationship(id) !== undefined || workItem(id) !== undefined
}

let cameraFrame: number | undefined

function applyCamera(): void {
  if (cameraFrame !== undefined) cancelAnimationFrame(cameraFrame)
  cameraFrame = undefined
  const scaleChanged = map.move(camera, camera.k / fitted.k)
  pins.place(camera)
  if (scaleChanged) zoomHost.textContent = zoomReadout(camera, fitted) || '100%'
}

function scheduleCamera(): void {
  if (cameraFrame !== undefined) return
  cameraFrame = requestAnimationFrame(() => {
    cameraFrame = undefined
    applyCamera()
  })
}

function refit(): void {
  fitted = fitScene(viewport())
  camera = fitted
  touched = false
  applyCamera()
}

function fitControl(): void { animateControl(document.getElementById('fit')!, 'fit'); refit() }
function zoomStep(factor: number, control: HTMLElement): void {
  animateControl(control, 'zoom')
  const frame = viewport()
  camera = zoomAbout(camera, factor, { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 }, fitted)
  touched = true
  applyCamera()
}

function paintStats(flowCount: number): void {
  const system = firstSystem(world)
  statsHost.textContent = system === undefined
    ? ''
    : `${system.name} · ${flowCount} flows · ${world.elements.length} elements`
}

/** The URL follows the view, without adding history entries. */
function syncUrl(): void {
  const query = writeView({
    ...(revisionControl.selected === undefined ? {} : { revision: revisionControl.selected }),
    ...(source.file === undefined ? {} : { file: source.file }),
    ...(source.line === undefined ? {} : { line: source.line }),
    selection, flows: activeFlows,
    tab: detailsTab,
    theme,
    hudVisible,
  }, world, work.items)
  history.replaceState(null, '', `${location.pathname}${query}`)
}

function paintMapState(task: WorkItem | undefined, activeTaskItems: WorkItem[]): void {
  const selectedIds = selectedArchitecture(selection)
  const litIds = flowRouteIds(activeFlows, world)
  map.select(selectedIds)
  map.mark(new Set(activeTaskItems.flatMap(item => touchedElements(item, world))))
  pins.activate(activeTaskIds, task?.id)
  island.activate(activeTaskIds, task?.id)
  map.setLitRoutes(litIds, id => elementOnPath(id, litIds, world))
}

function paintViewState(): void {
  syncUrl()
  shell.paint(selection)
  const selectedId = primarySelection(selection)
  const task = selection.kind === 'task' ? workItem(selection.id) : undefined
  const activeTaskItems = activeTaskIds.map(id => workItem(id)).filter((item): item is WorkItem => item !== undefined)
  paintMapState(task, activeTaskItems)
  paintTree()
  const commands = worldCommands(world)
  const actorName = (actorId: string): string | undefined => worldElement(actorId)?.name
  paintFlows(flowsHost, commands, activeFlows, actorName, toggleFlow)
  paintStats(commands.length)
  const selected = worldElement(selectedId)
  const relationship = worldRelationship(selectedId)
  if (source.paint(selected)) return
  if (taskDiff.paint(task)) return
  if (relationship !== undefined) paintRelationship(detailsHost, relationship, world, select)
  else if (selected !== undefined) {
    paintDetails(
      detailsHost,
      inspectDetails(selected, world),
      select,
      toggleFlow,
      activeFlows,
      actorName,
      detailsTab,
      tab => {
        detailsTab = tab
        paintViewState()
      },
      detailsTab === 'how' ? source.methods() : [], source.open,
    )
  }
}

function paintTree(): void {
  paintHierarchy(
    treeHost,
    semanticTreeRows(world, selectedArchitecture(selection), tree),
    new Set(selectedArchitecture(selection)),
    select,
    toggleRow,
  )
}

function toggleRow(row: TreeRow): void {
  tree = toggleExpansion(tree, row)
  paintTree()
}

function select(id: string, additive = false): void {
  if (worldElement(id) === undefined && worldRelationship(id) === undefined) return
  source.clear()
  selection = selectArchitecture(selection, id, additive)
  paintViewState()
}

function applyFocus(next: Camera | undefined, frame: MapFrame): boolean {
  if (next === undefined) return false
  camera = pan(next, frame.x, frame.y)
  touched = true
  applyCamera()
  return true
}
function focusActiveTasks(): void {
  const elementIds = activeTaskIds.flatMap(id => {
    const task = workItem(id)
    return task === undefined ? [] : touchedElements(task, world)
  })
  const frame = viewport()
  applyFocus(fitHighlights(scene, elementIds, frame, zoomLimits(fitted).max), frame)
}

/** A pin or chip click selects its task; only clicking the selected task again deactivates it. */
function toggleTask(id: string): void {
  const next = toggleWorkSelection(activeTaskIds, selection.kind === 'task' ? selection.id : undefined, id)
  activeTaskIds = next.active
  source.clear()
  selection = next.selected === undefined ? noSelection : selectTask(next.selected)
  paintViewState()
  focusActiveTasks()
}

function deselect(): void {
  source.clear()
  selection = noSelection
  activeTaskIds = []
  activeFlows = []
  paintViewState()
}

function toggleFlow(flow: FlowRef): void {
  activeFlows = toggleFlowActivation(activeFlows, flow)
  paintViewState()
}

/** The pane takes the wheel wherever the cursor is, pins included; the Live work island keeps it for its chip strip. */
host.addEventListener('wheel', event => {
  if (event.target instanceof Element && event.target.closest('#work')) return
  event.preventDefault()
  const action = wheelAction(event)
  if (action.kind === 'pan') camera = pan(camera, action.dx, action.dy)
  else {
    const rect = host.getBoundingClientRect()
    camera = zoomAbout(camera, action.factor, { x: event.clientX - rect.left, y: event.clientY - rect.top }, fitted)
  }
  touched = true
  scheduleCamera()
}, { passive: false })

bindMapPointer(map, {
  orbiting: () => layerMotion.active,
  pan(dx, dy) {
    camera = pan(camera, dx, dy)
    touched = true
    scheduleCamera()
  },
  orbit(dx, dy) {
    touched = true
    layerAnimator.orbit(dx, dy)
  },
  select,
  deselect,
  editProject() {
    if (revisionControl.selected === undefined && project !== undefined) projectEditor.open(project)
  },
})
map.svg.addEventListener('keydown', event => {
  if (!map.isProjectEdit(event.target) || (event.key !== 'Enter' && event.key !== ' ')) return
  event.preventDefault()
  if (revisionControl.selected === undefined && project !== undefined) projectEditor.open(project)
})

document.getElementById('zoom-in')!.addEventListener('click', event => zoomStep(ZOOM_STEP, event.currentTarget as HTMLElement))
document.getElementById('zoom-out')!.addEventListener('click', event => zoomStep(1 / ZOOM_STEP, event.currentTarget as HTMLElement))
document.getElementById('fit')!.addEventListener('click', fitControl)
detailsClose.addEventListener('click', deselect)

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
    camera = fitted
    touched = false
  } else camera = pan(camera, (before.x - after.x) * camera.k, (before.y - after.y) * camera.k)
  applyCamera()
  const task = selection.kind === 'task' ? workItem(selection.id) : undefined
  paintMapState(task, activeTaskIds.map(id => workItem(id)).filter((item): item is WorkItem => item !== undefined))
}

const layerAnimator = createLayerAnimator(layerMotion, repaintLayerScene)

function toggleLayers(): void {
  layerAnimator.toggle()
}
function applyTheme(): void {
  const next = nextTheme(theme)
  themeButton.dataset.nextTheme = next
  themeText.textContent = themeLabel(next)
  if (theme === 'light') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
  syncUrl()
}

const transitionTheme = createThemeTransition(document.body)
themeButton.addEventListener('click', () => transitionTheme(() => {
  theme = nextTheme(theme)
  applyTheme()
}))
applyTheme()

document.addEventListener('keydown', event => {
  if (event.metaKey || event.ctrlKey || event.altKey) return
  const shortcut = event.key === 'F1' ? toggleHud
    : event.key === 'F2' ? toggleLayers
    : event.key === 'F3' ? debug.toggle
    : undefined
  if (shortcut !== undefined) {
    event.preventDefault()
    shortcut()
    return
  }
  const action = keyAction(event.key, keyTarget(event.target))
  if (action === undefined) return
  event.preventDefault()
  if (action === 'in') zoomStep(ZOOM_STEP, document.getElementById('zoom-in')!)
  else if (action === 'out') zoomStep(1 / ZOOM_STEP, document.getElementById('zoom-out')!)
  else if (action === 'fit') fitControl()
  else if (action === 'deselect') deselect()
})

let lastViewport = viewport()
const resizeObserver = new ResizeObserver(() => {
  const next = viewport()
  if (touched) {
    camera = pan(
      camera,
      next.x + next.width / 2 - lastViewport.x - lastViewport.width / 2,
      next.y + next.height / 2 - lastViewport.y - lastViewport.height / 2,
    )
    fitted = fitScene(next)
    applyCamera()
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
    source.clear()
    tree = initialTree()
    activeTaskIds = []
    activeFlows = []
    selection = noSelection
    detailsTab = 'what'
    camera = fitted
    touched = false
  } else {
    if (!touched) camera = fitted
    activeTaskIds = activeTaskIds.filter(id => workItem(id) !== undefined)
    activeFlows = activeFlows.filter(flow => {
      return worldRelationship(flow.commandId) !== undefined
        && (flow.actorId === undefined || worldElement(flow.actorId)?.kind === 'actor')
    })
    selection = retainSelection(selection, id => known(id))
  }
  debug.paint(() => map.paint(scene))
  revisionControl.paintProjectEdit(map.svg)
  pins.paint(currentPins)
  island.paint(payload.pins, work.statuses, work.defaultStatus)
  applyCamera()
  paintViewState()
}

/** Repaints only the optional Backlog layer; map projection, painting and camera state stay unchanged. */
function applyWork(payload: WebWorkPayload): void {
  const ownedDetails = selection.kind === 'task'
  work = payload.work
  currentPins = payload.pins
  activeTaskIds = activeTaskIds.filter(id => workItem(id) !== undefined)
  selection = retainSelection(selection, id => known(id))
  pins.paint(payload.pins)
  island.paint(payload.pins, work.statuses, work.defaultStatus)
  syncUrl()
  shell.paint(selection)
  const task = selection.kind === 'task' ? workItem(selection.id) : undefined
  const active = activeTaskIds.map(id => workItem(id)).filter((item): item is WorkItem => item !== undefined)
  map.mark(new Set(active.flatMap(item => touchedElements(item, world))))
  pins.activate(activeTaskIds, task?.id)
  island.activate(activeTaskIds, task?.id)
  if (!ownedDetails) return
  if (!taskDiff.paint(task)) clearDetails(detailsHost)
}

debug.paint(() => map.paint(scene))
revisionControl.paintProjectEdit(map.svg)
pins.paint(currentPins)
island.paint(boot.pins, work.statuses, work.defaultStatus)
applyCamera()
paintViewState()
source.restore()
if (selection.kind === 'task') focusActiveTasks()
