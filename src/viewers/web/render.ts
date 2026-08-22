import { compareElements } from '../../element-order.ts'
import type { ArchitectureWorld, WorldElement } from '../../types.ts'
import { actionPath, elementOnPath, worldCommands } from '../action-path.ts'
import { initialTree, toggleExpansion, treeRows } from '../tui/tree.ts'
import type { TreeRow } from '../tui/tree.ts'
import {
  cameraTransform,
  fitCamera,
  keyAction,
  pan,
  resized,
  wheelFactor,
  zoomAbout,
  zoomReadout,
} from './iso/camera.ts'
import type { Camera, KeyTarget, Viewport } from './iso/camera.ts'
import { createMap } from './iso/map.ts'
import { projectScene } from './iso/project.ts'
import type { ProjectedScene } from './iso/project.ts'
import { paintDetails, inspectDetails, nextActiveAction } from './organisms/details.ts'
import type { ActiveAction, DetailsTab } from './organisms/details.ts'
import { paintFlows } from './organisms/flows.ts'
import { paintHierarchy } from './organisms/hierarchy.ts'
import type { WebPayload } from './payload.ts'

const ZOOM_STEP = 1.25
const DRAG_THRESHOLD = 4

const boot = JSON.parse(document.getElementById('world')!.textContent!) as WebPayload
let world = boot.world
let applied = boot.generation
let scene: ProjectedScene = projectScene(boot.sheet)

const host = document.getElementById('map')!
const treeHost = document.getElementById('tree')!
const flowsHost = document.getElementById('flows')!
const statsHost = document.getElementById('stats')!
const themeButton = document.getElementById('theme')!
const detailsHost = document.getElementById('details')!
const actionHost = document.getElementById('action')!
const zoomHost = document.getElementById('zoom')!

const map = createMap(host)
let tree = initialTree()
let selectedId = firstSystem(world)?.representationId
let activeAction: ActiveAction = {}
let detailsTab: DetailsTab = 'what'

function viewport(): Viewport {
  return { width: host.clientWidth, height: host.clientHeight }
}

let fitted: Camera = fitCamera(scene.bounds, viewport())
let camera: Camera = fitted
/** Once the person moved the camera, refits stop until they press 0. */
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

function applyCamera(animate: boolean): void {
  map.camera.classList.toggle('animate', animate)
  map.camera.style.transform = cameraTransform(camera)
  zoomHost.textContent = zoomReadout(camera, fitted)
}

function refit(animate: boolean): void {
  fitted = fitCamera(scene.bounds, viewport())
  camera = fitted
  touched = false
  applyCamera(animate)
}

function zoomStep(factor: number): void {
  const { width, height } = viewport()
  camera = zoomAbout(camera, factor, { x: width / 2, y: height / 2 }, fitted)
  touched = true
  applyCamera(true)
}

function paintAction(): void {
  const active = world.relationships.find(item => item.id === activeAction.id)
  if (active === undefined) {
    actionHost.textContent = 'drag pan · scroll zoom · + − 0'
    actionHost.classList.add('hint')
    return
  }
  actionHost.textContent = `${active.description}   x clear`
  actionHost.classList.remove('hint')
}

function paintStats(flowCount: number): void {
  const system = firstSystem(world)
  statsHost.textContent = system === undefined
    ? ''
    : `${system.name} · ${flowCount} flows · ${world.elements.length} elements`
}

function paintSelection(): void {
  const litIds = actionPath(activeAction.id, world, activeAction.personId)
  map.select(selectedId)
  map.setFlow(litIds, id => elementOnPath(id, litIds, world))
  paintHierarchy(treeHost, treeRows(world, selectedId, tree), selectedId, select, toggleRow)
  const commands = worldCommands(world)
  paintFlows(flowsHost, commands, activeAction.id, pickAction)
  paintStats(commands.length)
  const selected = worldElement(selectedId)
  if (selected) {
    paintDetails(
      detailsHost,
      inspectDetails(selected, world),
      select,
      (id, ownCommand) => pickAction(id, ownCommand ? selected.representationId : undefined),
      activeAction.id,
      detailsTab,
      tab => {
        detailsTab = tab
        paintSelection()
      },
    )
  }
  paintAction()
}

function toggleRow(row: TreeRow): void {
  tree = toggleExpansion(tree, row)
  paintHierarchy(treeHost, treeRows(world, selectedId, tree), selectedId, select, toggleRow)
}

function select(id: string): void {
  if (!worldElement(id)) return
  selectedId = id
  activeAction = nextActiveAction(activeAction, { type: 'select' })
  paintSelection()
}

function pickAction(id: string, personId?: string): void {
  activeAction = nextActiveAction(activeAction, { type: 'pick', id, personId })
  paintSelection()
}

function clearAction(): void {
  activeAction = nextActiveAction(activeAction, { type: 'clear' })
  paintSelection()
}

let pointer: {
  id: number
  x: number
  y: number
  dragging: boolean
  targetId: string | undefined
} | null = null

map.svg.addEventListener('wheel', event => {
  event.preventDefault()
  const rect = map.svg.getBoundingClientRect()
  camera = zoomAbout(
    camera,
    wheelFactor(event.deltaY),
    { x: event.clientX - rect.left, y: event.clientY - rect.top },
    fitted,
  )
  touched = true
  applyCamera(false)
}, { passive: false })

map.svg.addEventListener('pointerdown', event => {
  if (event.button !== 0) return
  pointer = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    dragging: false,
    targetId: map.hitId(event.target),
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
  applyCamera(false)
  pointer.x = event.clientX
  pointer.y = event.clientY
})
map.svg.addEventListener('pointerup', event => {
  if (pointer === null || pointer.id !== event.pointerId) return
  if (!pointer.dragging && pointer.targetId !== undefined) select(pointer.targetId)
  pointer = null
})
map.svg.addEventListener('pointercancel', () => {
  pointer = null
})

document.getElementById('zoom-in')!.addEventListener('click', () => zoomStep(ZOOM_STEP))
document.getElementById('zoom-out')!.addEventListener('click', () => zoomStep(1 / ZOOM_STEP))

let darkTheme = false
themeButton.addEventListener('click', () => {
  darkTheme = !darkTheme
  themeButton.textContent = darkTheme ? 'Light' : 'Dark'
  if (darkTheme) document.documentElement.dataset.theme = 'dark'
  else delete document.documentElement.dataset.theme
})

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
  else if (action === 'fit') refit(true)
  else clearAction()
})

let lastViewport = viewport()
new ResizeObserver(() => {
  const next = viewport()
  if (touched) {
    camera = resized(camera, lastViewport, next)
    fitted = fitCamera(scene.bounds, next)
    applyCamera(false)
  } else {
    refit(false)
  }
  lastViewport = next
}).observe(host)

function applyWorld(payload: WebPayload): void {
  world = payload.world
  scene = projectScene(payload.sheet)
  fitted = fitCamera(scene.bounds, viewport())
  if (!touched) camera = fitted
  if (!worldElement(selectedId)) selectedId = firstSystem(world)?.representationId
  map.paint(scene)
  applyCamera(false)
  paintSelection()
}

map.paint(scene)
applyCamera(false)
paintSelection()

const events = new EventSource('/events')
events.addEventListener('world', event => {
  const payload = JSON.parse(event.data) as WebPayload
  if (payload.generation <= applied) return
  applied = payload.generation
  applyWorld(payload)
})
