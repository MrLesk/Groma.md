import {
  CanvasTexture,
  MeshBasicMaterial,
  NearestFilter,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three'
import type { C4Kind } from '../../../types.ts'

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

export function sideMaterial(
  kind: C4Kind,
  faceWidth: number,
  faceHeight: number,
  shaded: boolean,
): MeshBasicMaterial {
  const map = hatches[kind].clone()
  map.repeat.set(Math.max(faceWidth / 4, 0.5), Math.max(faceHeight / 4, 0.5))
  return new MeshBasicMaterial({
    map,
    color: shaded ? 0xE4DFCC : 0xFFFFFF,
  })
}
