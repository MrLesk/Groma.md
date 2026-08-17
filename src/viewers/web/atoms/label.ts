import {
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three'
import type { Bounds } from '../../../types.ts'
import { at } from './space.ts'
import { css, ink } from './theme.ts'

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

export function labelPlane(
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

export function drawName(
  ctx: CanvasRenderingContext2D,
  scale: number,
  bounds: Bounds,
  text: string,
  fontSize: number,
  align: 'center' | 'start',
  alpha = 1,
): void {
  ctx.font = `${fontSize * scale}px ui-monospace, SFMono-Regular, Menlo, monospace`
  ctx.fillStyle = css(ink)
  ctx.globalAlpha = alpha
  if (align === 'center') {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const margin = 2 * scale
    ctx.fillText(text, bounds.width * scale / 2, bounds.height * scale / 2, bounds.width * scale - margin * 2)
    return
  }
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.letterSpacing = `${0.08 * fontSize * scale}px`
  const inset = 2.5 * scale
  ctx.fillText(text, inset, inset)
}
