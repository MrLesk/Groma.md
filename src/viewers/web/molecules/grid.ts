import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
} from 'three'
import type { Bounds } from '../../../types.ts'
import { at } from '../atoms/space.ts'
import { gridLine } from '../atoms/theme.ts'

const spacing = 20
const margin = 40

/** Quiet survey grid ruled under the whole sheet; vector lines, not a texture, so no moire pattern. */
export function addGrid(parent: Group, bounds: Bounds): void {
  const left = Math.floor((bounds.x - margin) / spacing) * spacing
  const right = Math.ceil((bounds.x + bounds.width + margin) / spacing) * spacing
  const near = Math.floor((bounds.y - margin) / spacing) * spacing
  const far = Math.ceil((bounds.y + bounds.height + margin) / spacing) * spacing

  const positions: number[] = []
  const push = (x: number, y: number): void => {
    const point = at(x, y, -0.3)
    positions.push(point.x, point.y, point.z)
  }
  for (let x = left; x <= right; x += spacing) {
    push(x, near)
    push(x, far)
  }
  for (let y = near; y <= far; y += spacing) {
    push(left, y)
    push(right, y)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  const lines = new LineSegments(geometry, new LineBasicMaterial({
    color: gridLine,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  }))
  lines.renderOrder = -2
  lines.raycast = () => {}
  parent.add(lines)
}
