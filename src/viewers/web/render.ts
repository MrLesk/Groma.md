import type {
  ArchitectureWorld,
  Point,
  SemanticLevel,
  WorldElement,
  WorldRelationship,
} from '../../types.ts'
import {
  actionLegs,
  actionPath,
  worldCommands,
} from '../action-path.ts'
import { initialTree, toggleExpansion, treeRows } from '../tui/tree.ts'
import type { TreeRow } from '../tui/tree.ts'
import { palettes, setPalette } from './atoms/theme.ts'
import { initialPlayback, nextPlayback } from './flow-playback.ts'
import { paintDetails, inspectDetails, nextActiveAction } from './organisms/details.ts'
import type { ActiveAction, DetailsTab } from './organisms/details.ts'
import { paintFlows } from './organisms/flows.ts'
import { paintHierarchy } from './organisms/hierarchy.ts'
import { SvgFlow } from './svg-flow.ts'
import { paintSvgMap } from './svg-dom.ts'
import {
  buildSvgScene,
  cameraViewBox,
  defaultProjection,
  enterSemanticScope,
  fitCamera,
  leaveSemanticScope,
  orbitProjection,
  panCamera,
  resizeCamera,
  selectionScope,
  semanticKeyAction,
  synchronizeSemanticScope,
  zoomAt,
} from './svg-scene.ts'
import type {
  Projection,
  SemanticKeyTarget,
  SemanticScope,
  SvgCamera,
  SvgScene,
} from './svg-scene.ts'

const svgNamespace = 'http://www.w3.org/2000/svg'

function svgElement<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(svgNamespace, tag)
}

function worldElement(
  world: ArchitectureWorld,
  id: string | undefined,
): WorldElement | undefined {
  return id === undefined
    ? undefined
    : world.elements.find(element => element.representationId === id)
}

let tree = initialTree()

const boot = JSON.parse(document.getElementById('world')!.textContent!) as {
  generation: number
  world: ArchitectureWorld
}
let world = boot.world
let applied = boot.generation

const host = document.getElementById('map')!
const treeHost = document.getElementById('tree')!
const flowsHost = document.getElementById('flows')!
const statsHost = document.getElementById('stats')!
const themeButton = document.getElementById('theme')!
const detailsHost = document.getElementById('details')!
const actionHost = document.getElementById('action')!
const zoomHost = document.getElementById('zoom')!
const flowHost = document.getElementById('flow')!
const flowNameHost = document.getElementById('flow-name')!
const pauseButton = document.getElementById('flow-pause')!
const stepButton = document.getElementById('flow-step')!
const rateButtons: [HTMLElement, number][] = [
  [document.getElementById('rate-half')!, 0.5],
  [document.getElementById('rate-one')!, 1],
  [document.getElementById('rate-two')!, 2],
]
const button2d = document.getElementById('mode-2d')!
const button3d = document.getElementById('mode-3d')!

let projection: Projection = defaultProjection
const initialSemantic = synchronizeSemanticScope(world, {
  level: 'context',
  focusId: null,
  selectedId: undefined,
})
let level: SemanticLevel = initialSemantic.scope.level
let focusId: string | null = initialSemantic.scope.focusId
let selectedId = initialSemantic.scope.selectedId
let hoverId: string | undefined
let activeAction: ActiveAction = {}
let detailsTab: DetailsTab = 'what'
let playback = initialPlayback
let semantic = initialSemantic.view
let scene: SvgScene = buildSvgScene(semantic, projection)
let camera: SvgCamera = fitCamera(scene, host.clientWidth, host.clientHeight)

const mapSvg = svgElement('svg')
mapSvg.setAttribute('xmlns', svgNamespace)
mapSvg.setAttribute('role', 'img')
mapSvg.setAttribute('aria-label', 'Architecture map')
mapSvg.tabIndex = 0
host.replaceChildren(mapSvg)

const flow = new SvgFlow()

function selectedElement(): WorldElement | undefined {
  return worldElement(world, selectedId)
}

function applyCamera(): void {
  const box = cameraViewBox(camera)
  mapSvg.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`)
  mapSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  zoomHost.textContent = Math.abs(camera.zoom - 1) < 1e-6
    ? ''
    : `${Math.round(camera.zoom * 100)}%`
}

function paintMap(pathIds: Set<string>): void {
  paintSvgMap({
    mapSvg,
    semantic,
    scene,
    world,
    selectedId,
    hoverId,
    pathIds,
    applyCamera,
    appendFlow: () => flow.appendTo(mapSvg),
  })
}

function clientPoint(clientX: number, clientY: number): Point {
  const rect = mapSvg.getBoundingClientRect()
  const view = cameraViewBox(camera)
  const width = Math.max(rect.width, 1)
  const height = Math.max(rect.height, 1)
  return {
    x: view.x + ((clientX - rect.left) / width) * view.width,
    y: view.y + ((clientY - rect.top) / height) * view.height,
  }
}

function hitId(target: EventTarget | null): string | undefined {
  if (!(target instanceof Element)) return undefined
  return target.closest('[data-selectable="true"]')?.getAttribute('data-id') ?? undefined
}

function clearFlow(): void {
  playback = initialPlayback
  flow.clear()
}

function syncFlow(pathIds: Set<string>): void {
  const key = pathIds.size === 0
    ? ''
    : `${activeAction.id}:${activeAction.personId ?? ''}:${level}:${focusId ?? ''}`
  flow.sync(key, scene.routes.map(route => ({ id: route.route.id, points: route.points })), pathIds)
}

function walkLegs(): WorldRelationship[] {
  return actionLegs(activeAction.id, world, activeAction.personId)
}

function litRoutes(): Set<string> {
  return actionPath(activeAction.id, world, activeAction.personId)
}

function paintFlow(legs = walkLegs()): void {
  const active = world.relationships.find(item => item.id === activeAction.id)
  flowHost.hidden = active === undefined
  if (active === undefined) {
    actionHost.textContent = 'drag pan · right-drag orbit · scroll zoom'
    actionHost.classList.add('hint')
    return
  }
  const names = new Map(world.elements.map(item => [item.representationId, item.name]))
  const nameOf = (id: string): string => names.get(id) ?? id
  flowNameHost.textContent = active.description
  pauseButton.textContent = playback.paused ? 'Play' : 'Pause'
  for (const [button, rate] of rateButtons) button.classList.toggle('active', playback.rate === rate)
  const leg = playback.step === null ? undefined : legs[playback.step]
  actionHost.textContent = leg === undefined
    ? `${active.description}   x clear`
    : `step ${playback.step! + 1}/${legs.length} · ${nameOf(leg.source)}`
      + ` → ${nameOf(leg.target)} · ${leg.description}   x clear`
  actionHost.classList.remove('hint')
  flow.paint(playback.step, legs, playback.paused, playback.rate)
}

function paintStats(flowCount: number): void {
  const system = world.elements.find(element =>
    element.kind === 'system' && element.origin === 'observed' && !element.external)
  statsHost.textContent = system === undefined
    ? ''
    : `${system.name} · ${flowCount} flows · ${world.elements.length} elements`
}

function paintSelection(): void {
  const legs = walkLegs()
  const pathIds = new Set(legs.map(leg => leg.id))
  syncFlow(pathIds)
  paintHierarchy(treeHost, treeRows(world, selectedId, tree), selectedId, select, toggleRow)
  const commands = worldCommands(world)
  paintFlows(flowsHost, commands, activeAction.id, pickAction)
  paintStats(commands.length)
  const selected = selectedElement()
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
  paintFlow(legs)
  paintMap(pathIds)
}

function toggleRow(row: TreeRow): void {
  tree = toggleExpansion(tree, row)
  paintHierarchy(treeHost, treeRows(world, selectedId, tree), selectedId, select, toggleRow)
}

function select(id: string): void {
  const next = selectionScope(world, id)
  if (!next) return
  const scopeChanged = next.level !== level || next.focusId !== focusId
  level = next.level
  focusId = next.focusId
  selectedId = next.selectedId
  activeAction = nextActiveAction(activeAction, { type: 'select' })
  if (scopeChanged) rebuildSemantic(true)
  else paintSelection()
}

function pickAction(id: string, personId?: string): void {
  activeAction = nextActiveAction(activeAction, { type: 'pick', id, personId })
  paintSelection()
}

function rebuildScene(resetCamera: boolean, resetPlayback = true): void {
  scene = buildSvgScene(semantic, projection)
  if (resetCamera) camera = fitCamera(scene, host.clientWidth, host.clientHeight)
  if (resetPlayback) clearFlow()
  paintSelection()
}

function rebuildSemantic(resetCamera: boolean): void {
  const next = synchronizeSemanticScope(world, {
    level,
    focusId,
    selectedId,
  })
  level = next.scope.level
  focusId = next.scope.focusId
  selectedId = next.scope.selectedId
  semantic = next.view
  rebuildScene(resetCamera)
}

function transition(direction: 'enter' | 'leave'): void {
  const scope: SemanticScope = { level, focusId, selectedId }
  const next = direction === 'enter'
    ? enterSemanticScope(world, scope)
    : leaveSemanticScope(world, scope)
  if (next.level === level && next.focusId === focusId && next.selectedId === selectedId) return
  level = next.level
  focusId = next.focusId
  selectedId = next.selectedId
  rebuildSemantic(true)
}

function setProjection(next: Projection, fit = false): void {
  projection = next
  button2d.classList.toggle('active', Math.abs(next.elevation - Math.PI / 2) < 1e-6)
  button3d.classList.toggle('active', !button2d.classList.contains('active'))
  rebuildScene(fit, false)
}

function zoomBy(factor: number): void {
  camera = zoomAt(camera, factor, camera.center)
  applyCamera()
}

function resize(): void {
  camera = resizeCamera(camera, host.clientWidth, host.clientHeight)
  applyCamera()
}

let pointer: {
  x: number
  y: number
  dragging: boolean
  orbiting: boolean
  targetId: string | undefined
} | null = null

mapSvg.addEventListener('wheel', event => {
  event.preventDefault()
  const anchor = clientPoint(event.clientX, event.clientY)
  camera = zoomAt(camera, Math.exp(-event.deltaY * 0.002), anchor)
  applyCamera()
}, { passive: false })

mapSvg.addEventListener('contextmenu', event => event.preventDefault())
mapSvg.addEventListener('pointerdown', event => {
  pointer = {
    x: event.clientX,
    y: event.clientY,
    dragging: false,
    orbiting: event.button === 2 || event.ctrlKey || event.altKey,
    targetId: hitId(event.target),
  }
  mapSvg.setPointerCapture(event.pointerId)
})
mapSvg.addEventListener('pointermove', event => {
  if (pointer === null) {
    const nextHover = hitId(event.target)
    if (nextHover !== hoverId) {
      hoverId = nextHover
      paintMap(litRoutes())
    }
    return
  }
  const dx = event.clientX - pointer.x
  const dy = event.clientY - pointer.y
  if (!pointer.dragging && dx * dx + dy * dy > 16) pointer.dragging = true
  if (!pointer.dragging) return
  if (pointer.orbiting) {
    setProjection(orbitProjection(projection, dx, dy))
  } else {
    camera = panCamera(camera, dx, dy)
    applyCamera()
  }
  pointer.x = event.clientX
  pointer.y = event.clientY
})
mapSvg.addEventListener('pointerup', event => {
  if (pointer !== null && !pointer.dragging && !pointer.orbiting && event.button !== 2) {
    if (pointer.targetId) select(pointer.targetId)
  }
  pointer = null
  hoverId = undefined
  paintMap(litRoutes())
})
mapSvg.addEventListener('pointerleave', () => {
  if (pointer !== null) return
  if (hoverId !== undefined) {
    hoverId = undefined
    paintMap(litRoutes())
  }
})

button2d.addEventListener('click', () => setProjection({ rotation: 0, elevation: Math.PI / 2 }, true))
button3d.addEventListener('click', () => setProjection(defaultProjection, true))
document.getElementById('fit')!.addEventListener('click', () => {
  camera = fitCamera(scene, host.clientWidth, host.clientHeight)
  applyCamera()
})
document.getElementById('zoom-in')!.addEventListener('click', () => zoomBy(1.25))
document.getElementById('zoom-out')!.addEventListener('click', () => zoomBy(1 / 1.25))

let darkTheme = false
themeButton.addEventListener('click', () => {
  darkTheme = !darkTheme
  themeButton.textContent = darkTheme ? 'Light' : 'Dark'
  if (darkTheme) {
    document.documentElement.dataset.theme = 'dark'
    setPalette(palettes.dark)
  } else {
    delete document.documentElement.dataset.theme
    setPalette(palettes.light)
  }
  paintSelection()
})

pauseButton.addEventListener('click', () => {
  playback = nextPlayback(playback, { type: 'toggle-pause' })
  paintFlow()
})
stepButton.addEventListener('click', () => {
  playback = nextPlayback(playback, { type: 'step', legCount: walkLegs().length })
  paintFlow()
})
for (const [button, rate] of rateButtons) {
  button.addEventListener('click', () => {
    playback = nextPlayback(playback, { type: 'rate', rate })
    paintFlow()
  })
}

function keyTarget(target: EventTarget | null): SemanticKeyTarget {
  if (!(target instanceof Element)) return 'other'
  if (target.closest('input, textarea, [contenteditable]')) return 'text'
  if (target.closest('#tree')) return 'hierarchy'
  if (target.closest('button, select')) return 'control'
  return 'other'
}

document.addEventListener('keydown', event => {
  if (event.metaKey || event.ctrlKey || event.altKey) return
  const targetKind = keyTarget(event.target)
  const action = semanticKeyAction(event.key, targetKind)
  if (action === undefined) return
  event.preventDefault()
  if (action === 'enter') {
    if (targetKind === 'hierarchy' && event.target instanceof Element) {
      const row = event.target.closest<HTMLButtonElement>('#tree button')
      const id = row?.dataset.id
      if (id !== undefined) select(id)
    }
    transition('enter')
  } else if (action === 'leave') {
    transition('leave')
  } else {
    activeAction = nextActiveAction(activeAction, { type: 'clear' })
    paintSelection()
  }
})

function applyWorld(next: ArchitectureWorld): void {
  world = next
  const synchronized = synchronizeSemanticScope(world, {
    level,
    focusId,
    selectedId,
  })
  level = synchronized.scope.level
  focusId = synchronized.scope.focusId
  selectedId = synchronized.scope.selectedId
  semantic = synchronized.view
  rebuildScene(false)
}

new ResizeObserver(resize).observe(host)
paintSelection()

const events = new EventSource('/events')
events.addEventListener('world', event => {
  const payload = JSON.parse(event.data) as {
    generation: number
    world: ArchitectureWorld
  }
  if (payload.generation <= applied) return
  applied = payload.generation
  applyWorld(payload.world)
})
