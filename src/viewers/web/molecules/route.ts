import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  ConeGeometry,
  Group,
  Line,
  LineDashedMaterial,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three'
import type { Material } from 'three'
import type { Bounds, WorldRelationship } from '../../../types.ts'
import { at } from '../atoms/space.ts'
import { ink, paper } from '../atoms/theme.ts'

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
  ctx.strokeStyle = `#${paper.toString(16).padStart(6, '0')}`
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

export interface CityRoute {
  id: string
  source: string
  target: string
  group: Group
  mesh: Mesh | null
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

export function addRoute(
  parent: Group,
  relationship: WorldRelationship,
  z: number,
): CityRoute {
  const group = new Group()
  parent.add(group)
  const points = relationship.route.map(point => at(point.x, point.y, z + 0.25))
  const ghost = relationship.origin !== 'observed'
  if (ghost) {
    const line = new Line(
      new BufferGeometry().setFromPoints(points),
      new LineDashedMaterial({ color: ink, dashSize: 2, gapSize: 1.5 }),
    )
    line.computeLineDistances()
    group.add(line)
  } else {
    const material = new MeshBasicMaterial({ color: ink })
    for (let index = 0; index < points.length - 1; index += 1) {
      addBar(group, points[index]!, points[index + 1]!, 0.55, material)
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
      group.add(arrow)
    }
  }
  const mesh = relationship.label === null
    ? null
    : flowLabel(relationship.description, relationship.label, z + 0.3)
  if (mesh) {
    mesh.visible = false
    group.add(mesh)
  }
  return {
    id: relationship.id,
    source: relationship.source,
    target: relationship.target,
    group,
    mesh,
  }
}
