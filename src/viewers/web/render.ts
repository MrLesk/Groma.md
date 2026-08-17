import {
  Box3,
  Color,
  Group,
  Line,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import type { Material, Object3D } from 'three'
import type { ArchitectureWorld, WorldElement } from '../../types.ts'
import {
  actionCaption,
  actionLegs,
  actionPath,
  elementOnPath,
  worldCommands,
} from '../action-path.ts'
import {
  parentOfElements,
  showsRelationshipText,
} from '../relationship-text.ts'
import { defaultSelection } from '../tui/navigation.ts'
import { initialTree, toggleExpansion, treeRows } from '../tui/tree.ts'
import type { TreeRow } from '../tui/tree.ts'
import { accent, palettes, paper, setPalette } from './atoms/theme.ts'
import { initialPlayback, nextPlayback } from './flow-playback.ts'
import { addBar } from './molecules/route.ts'
import { buildCity } from './organisms/city.ts'
import { paintDetails, inspectDetails, nextActiveActionId } from './organisms/details.ts'
import type { DetailsTab } from './organisms/details.ts'
import { paintFlows } from './organisms/flows.ts'
import { paintHierarchy } from './organisms/hierarchy.ts'
import { defaultProjection } from './scene.ts'
import type { Projection } from './scene.ts'

const planProjection: Projection = { rotation: 0, elevation: Math.PI / 2 }

let tree = initialTree()

const boot = JSON.parse(document.getElementById('world')!.textContent!) as {
  generation: number
  world: ArchitectureWorld
}
let world = boot.world
let applied = boot.generation
let { city, pickables, routes } = buildCity(world)
let pickMeshes = pickables.map(item => item.mesh)

const scene = new Scene()
scene.background = new Color(paper)
scene.add(city)

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
const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 8000)
const renderer = new WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
host.appendChild(renderer.domElement)

const button2d = document.getElementById('mode-2d')!
const button3d = document.getElementById('mode-3d')!
let current: Projection = defaultProjection
const target = new Vector3()
const accentColor = new Color(accent)
const raycaster = new Raycaster()
const pointerNdc = new Vector2()
let parentOf = parentOfElements(world.elements)

let selectedId = defaultSelection(world, 'context')?.representationId
let hoverId: string | undefined
let activeActionId: string | undefined
let detailsTab: DetailsTab = 'what'

function placeCamera(projection: Projection): void {
  const span = new Box3().setFromObject(city).getSize(new Vector3())
  const distance = Math.max(span.x, span.y, span.z, 1) * 2
  const horiz = distance * Math.cos(projection.elevation)
  camera.position.set(
    target.x + Math.sin(projection.rotation) * horiz,
    target.y + distance * Math.sin(projection.elevation),
    target.z + Math.cos(projection.rotation) * horiz,
  )
  if (Math.cos(projection.elevation) < 0.01) camera.up.set(0, 0, -1)
  else camera.up.set(0, 1, 0)
  camera.lookAt(target)
}

function fitCamera(): void {
  const box = new Box3().setFromObject(city)
  if (box.isEmpty()) return
  box.getCenter(target)
  placeCamera(current)
  camera.updateMatrixWorld()
  const inverse = camera.matrixWorldInverse
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  const corner = new Vector3()
  const { min, max } = box
  for (const x of [min.x, max.x]) {
    for (const y of [min.y, max.y]) {
      for (const z of [min.z, max.z]) {
        corner.set(x, y, z).applyMatrix4(inverse)
        minX = Math.min(minX, corner.x)
        maxX = Math.max(maxX, corner.x)
        minY = Math.min(minY, corner.y)
        maxY = Math.max(maxY, corner.y)
      }
    }
  }
  const margin = 16
  let halfW = (maxX - minX) / 2 + margin
  let halfH = (maxY - minY) / 2 + margin
  const aspect = host.clientWidth / Math.max(host.clientHeight, 1)
  if (halfW / halfH > aspect) halfH = halfW / aspect
  else halfW = halfH * aspect
  camera.left = -halfW
  camera.right = halfW
  camera.top = halfH
  camera.bottom = -halfH
  setZoom(1)
}

/** Zoom 1 is fit, shown as nothing because the Fit control sits beside the readout. */
function setZoom(zoom: number): void {
  camera.zoom = Math.min(40, Math.max(0.2, zoom))
  camera.updateProjectionMatrix()
  zoomHost.textContent = Math.abs(camera.zoom - 1) < 1e-6
    ? ''
    : `${Math.round(camera.zoom * 100)}%`
}

function resize(): void {
  const width = host.clientWidth
  const height = host.clientHeight
  renderer.setSize(width, height, false)
  const aspect = width / Math.max(height, 1)
  const halfH = (camera.top - camera.bottom) / 2
  camera.top = halfH
  camera.bottom = -halfH
  camera.left = -halfH * aspect
  camera.right = halfH * aspect
  camera.updateProjectionMatrix()
  renderer.render(scene, camera)
}

function setMode(plan: boolean): void {
  current = plan ? planProjection : defaultProjection
  button2d.classList.toggle('active', plan)
  button3d.classList.toggle('active', !plan)
  fitCamera()
  renderer.render(scene, camera)
}

function viewAxes(): { right: Vector3; up: Vector3 } {
  return {
    right: new Vector3().setFromMatrixColumn(camera.matrixWorld, 0),
    up: new Vector3().setFromMatrixColumn(camera.matrixWorld, 1),
  }
}

function worldPerPixel(): number {
  return (camera.top - camera.bottom) / camera.zoom / Math.max(host.clientHeight, 1)
}

function disposeObject(object: Object3D): void {
  object.traverse(child => {
    if (!(child instanceof Mesh || child instanceof LineSegments)) return
    child.geometry.dispose()
    const materials: Material[] = Array.isArray(child.material)
      ? child.material
      : [child.material]
    for (const material of materials) material.dispose()
  })
}

function rebuildCity(): void {
  scene.remove(city)
  disposeObject(city)
  ;({ city, pickables, routes } = buildCity(world))
  pickMeshes = pickables.map(item => item.mesh)
  scene.add(city)
  clearFlow()
  paintSelection()
}

function applyWorld(next: ArchitectureWorld): void {
  world = next
  parentOf = parentOfElements(world.elements)
  if (!world.elements.some(element => element.representationId === selectedId)) {
    selectedId = defaultSelection(world, 'context')?.representationId
  }
  rebuildCity()
}

function selectedElement(): WorldElement | undefined {
  return world.elements.find(element => element.representationId === selectedId)
}

function select(id: string): void {
  selectedId = id
  activeActionId = nextActiveActionId(activeActionId, { type: 'select' })
  paintSelection()
}

function toggleRow(row: TreeRow): void {
  tree = toggleExpansion(tree, row)
  paintHierarchy(treeHost, treeRows(world, selectedId, tree), selectedId, select, toggleRow)
}

function setDimmed(object: Object3D, dimmed: boolean): void {
  object.traverse(child => {
    if (!(child instanceof Mesh || child instanceof Line || child instanceof LineSegments)) return
    const materials: Material[] = Array.isArray(child.material)
      ? child.material
      : [child.material]
    for (const material of materials) {
      material.opacity = dimmed ? 0.2 : 1
      if (material.depthWrite === false) material.transparent = true
      else material.transparent = dimmed
    }
  })
}

// The traced journey: a green rule over each lit route with surveyed
// points travelling source to target while a person command is active.
const flowSpeed = 26
const flowSpacing = 30
const flowDotGeometry = new SphereGeometry(1.6, 14, 10)
const flowMaterial = new MeshBasicMaterial({ color: accent })

interface FlowLane {
  points: Vector3[]
  /** Cumulative length at each point; the last entry is the lane total. */
  cums: number[]
  total: number
}

let flow: {
  group: Group
  dots: { mesh: Mesh; lane: FlowLane; offset: number; routeId: string }[]
} | null = null
let flowKey = ''
let flowFrame = 0
let flowTravelled = 0
let flowLast = 0
let playback = initialPlayback

function clearFlow(): void {
  flowKey = ''
  playback = initialPlayback
  if (flow === null) return
  cancelAnimationFrame(flowFrame)
  scene.remove(flow.group)
  flow.group.traverse(child => {
    if (child instanceof Mesh && child.geometry !== flowDotGeometry) child.geometry.dispose()
  })
  flow = null
}

function placeFlowDots(travelled: number): void {
  if (flow === null) return
  for (const dot of flow.dots) {
    const distance = (dot.offset + travelled) % dot.lane.total
    const index = dot.lane.cums.findIndex(cum => cum > distance)
    const from = dot.lane.points[index - 1]!
    const to = dot.lane.points[index]!
    const span = dot.lane.cums[index]! - dot.lane.cums[index - 1]!
    const t = span > 0 ? (distance - dot.lane.cums[index - 1]!) / span : 0
    dot.mesh.position.copy(from).lerp(to, t)
  }
}

function stepFlow(now: number): void {
  if (flow === null) return
  // Frame-to-frame deltas, so pause and rate apply without a clock rebase.
  if (flowLast === 0) flowLast = now
  if (!playback.paused) {
    flowTravelled += ((now - flowLast) / 1000) * flowSpeed * playback.rate
  }
  flowLast = now
  placeFlowDots(flowTravelled)
  renderer.render(scene, camera)
  flowFrame = requestAnimationFrame(stepFlow)
}

function syncFlow(pathIds: Set<string>): void {
  const key = pathIds.size === 0 ? '' : activeActionId ?? ''
  if (key === flowKey) return
  clearFlow()
  flowKey = key
  if (key === '') return
  const group = new Group()
  const dots: { mesh: Mesh; lane: FlowLane; offset: number; routeId: string }[] = []
  for (const route of routes) {
    if (!pathIds.has(route.id) || route.points.length < 2) continue
    const points = route.points.map(point => point.clone().setY(point.y + 0.3))
    for (let index = 0; index < points.length - 1; index += 1) {
      addBar(group, points[index]!, points[index + 1]!, 0.9, flowMaterial)
    }
    const cums = [0]
    for (let index = 1; index < points.length; index += 1) {
      cums.push(cums[index - 1]! + points[index]!.distanceTo(points[index - 1]!))
    }
    const lane: FlowLane = { points, cums, total: cums[cums.length - 1]! }
    if (lane.total < 1) continue
    const count = Math.max(1, Math.floor(lane.total / flowSpacing))
    for (let index = 0; index < count; index += 1) {
      const mesh = new Mesh(flowDotGeometry, flowMaterial)
      mesh.raycast = () => {}
      group.add(mesh)
      dots.push({ mesh, lane, offset: (index / count) * lane.total, routeId: route.id })
    }
  }
  scene.add(group)
  flow = { group, dots }
  flowTravelled = 0
  flowLast = 0
  placeFlowDots(0)
  flowFrame = requestAnimationFrame(stepFlow)
}

/** Header controls, footer caption, and payload visibility for the playback. */
function paintFlow(legs = actionLegs(activeActionId, world)): void {
  const active = world.relationships.find(item => item.id === activeActionId)
  flowHost.hidden = active === undefined
  if (active === undefined) {
    actionHost.textContent = 'drag pan · right-drag orbit · scroll zoom'
    actionHost.classList.add('hint')
    return
  }
  const names = new Map(world.elements.map(item => [item.representationId, item.name]))
  const nameOf = (id: string): string => names.get(id) ?? id
  const title = actionCaption(active, true, id => names.get(id)).title
  flowNameHost.textContent = title
  pauseButton.textContent = playback.paused ? 'Play' : 'Pause'
  for (const [button, rate] of rateButtons) {
    button.classList.toggle('active', playback.rate === rate)
  }
  const leg = playback.step === null ? undefined : legs[playback.step]
  actionHost.textContent = leg === undefined
    ? `${title}   x clear`
    : `step ${playback.step! + 1}/${legs.length} · ${nameOf(leg.source)}`
      + ` → ${nameOf(leg.target)} · ${leg.description}   x clear`
  actionHost.classList.remove('hint')
  if (flow !== null) {
    // While a leg is traced, only its payload dots ride; otherwise all do.
    for (const dot of flow.dots) {
      dot.mesh.visible = leg === undefined || dot.routeId === leg.id
    }
    renderer.render(scene, camera)
  }
}

function playbackEvent(event: { type: 'toggle-pause' } | { type: 'rate'; rate: number } | { type: 'step' }): void {
  const legs = actionLegs(activeActionId, world)
  playback = nextPlayback(
    playback,
    event.type === 'step' ? { type: 'step', legCount: legs.length } : event,
  )
  paintFlow(legs)
}

function paintOutlines(pathIds = actionPath(activeActionId, world)): void {
  const tracing = pathIds.size > 0
  const touched = new Set<string>()
  if (tracing) {
    for (const relationship of world.relationships) {
      if (!pathIds.has(relationship.id)) continue
      touched.add(relationship.source)
      touched.add(relationship.target)
    }
  }
  for (const item of pickables) {
    const id = item.element.representationId
    const on = id === selectedId || id === hoverId || touched.has(id)
    item.material.color.copy(on ? accentColor : item.ink)
    const onPath = !tracing
      || id === selectedId
      || elementOnPath(id, pathIds, world)
    setDimmed(item.mesh.parent ?? item.mesh, !onPath)
  }
  renderer.render(scene, camera)
}

function paintSelection(): void {
  const pathIds = actionPath(activeActionId, world)
  for (const route of routes) {
    if (route.mesh) {
      route.mesh.visible = pathIds.has(route.id)
        || showsRelationshipText(route, selectedId ?? null, parentOf)
    }
    setDimmed(route.group, pathIds.size > 0 && !pathIds.has(route.id))
  }
  paintHierarchy(treeHost, treeRows(world, selectedId, tree), selectedId, select, toggleRow)
  const commands = worldCommands(world)
  paintFlows(flowsHost, commands, activeActionId, pickAction)
  paintStats(commands.length)
  const selected = selectedElement()
  if (selected) {
    paintDetails(
      detailsHost,
      inspectDetails(selected, world),
      select,
      pickAction,
      activeActionId,
      detailsTab,
      tab => {
        detailsTab = tab
        paintSelection()
      },
    )
  }
  syncFlow(pathIds)
  paintFlow()
  paintOutlines(pathIds)
}

function pickAction(id: string): void {
  activeActionId = nextActiveActionId(activeActionId, { type: 'pick', id })
  paintSelection()
}

function paintStats(flowCount: number): void {
  const system = world.elements.find(element =>
    element.kind === 'system' && element.origin === 'observed' && !element.external)
  statsHost.textContent = system === undefined
    ? ''
    : `${system.name} · ${flowCount} flows · ${world.elements.length} elements`
}

const canvas = renderer.domElement

function hitElement(clientX: number, clientY: number): WorldElement | undefined {
  const rect = canvas.getBoundingClientRect()
  pointerNdc.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  )
  raycaster.setFromCamera(pointerNdc, camera)
  const hit = raycaster.intersectObjects(pickMeshes, false)[0]
  return pickables.find(item => item.mesh === hit?.object)?.element
}

canvas.addEventListener('wheel', event => {
  event.preventDefault()
  const rect = canvas.getBoundingClientRect()
  const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1
  const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1
  const { right, up } = viewAxes()
  const before = camera.position.clone()
    .addScaledVector(right, ndcX * (camera.right - camera.left) / 2 / camera.zoom)
    .addScaledVector(up, ndcY * (camera.top - camera.bottom) / 2 / camera.zoom)
  setZoom(camera.zoom / Math.exp(event.deltaY * 0.002))
  const after = camera.position.clone()
    .addScaledVector(right, ndcX * (camera.right - camera.left) / 2 / camera.zoom)
    .addScaledVector(up, ndcY * (camera.top - camera.bottom) / 2 / camera.zoom)
  const delta = before.sub(after)
  camera.position.add(delta)
  target.add(delta)
  renderer.render(scene, camera)
}, { passive: false })

let last: Vector2 | null = null
let dragging = false
let orbiting = false
const dragSlop = 4
// Just above ground and just under top-down: never under the city, never
// across the top-down up-vector flip.
const minElevation = 0.08
const maxElevation = Math.PI / 2 - 0.02

function orbitBy(dx: number, dy: number): void {
  current = {
    rotation: current.rotation - dx * 0.005,
    elevation: Math.min(maxElevation, Math.max(minElevation, current.elevation - dy * 0.005)),
  }
  button2d.classList.remove('active')
  button3d.classList.remove('active')
  placeCamera(current)
  renderer.render(scene, camera)
}

canvas.addEventListener('contextmenu', event => event.preventDefault())
canvas.addEventListener('pointerdown', event => {
  last = new Vector2(event.clientX, event.clientY)
  dragging = false
  orbiting = event.button === 2 || event.ctrlKey || event.altKey
  canvas.style.cursor = ''
  canvas.setPointerCapture(event.pointerId)
})
canvas.addEventListener('pointermove', event => {
  if (last !== null) {
    const dx = event.clientX - last.x
    const dy = event.clientY - last.y
    if (!dragging && (dx * dx + dy * dy) > dragSlop * dragSlop) dragging = true
    if (dragging) {
      if (orbiting) {
        orbitBy(dx, dy)
      } else {
        const { right, up } = viewAxes()
        const scale = worldPerPixel()
        camera.position.addScaledVector(right, -dx * scale)
        camera.position.addScaledVector(up, dy * scale)
        target.addScaledVector(right, -dx * scale)
        target.addScaledVector(up, dy * scale)
        renderer.render(scene, camera)
      }
      last.set(event.clientX, event.clientY)
    }
    return
  }
  hoverId = hitElement(event.clientX, event.clientY)?.representationId
  canvas.style.cursor = hoverId === undefined ? '' : 'pointer'
  paintOutlines()
})
canvas.addEventListener('pointerup', event => {
  if (!dragging && event.button !== 2) {
    const hit = hitElement(event.clientX, event.clientY)
    if (hit) selectedId = hit.representationId
    paintSelection()
  }
  last = null
  dragging = false
  orbiting = false
})
canvas.addEventListener('pointerleave', () => {
  hoverId = undefined
  canvas.style.cursor = ''
  paintOutlines()
})

button2d.addEventListener('click', () => setMode(true))
button3d.addEventListener('click', () => setMode(false))
document.getElementById('fit')!.addEventListener('click', () => {
  fitCamera()
  renderer.render(scene, camera)
})

function zoomBy(factor: number): void {
  setZoom(camera.zoom * factor)
  renderer.render(scene, camera)
}
document.getElementById('zoom-in')!.addEventListener('click', () => zoomBy(1.25))
document.getElementById('zoom-out')!.addEventListener('click', () => zoomBy(1 / 1.25))

let darkTheme = false
themeButton.addEventListener('click', () => {
  darkTheme = !darkTheme
  themeButton.textContent = darkTheme ? 'Light' : 'Dark'
  if (darkTheme) document.documentElement.dataset.theme = 'dark'
  else delete document.documentElement.dataset.theme
  setPalette(darkTheme ? palettes.dark : palettes.light)
  scene.background = new Color(paper)
  rebuildCity()
})

pauseButton.addEventListener('click', () => playbackEvent({ type: 'toggle-pause' }))
stepButton.addEventListener('click', () => playbackEvent({ type: 'step' }))
for (const [button, rate] of rateButtons) {
  button.addEventListener('click', () => playbackEvent({ type: 'rate', rate }))
}

document.addEventListener('keydown', event => {
  if (event.key !== 'x' && event.key !== 'X') return
  if (event.metaKey || event.ctrlKey || event.altKey) return
  activeActionId = nextActiveActionId(activeActionId, { type: 'clear' })
  paintSelection()
})

renderer.setSize(host.clientWidth, host.clientHeight, false)
fitCamera()
paintSelection()
new ResizeObserver(resize).observe(host)

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
