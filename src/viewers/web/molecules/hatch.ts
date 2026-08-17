import {
  CanvasTexture,
  MeshBasicMaterial,
  NearestFilter,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three'
import type { C4Kind } from '../../../types.ts'
import { css, hatchLine, raised, shade } from '../atoms/theme.ts'

function hatchTexture(paint: (ctx: CanvasRenderingContext2D, size: number) => void): CanvasTexture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = css(raised)
  ctx.fillRect(0, 0, size, size)
  paint(ctx, size)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.magFilter = NearestFilter
  return texture
}

// Rebuilt when the palette changes: the strokes bake the current colors.
let hatches: Record<C4Kind, CanvasTexture> | null = null
let hatchPalette = ''

function buildHatches(): Record<C4Kind, CanvasTexture> {
  return {
    system: hatchTexture((ctx, size) => {
      ctx.strokeStyle = css(hatchLine)
      ctx.lineWidth = 2.5
      ctx.beginPath()
      for (let offset = -size; offset <= size * 2; offset += 14) {
        ctx.moveTo(offset, size)
        ctx.lineTo(offset + size, 0)
      }
      ctx.stroke()
    }),
    container: hatchTexture((ctx, size) => {
      ctx.strokeStyle = css(hatchLine)
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let offset = -size; offset <= size * 2; offset += 22) {
        ctx.moveTo(offset, size)
        ctx.lineTo(offset + size, 0)
      }
      ctx.stroke()
    }),
    component: hatchTexture((ctx, size) => {
      ctx.strokeStyle = css(hatchLine)
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (let y = 10; y < size; y += 14) {
        ctx.moveTo(0, y)
        ctx.lineTo(size, y)
      }
      ctx.stroke()
    }),
    person: hatchTexture((ctx, size) => {
      ctx.fillStyle = css(hatchLine)
      for (let y = 8; y < size; y += 14) {
        for (let x = 8; x < size; x += 14) {
          ctx.beginPath()
          ctx.arc(x, y, 2.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }),
  }
}

function currentHatches(): Record<C4Kind, CanvasTexture> {
  const key = `${raised}:${hatchLine}`
  if (hatches === null || hatchPalette !== key) {
    hatchPalette = key
    hatches = buildHatches()
  }
  return hatches
}

export function sideMaterial(
  kind: C4Kind,
  faceWidth: number,
  faceHeight: number,
  shaded: boolean,
): MeshBasicMaterial {
  const map = currentHatches()[kind].clone()
  map.repeat.set(Math.max(faceWidth / 4, 0.5), Math.max(faceHeight / 4, 0.5))
  return new MeshBasicMaterial({
    map,
    color: shaded ? shade : raised,
  })
}
