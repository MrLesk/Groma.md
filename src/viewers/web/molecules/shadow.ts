import {
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three'
import type { Bounds } from '../../../types.ts'
import { at } from '../atoms/space.ts'

/** Soft ambient shadow that grounds a root element on the sheet. */
export function addShadow(parent: Group, bounds: Bounds): void {
  const spread = Math.min(24, Math.max(6, Math.min(bounds.width, bounds.height) * 0.12))
  const width = bounds.width + spread * 2
  const height = bounds.height + spread * 2
  const px = 256
  const canvas = document.createElement('canvas')
  canvas.width = px
  canvas.height = Math.max(2, Math.round(px * height / width))
  const ctx = canvas.getContext('2d')!
  // The filled rect is the element footprint; the blur's penumbra
  // straddles its edge and stays inside the canvas.
  const inset = px * spread / width
  ctx.filter = `blur(${inset * 0.7}px)`
  ctx.fillStyle = 'rgba(38, 37, 29, 0.25)'
  ctx.fillRect(inset, inset, canvas.width - inset * 2, canvas.height - inset * 2)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  const mesh = new Mesh(
    new PlaneGeometry(width, height),
    new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.position.copy(at(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
    -0.1,
  ))
  mesh.renderOrder = -1
  mesh.raycast = () => {}
  parent.add(mesh)
}
