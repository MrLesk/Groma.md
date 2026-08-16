import {
  Box3,
  Color,
  Line,
  LineSegments,
  Mesh,
  OrthographicCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import type { Material, Object3D } from 'three'
import type { ArchitectureWorld, WorldElement } from '../../types.ts'
import {
  actionCaption,
  actionPath,
  elementOnPath,
} from '../action-path.ts'
import {
  parentOfElements,
  showsRelationshipText,
} from '../relationship-text.ts'
import { defaultSelection } from '../tui/navigation.ts'
import { initialTree, treeRows } from '../tui/tree.ts'

const tree = initialTree()
import { accent, paper } from './atoms/theme.ts'
import { zoomReadout } from './organisms/chrome.ts'
import { buildCity } from './organisms/city.ts'
import { paintDetails, inspectDetails, nextActiveActionId } from './organisms/details.ts'
import { paintHierarchy } from './organisms/hierarchy.ts'
import { defaultProjection } from './scene.ts'
import type { Projection } from './scene.ts'

const planProjection: Projection = { rotation: 0, elevation: Math.PI / 2 }

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
const detailsHost = document.getElementById('details')!
const actionHost = document.getElementById('action')!
const zoomHost = document.getElementById('zoom')!
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
  camera.zoom = 1
  camera.updateProjectionMatrix()
  zoomHost.textContent = zoomReadout(camera.zoom)
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

function applyWorld(next: ArchitectureWorld): void {
  scene.remove(city)
  disposeObject(city)
  world = next
  parentOf = parentOfElements(world.elements)
  if (!world.elements.some(element => element.representationId === selectedId)) {
    selectedId = defaultSelection(world, 'context')?.representationId
  }
  ;({ city, pickables, routes } = buildCity(world))
  pickMeshes = pickables.map(item => item.mesh)
  scene.add(city)
  paintSelection()
}

function selectedElement(): WorldElement | undefined {
  return world.elements.find(element => element.representationId === selectedId)
}

function select(id: string): void {
  selectedId = id
  activeActionId = nextActiveActionId(activeActionId, { type: 'select' })
  paintSelection()
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

function paintOutlines(pathIds = actionPath(activeActionId, world)): void {
  const tracing = pathIds.size > 0
  for (const item of pickables) {
    const id = item.element.representationId
    const on = id === selectedId || id === hoverId
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
  paintHierarchy(treeHost, treeRows(world, selectedId, tree), selectedId, select)
  const selected = selectedElement()
  if (selected) {
    paintDetails(
      detailsHost,
      inspectDetails(selected, world),
      select,
      pickAction,
      activeActionId,
    )
  }
  const active = world.relationships.find(item => item.id === activeActionId)
  const names = new Map(world.elements.map(item => [item.representationId, item.name]))
  actionHost.textContent = active === undefined
    ? ''
    : `${actionCaption(active, true, id => names.get(id)).title}   x clear`
  paintOutlines(pathIds)
}

function pickAction(id: string): void {
  activeActionId = nextActiveActionId(activeActionId, { type: 'pick', id })
  paintSelection()
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
  camera.zoom = Math.min(40, Math.max(0.2, camera.zoom / Math.exp(event.deltaY * 0.002)))
  camera.updateProjectionMatrix()
  const after = camera.position.clone()
    .addScaledVector(right, ndcX * (camera.right - camera.left) / 2 / camera.zoom)
    .addScaledVector(up, ndcY * (camera.top - camera.bottom) / 2 / camera.zoom)
  const delta = before.sub(after)
  camera.position.add(delta)
  target.add(delta)
  zoomHost.textContent = zoomReadout(camera.zoom)
  renderer.render(scene, camera)
}, { passive: false })

let last: Vector2 | null = null
let dragging = false
const dragSlop = 4

canvas.addEventListener('pointerdown', event => {
  last = new Vector2(event.clientX, event.clientY)
  dragging = false
  canvas.setPointerCapture(event.pointerId)
})
canvas.addEventListener('pointermove', event => {
  if (last !== null) {
    const dx = event.clientX - last.x
    const dy = event.clientY - last.y
    if (!dragging && (dx * dx + dy * dy) > dragSlop * dragSlop) dragging = true
    if (dragging) {
      const { right, up } = viewAxes()
      const scale = worldPerPixel()
      camera.position.addScaledVector(right, -dx * scale)
      camera.position.addScaledVector(up, dy * scale)
      target.addScaledVector(right, -dx * scale)
      target.addScaledVector(up, dy * scale)
      last.set(event.clientX, event.clientY)
      renderer.render(scene, camera)
    }
    return
  }
  hoverId = hitElement(event.clientX, event.clientY)?.representationId
  paintOutlines()
})
canvas.addEventListener('pointerup', event => {
  if (!dragging) {
    const hit = hitElement(event.clientX, event.clientY)
    if (hit) selectedId = hit.representationId
    paintSelection()
  }
  last = null
  dragging = false
})
canvas.addEventListener('pointerleave', () => {
  hoverId = undefined
  paintOutlines()
})

button2d.addEventListener('click', () => setMode(true))
button3d.addEventListener('click', () => setMode(false))

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
