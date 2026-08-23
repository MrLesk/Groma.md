import { compareElements } from '../../element-order.ts'
import type { ArchitectureWorld, WorkItem, WorldElement, WorldRelationship } from '../../types.ts'
import { touchedElements } from '../../work/pins.ts'
import { elementOnPath, flowRouteIds, worldCommands } from '../action-path.ts'
import type { FlowRef } from '../action-path.ts'
import { initialTree, toggleExpansion, treeRows } from '../tui/tree.ts'
import type { TreeRow } from '../tui/tree.ts'
import { paintFlowDetails } from './flow/details.ts'
import { paintFlows } from './flow/list.ts'
import { sameFlow, toggleFlowSelection } from './flow/state.ts'
import {
  fitHighlights,
  fitCamera,
  keyAction,
  pan,
  resized,
  wheelAction,
  zoomAbout,
  zoomLimits,
  zoomReadout,
} from './iso/camera.ts'
import type { Camera, KeyTarget, Viewport } from './iso/camera.ts'
import { createMap } from './iso/map.ts'
import { projectScene } from './iso/project.ts'
import type { ProjectedScene } from './iso/project.ts'
import { clearDetails, paintDetails, paintRelationship, paintTask, inspectDetails } from './organisms/details.ts'
import type { DetailsTab } from './organisms/details.ts'
import { paintHierarchy } from './organisms/hierarchy.ts'
import { createPins } from './work/pins.ts'
import { createTip } from './organisms/tip.ts'
import { createWorkIsland } from './work/island.ts'
import { toggleWorkSelection } from './work/selection.ts'
import type { WebPayload, WebWorkPayload } from './payload.ts'
import {
  noSelection,
  primarySelection,
  retainSelection,
  selectArchitecture,
  selectedArchitecture,
  selectedFlow,
  selectFlow,
  selectTask,
} from './selection.ts'
import { readView, writeView } from './url.ts'

const ZOOM_STEP = 1.25
const DRAG_THRESHOLD = 4

const boot = JSON.parse(document.getElementById('world')!.textContent!) as WebPayload
let world = boot.world
let work = boot.work
let appliedWorld = boot.generation
let appliedWork = boot.workGeneration
let scene: ProjectedScene = projectScene(boot.sheet)

const host = document.getElementById('map')!
const treeHost = document.getElementById('tree')!
const flowsHost = document.getElementById('flows')!
const statsHost = document.getElementById('stats')!
const themeButton = document.getElementById('theme')!
const detailsHost = document.getElementById('details')!
const zoomHost = document.getElementById('zoom')!

const map = createMap(host)
const tip = createTip(host)
const pins = createPins(host, id => map.anchorOf(id), id => toggleTask(id), tip)
const island = createWorkIsland(host, id => toggleTask(id), pins.show, tip)
let tree = initialTree()
const opened = readView(location.search, world, work.items)
let selection = opened.selection
let activeFlows: FlowRef[] = [...opened.flows]
const initial = firstSystem(world)
if (selection.kind === 'none' && initial !== undefined) {
  selection = selectArchitecture(noSelection, initial.representationId, false)
}
/** Tasks activated from pins or chips, in activation order; selection is independent and this order supplies its deactivation fallback. */
let activeTaskIds: string[] = selection.kind === 'task' ? [selection.id] : []
let detailsTab: DetailsTab = opened.tab
let darkTheme = opened.dark

function viewport(): Viewport {
  return { width: host.clientWidth, height: host.clientHeight }
}

let fitted: Camera = fitCamera(scene.bounds, viewport())
let camera: Camera = fitted
/** Once an interaction positions the camera, live refits stop until the viewer presses 0. */
let touched = false

function firstSystem(current: ArchitectureWorld): WorldElement | undefined {
  return current.elements
    .filter(element => element.kind === 'system' && !element.external)
    .sort(compareElements)[0]
}

function worldElement(id: string | undefined): WorldElement | undefined {
  return id === undefined
    ? undefined
    : world.elements.find(element => element.representationId === id)
}

function worldRelationship(id: string | undefined): WorldRelationship | undefined {
  return id === undefined ? undefined : world.relationships.find(item => item.id === id)
}

function workItem(id: string | undefined): WorkItem | undefined {
  return id === undefined ? undefined : work.items.find(item => item.id === id)
}

/** True for an element, relationship or task id the current payload has. */
function known(id: string | undefined): boolean {
  return worldElement(id) !== undefined || worldRelationship(id) !== undefined || workItem(id) !== undefined
}

function applyCamera(): void {
  map.move(camera, camera.k / fitted.k)
  pins.place(camera)
  zoomHost.textContent = zoomReadout(camera, fitted)
}

function refit(): void {
  fitted = fitCamera(scene.bounds, viewport())
  camera = fitted
  touched = false
  applyCamera()
}

function zoomStep(factor: number): void {
  const { width, height } = viewport()
  camera = zoomAbout(camera, factor, { x: width / 2, y: height / 2 }, fitted)
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
  const query = writeView({ selection, flows: activeFlows, tab: detailsTab, dark: darkTheme }, world, work.items)
  history.replaceState(null, '', `${location.pathname}${query}`)
}

function paintSelection(): void {
  syncUrl()
  const selectedId = primarySelection(selection)
  const selectedIds = selectedArchitecture(selection)
  const litIds = flowRouteIds(activeFlows, world)
  const flow = selectedFlow(selection)
  const activeCommandIds = new Set(activeFlows.map(item => item.commandId))
  const task = selection.kind === 'task' ? workItem(selection.id) : undefined
  const activeTaskItems = activeTaskIds.map(id => workItem(id)).filter((item): item is WorkItem => item !== undefined)
  map.select(selectedIds)
  map.mark(new Set(activeTaskItems.flatMap(item => touchedElements(item, world))))
  pins.activate(activeTaskIds, task?.id)
  island.activate(activeTaskIds, task?.id)
  map.setLitRoutes(litIds, id => elementOnPath(id, litIds, world))
  paintTree()
  const commands = worldCommands(world)
  paintFlows(flowsHost, commands, activeFlows, flow, pickCommand)
  paintStats(commands.length)
  const selected = worldElement(selectedId)
  const relationship = worldRelationship(selectedId)
  if (flow !== undefined) paintFlowDetails(detailsHost, flow, world, select)
  else if (relationship !== undefined) paintRelationship(detailsHost, relationship, world, select)
  else if (task !== undefined) paintTask(detailsHost, task, world, select)
  else if (selected === undefined) clearDetails(detailsHost)
  else {
    paintDetails(
      detailsHost,
      inspectDetails(selected, world),
      select,
      (id, ownCommand) => toggleFlow({
        commandId: id,
        ...(ownCommand ? { actorId: selected.representationId } : {}),
      }),
      activeCommandIds,
      detailsTab,
      tab => {
        detailsTab = tab
        paintSelection()
      },
    )
  }
}

function paintTree(): void {
  paintHierarchy(
    treeHost,
    treeRows(world, selectedArchitecture(selection), tree),
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
  selection = selectArchitecture(selection, id, additive)
  paintSelection()
}

function focusActiveTasks(): void {
  const elementIds = activeTaskIds.flatMap(id => {
    const task = workItem(id)
    return task === undefined ? [] : touchedElements(task, world)
  })
  const focused = fitHighlights(scene, elementIds, viewport(), zoomLimits(fitted).max)
  if (focused === undefined) return
  camera = focused
  touched = true
  applyCamera()
}

/** A pin or chip click selects its task; only clicking the selected task again deactivates it. */
function toggleTask(id: string): void {
  const next = toggleWorkSelection(activeTaskIds, selection.kind === 'task' ? selection.id : undefined, id)
  activeTaskIds = next.active
  selection = next.selected === undefined ? noSelection : selectTask(next.selected)
  paintSelection()
  focusActiveTasks()
}

function deselect(): void {
  selection = noSelection
  activeTaskIds = []
  activeFlows = []
  paintSelection()
}

function pickCommand(commandId: string): void {
  const selected = selectedFlow(selection)
  const flow = selected?.commandId === commandId
    ? selected
    : activeFlows.findLast(item => item.commandId === commandId) ?? { commandId }
  toggleFlow(flow)
}

function toggleFlow(flow: FlowRef): void {
  const next = toggleFlowSelection(activeFlows, selectedFlow(selection), flow)
  activeFlows = next.active
  selection = next.selected === undefined ? noSelection : selectFlow(next.selected)
  paintSelection()
}

let pointer: {
  id: number
  x: number
  y: number
  dragging: boolean
  targetId: string | undefined
  onSheet: boolean
  additive: boolean
} | null = null

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
  applyCamera()
}, { passive: false })

map.svg.addEventListener('pointerdown', event => {
  if (event.button !== 0) return
  pointer = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    dragging: false,
    targetId: map.hitId(event.target),
    onSheet: map.isSheet(event.target),
    additive: event.shiftKey,
  }
  map.svg.setPointerCapture(event.pointerId)
})
map.svg.addEventListener('pointermove', event => {
  if (pointer === null || pointer.id !== event.pointerId) return
  const dx = event.clientX - pointer.x
  const dy = event.clientY - pointer.y
  if (!pointer.dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) pointer.dragging = true
  if (!pointer.dragging) return
  camera = pan(camera, dx, dy)
  touched = true
  applyCamera()
  pointer.x = event.clientX
  pointer.y = event.clientY
})
map.svg.addEventListener('pointerup', event => {
  if (pointer === null || pointer.id !== event.pointerId) return
  if (!pointer.dragging) {
    if (pointer.targetId !== undefined) select(pointer.targetId, pointer.additive)
    else if (pointer.onSheet) deselect()
  }
  pointer = null
})
map.svg.addEventListener('pointercancel', () => {
  pointer = null
})

document.getElementById('zoom-in')!.addEventListener('click', () => zoomStep(ZOOM_STEP))
document.getElementById('zoom-out')!.addEventListener('click', () => zoomStep(1 / ZOOM_STEP))

function applyTheme(): void {
  themeButton.textContent = darkTheme ? 'Light' : 'Dark'
  if (darkTheme) document.documentElement.dataset.theme = 'dark'
  else delete document.documentElement.dataset.theme
  syncUrl()
}

themeButton.addEventListener('click', () => {
  darkTheme = !darkTheme
  applyTheme()
})
applyTheme()

function keyTarget(target: EventTarget | null): KeyTarget {
  if (!(target instanceof Element)) return 'other'
  if (target.closest('input, textarea, [contenteditable]')) return 'text'
  if (target.closest('#tree')) return 'hierarchy'
  if (target.closest('button, select')) return 'control'
  return 'other'
}

document.addEventListener('keydown', event => {
  if (event.metaKey || event.ctrlKey || event.altKey) return
  const action = keyAction(event.key, keyTarget(event.target))
  if (action === undefined) return
  event.preventDefault()
  if (action === 'in') zoomStep(ZOOM_STEP)
  else if (action === 'out') zoomStep(1 / ZOOM_STEP)
  else if (action === 'fit') refit()
  else if (action === 'deselect') deselect()
})

let lastViewport = viewport()
new ResizeObserver(() => {
  const next = viewport()
  if (touched) {
    camera = resized(camera, lastViewport, next)
    fitted = fitCamera(scene.bounds, next)
    applyCamera()
  } else {
    refit()
  }
  lastViewport = next
}).observe(host)

function applyWorld(payload: WebPayload): void {
  world = payload.world
  work = payload.work
  scene = projectScene(payload.sheet)
  fitted = fitCamera(scene.bounds, viewport())
  if (!touched) camera = fitted
  activeTaskIds = activeTaskIds.filter(id => workItem(id) !== undefined)
  activeFlows = activeFlows.filter(flow => {
    return worldRelationship(flow.commandId) !== undefined
      && (flow.actorId === undefined || worldElement(flow.actorId)?.kind === 'actor')
  })
  const hadSelection = primarySelection(selection) !== undefined
  selection = retainSelection(selection, id => known(id))
  if (selection.kind === 'flow') {
    const selected = selection.flow
    if (!activeFlows.some(flow => sameFlow(flow, selected))) {
      const fallback = activeFlows.at(-1)
      selection = fallback === undefined ? noSelection : selectFlow(fallback)
    }
  }
  if (hadSelection && primarySelection(selection) === undefined) {
    const first = firstSystem(world)
    selection = first === undefined
      ? noSelection
      : selectArchitecture(noSelection, first.representationId, false)
  }
  map.paint(scene)
  pins.paint(payload.pins)
  island.paint(payload.pins, work.statuses, work.defaultStatus)
  applyCamera()
  paintSelection()
}

/** Repaints only the optional Backlog layer; map projection, painting and camera state stay unchanged. */
function applyWork(payload: WebWorkPayload): void {
  const ownedDetails = selection.kind === 'task'
  work = payload.work
  activeTaskIds = activeTaskIds.filter(id => workItem(id) !== undefined)
  selection = retainSelection(selection, id => known(id))
  pins.paint(payload.pins)
  island.paint(payload.pins, work.statuses, work.defaultStatus)
  syncUrl()
  const task = selection.kind === 'task' ? workItem(selection.id) : undefined
  const active = activeTaskIds.map(id => workItem(id)).filter((item): item is WorkItem => item !== undefined)
  map.mark(new Set(active.flatMap(item => touchedElements(item, world))))
  pins.activate(activeTaskIds, task?.id)
  island.activate(activeTaskIds, task?.id)
  if (!ownedDetails) return
  if (task === undefined) clearDetails(detailsHost)
  else paintTask(detailsHost, task, world, select)
}

map.paint(scene)
pins.paint(boot.pins)
island.paint(boot.pins, work.statuses, work.defaultStatus)
applyCamera()
paintSelection()
if (selection.kind === 'task') focusActiveTasks()

const events = new EventSource('/events')
events.addEventListener('world', event => {
  const payload = JSON.parse(event.data) as WebPayload
  if (payload.generation <= appliedWorld) return
  appliedWorld = payload.generation
  appliedWork = Math.max(appliedWork, payload.workGeneration)
  applyWorld(payload)
})
events.addEventListener('work', event => {
  const payload = JSON.parse(event.data) as WebWorkPayload
  if (payload.workGeneration <= appliedWork) return
  appliedWork = payload.workGeneration
  applyWork(payload)
})
