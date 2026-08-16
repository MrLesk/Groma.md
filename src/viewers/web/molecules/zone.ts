import {
  BufferGeometry,
  Group,
  Line,
  LineDashedMaterial,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from 'three'
import type { WorldGroup } from '../../../types.ts'
import { drawName, labelPlane } from '../atoms/label.ts'
import { at } from '../atoms/space.ts'
import { ink } from '../atoms/theme.ts'

export function addZone(parent: Group, group: WorldGroup, z: number): void {
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
