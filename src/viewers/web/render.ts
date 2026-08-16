import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  EdgesGeometry,
  Group,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  Raycaster,
  RepeatWrapping,
  SRGBColorSpace,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import type { Material } from 'three'
import type {
  ArchitectureWorld,
  Bounds,
  C4Kind,
  WorldElement,
  WorldGroup,
  WorldRelationship,
} from '../../types.ts'
import { showsRelationshipText } from '../relationship-text.ts'
import { buildScene, defaultProjection } from './scene.ts'
import type { Projection, SceneItem } from './scene.ts'

const paper = 0xEDE8D6
const raised = 0xF6F2E4
const ink = 0x26251D
const accent = 0x1D9E75
const labelSizes = { person: 4.5, system: 5.5, container: 5, component: 4.5 } as const
const planProjection: Projection = { rotation: 0, elevation: Math.PI / 2 }

const world: ArchitectureWorld = JSON.parse(document.getElementById('world')!.textContent!)
const items = buildScene(world)

function at(x: number, y: number, z: number): Vector3 {
  return new Vector3(x, z, y)
}

function hatchTexture(paint: (ctx: CanvasRenderingContext2D, size: number) => void): CanvasTexture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#F6F2E4'
  ctx.fillRect(0, 0, size, size)
  paint(ctx, size)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.magFilter = NearestFilter
  return texture
}

const hatches: Record<C4Kind, CanvasTexture> = {
  system: hatchTexture((ctx, size) => {
    ctx.strokeStyle = '#26251D'
    ctx.lineWidth = 3
    ctx.beginPath()
    for (let offset = -size; offset <= size * 2; offset += 16) {
      ctx.moveTo(offset, size)
      ctx.lineTo(offset + size, 0)
    }
    ctx.stroke()
  }),
  container: hatchTexture((ctx, size) => {
    ctx.strokeStyle = '#26251D'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    for (let offset = -size; offset <= size * 2; offset += 20) {
      ctx.moveTo(offset, size)
      ctx.lineTo(offset + size, 0)
    }
    ctx.stroke()
  }),
  component: hatchTexture((ctx, size) => {
    ctx.strokeStyle = '#26251D'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let y = 12; y < size; y += 16) {
      ctx.moveTo(0, y)
      ctx.lineTo(size, y)
    }
    ctx.stroke()
  }),
  person: hatchTexture((ctx, size) => {
    ctx.fillStyle = '#26251D'
    for (let y = 10; y < size; y += 16) {
      for (let x = 10; x < size; x += 16) {
        ctx.beginPath()
        ctx.arc(x, y, 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }),
}

function sideMaterial(kind: C4Kind, faceWidth: number, faceHeight: number, shaded: boolean): MeshBasicMaterial {
  const map = hatches[kind].clone()
  map.repeat.set(Math.max(faceWidth / 4, 0.5), Math.max(faceHeight / 4, 0.5))
  return new MeshBasicMaterial({
    map,
    color: shaded ? 0xE4DFCC : 0xFFFFFF,
  })
}

function labelTexture(
  bounds: Bounds,
  paint: (ctx: CanvasRenderingContext2D, scale: number) => void,
): CanvasTexture {
  const scale = 16
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(2, Math.round(bounds.width * scale))
  canvas.height = Math.max(2, Math.round(bounds.height * scale))
  paint(canvas.getContext('2d')!, scale)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function labelPlane(
  bounds: Bounds,
  z: number,
  paint: (ctx: CanvasRenderingContext2D, scale: number) => void,
): Mesh {
  const texture = labelTexture(bounds, paint)
  const mesh = new Mesh(
    new PlaneGeometry(bounds.width, bounds.height),
    new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.position.copy(at(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, z + 0.2))
  mesh.raycast = () => {}
  return mesh
}

function drawName(
  ctx: CanvasRenderingContext2D,
  scale: number,
  bounds: Bounds,
  text: string,
  fontSize: number,
  align: 'center' | 'start',
  alpha = 1,
): void {
  ctx.font = `${fontSize * scale}px ui-monospace, SFMono-Regular, Menlo, monospace`
  ctx.fillStyle = '#26251D'
  ctx.globalAlpha = alpha
  if (align === 'center') {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, bounds.width * scale / 2, bounds.height * scale / 2, bounds.width * scale - 8)
    return
  }
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.letterSpacing = `${0.08 * fontSize * scale}px`
  ctx.fillText(text, 6, 6)
}

interface Pickable {
  material: LineBasicMaterial | LineDashedMaterial
  ink: Color
}

const pickables: { mesh: Mesh; pick: Pickable; element: WorldElement }[] = []
const pickMeshes: Mesh[] = []
const routeLabels: { source: string; target: string; mesh: Mesh }[] = []
const accentColor = new Color(accent)
const raycaster = new Raycaster()
const pointerNdc = new Vector2()

function addBlock(parent: Group, element: WorldElement, bottom: number, top: number, label: Mesh): void {
  const { x, y, width, height } = element.bounds
  const thickness = Math.max(top - bottom, 0.4)
  const geometry = new BoxGeometry(width, thickness, height)
  const materials = [
    sideMaterial(element.kind, height, thickness, true),
    sideMaterial(element.kind, height, thickness, true),
    new MeshBasicMaterial({ color: raised }),
    new MeshBasicMaterial({ color: raised }),
    sideMaterial(element.kind, width, thickness, false),
    sideMaterial(element.kind, width, thickness, false),
  ]
  const mesh = new Mesh(geometry, materials)
  mesh.position.copy(at(x + width / 2, y + height / 2, bottom + thickness / 2))

  const ghost = element.origin !== 'observed'
  const outlineMaterial = ghost
    ? new LineDashedMaterial({ color: ink, dashSize: 2, gapSize: 1.5 })
    : new LineBasicMaterial({ color: ink })
  const outline = new LineSegments(new EdgesGeometry(geometry), outlineMaterial)
  outline.position.copy(mesh.position)
  if (ghost) outline.computeLineDistances()

  const block = new Group()
  block.add(mesh, outline, label)
  if (element.kind === 'person') {
    const head = new Mesh(new SphereGeometry(3.5, 16, 12), new MeshBasicMaterial({ color: ink }))
    head.position.copy(at(x + width / 2, y + height / 2 - 7, top + 3.5))
    block.add(head)
  }
  parent.add(block)

  pickables.push({ mesh, pick: { material: outlineMaterial, ink: new Color(ink) }, element })
  pickMeshes.push(mesh)
}

function addSlab(parent: Group, element: WorldElement, bottom: number, top: number): void {
  addBlock(parent, element, bottom, top, labelPlane(element.bounds, top, (ctx, scale) => {
    drawName(ctx, scale, element.bounds, element.name.toUpperCase(), 5, 'start', 0.65)
  }))
}

function addPrism(parent: Group, element: WorldElement, bottom: number, top: number): void {
  addBlock(parent, element, bottom, top, labelPlane(element.bounds, top, (ctx, scale) => {
    drawName(ctx, scale, element.bounds, element.name, labelSizes[element.kind], 'center')
  }))
}

function addZone(parent: Group, group: WorldGroup, z: number): void {
  const { bounds } = group
  const fill = new Mesh(
    new PlaneGeometry(bounds.width, bounds.height),
    new MeshBasicMaterial({ color: ink, opacity: 0.03, transparent: true, depthWrite: false }),
  )
  fill.rotation.x = -Math.PI / 2
  fill.position.copy(at(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, z + 0.05))
  fill.raycast = () => {}

  const corners = [
    at(bounds.x, bounds.y, z + 0.06),
    at(bounds.x + bounds.width, bounds.y, z + 0.06),
    at(bounds.x + bounds.width, bounds.y + bounds.height, z + 0.06),
    at(bounds.x, bounds.y + bounds.height, z + 0.06),
    at(bounds.x, bounds.y, z + 0.06),
  ]
  const edge = new Line(
    new BufferGeometry().setFromPoints(corners),
    new LineDashedMaterial({ color: ink, dashSize: 3, gapSize: 2 }),
  )
  edge.computeLineDistances()
  parent.add(fill, edge, labelPlane(bounds, z + 0.08, (ctx, scale) => {
    drawName(ctx, scale, bounds, group.name.toUpperCase(), 4.5, 'start', 0.65)
  }))
}

function addBar(
  parent: Group,
  from: Vector3,
  to: Vector3,
  width: number,
  material: Material,
): void {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const length = Math.hypot(dx, dz)
  if (length < 0.01) return
  const bar = new Mesh(new BoxGeometry(length, 0.12, width), material)
  bar.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2)
  bar.rotation.y = Math.atan2(dx, dz) - Math.PI / 2
  bar.raycast = () => {}
  parent.add(bar)
}

function addRoute(parent: Group, relationship: WorldRelationship, z: number): void {
  const points = relationship.route.map(point => at(point.x, point.y, z + 0.25))
  const ghost = relationship.origin !== 'observed'
  if (ghost) {
    const line = new Line(
      new BufferGeometry().setFromPoints(points),
      new LineDashedMaterial({ color: ink, dashSize: 2, gapSize: 1.5 }),
    )
    line.computeLineDistances()
    parent.add(line)
  } else {
    const material = new MeshBasicMaterial({ color: ink })
    for (let index = 0; index < points.length - 1; index += 1) {
      addBar(parent, points[index]!, points[index + 1]!, 0.55, material)
    }
  }
  if (points.length >= 2) {
    const last = points[points.length - 1]!
    const prev = points[points.length - 2]!
    const direction = last.clone().sub(prev)
    if (direction.lengthSq() > 0) {
      const arrow = new Mesh(new ConeGeometry(1.1, 3, 8), new MeshBasicMaterial({ color: ink }))
      arrow.position.copy(last)
      arrow.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize())
      arrow.raycast = () => {}
      parent.add(arrow)
    }
  }
  if (relationship.label !== null) {
    const mesh = flowLabel(relationship.description, relationship.label, z + 0.3)
    mesh.visible = false
    parent.add(mesh)
    routeLabels.push({
      source: relationship.source,
      target: relationship.target,
      mesh,
    })
  }
}

/** ELK reserves a 1-unit-tall box; the plane is sized to the words. */
function flowLabel(description: string, bounds: Bounds, z: number): Mesh {
  const scale = 16
  const fontPx = 4 * scale
  const font = `${fontPx}px ui-monospace, SFMono-Regular, Menlo, monospace`
  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = font
  const width = Math.max(2, Math.ceil(measure.measureText(description).width + 12))
  const height = Math.max(2, Math.ceil(fontPx * 1.8))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 6
  ctx.strokeStyle = '#EDE8D6'
  ctx.strokeText(description, width / 2, height / 2)
  ctx.fillStyle = '#26251D'
  ctx.fillText(description, width / 2, height / 2)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  const mesh = new Mesh(
    new PlaneGeometry(width / scale, height / scale),
    new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.position.copy(at(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
    z,
  ))
  mesh.raycast = () => {}
  return mesh
}

function addItem(parent: Group, item: SceneItem): void {
  switch (item.kind) {
    case 'slab':
      addSlab(parent, item.element, item.bottom, item.top)
      return
    case 'prism':
      addPrism(parent, item.element, item.bottom, item.top)
      return
    case 'zone':
      addZone(parent, item.group, item.z)
      return
    case 'route':
      addRoute(parent, item.relationship, item.z)
  }
}

const host = document.getElementById('map')!
const scene = new Scene()
scene.background = new Color(paper)
const city = new Group()
for (const item of items) addItem(city, item)
scene.add(city)

const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 8000)
const renderer = new WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
host.appendChild(renderer.domElement)

const button2d = document.getElementById('mode-2d')!
const button3d = document.getElementById('mode-3d')!
let current: Projection = defaultProjection
const target = new Vector3()

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

const details = document.getElementById('details')!
const detailsTitle = details.querySelector('h1')!
const detailsMeta = details.querySelector('.meta')!
const detailsDescription = details.querySelector('.description') as HTMLElement
const detailsRels = details.querySelector('.rels')!
const byId = new Map(world.elements.map((element: WorldElement) => [element.representationId, element]))

let selectedId: string | null = null
let hoverId: string | null = null

function fillDetails(element: WorldElement | null): void {
  if (element === null) {
    details.hidden = true
    return
  }
  details.hidden = false
  detailsTitle.textContent = element.name
  detailsMeta.textContent = `${element.external ? `external ${element.kind}` : element.kind} · ${element.origin}`
  detailsDescription.textContent = element.description
  detailsDescription.hidden = element.description === ''
  detailsRels.replaceChildren()
  for (const relationship of world.relationships) {
    if (!showsRelationshipText(relationship, element.representationId)) continue
    const outgoing = relationship.source === element.representationId
    const other = byId.get(outgoing ? relationship.target : relationship.source)
    const item = document.createElement('li')
    item.textContent = `${outgoing ? '→' : '←'} ${other?.name ?? ''} · ${relationship.description}`
    detailsRels.append(item)
  }
}

function paintSelection(): void {
  for (const item of pickables) {
    const id = item.element.representationId
    const on = id === selectedId || id === hoverId
    item.pick.material.color.copy(on ? accentColor : item.pick.ink)
  }
  for (const label of routeLabels) {
    label.mesh.visible = showsRelationshipText(label, selectedId)
  }
  const selected = pickables.find(item => item.element.representationId === selectedId)
  fillDetails(selected?.element ?? null)
  renderer.render(scene, camera)
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
  hoverId = hitElement(event.clientX, event.clientY)?.representationId ?? null
  paintSelection()
})
canvas.addEventListener('pointerup', event => {
  if (!dragging) {
    selectedId = hitElement(event.clientX, event.clientY)?.representationId ?? null
    paintSelection()
  }
  last = null
  dragging = false
})
canvas.addEventListener('pointerleave', () => {
  hoverId = null
  paintSelection()
})
window.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return
  selectedId = null
  paintSelection()
})

button2d.addEventListener('click', () => setMode(true))
button3d.addEventListener('click', () => setMode(false))
window.addEventListener('resize', resize)

renderer.setSize(host.clientWidth, host.clientHeight, false)
fitCamera()
paintSelection()
