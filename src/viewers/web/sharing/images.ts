import { readFileSync } from 'node:fs'
import { initWasm, Resvg } from '@resvg/resvg-wasm'
import wasm from '@resvg/resvg-wasm/index_bg.wasm' with { type: 'file' }
import { fontBuffers } from '../atoms/fonts/index.ts'
import { themeModes, type WebTheme } from '../atoms/theme.ts'
import { renderCover, type CoverPayload } from './cover.ts'

export const coverThemes = themeModes.filter(theme => theme !== 'auto')
export type CoverImages = Record<WebTheme, Uint8Array<ArrayBuffer>>

let ready: Promise<void> | undefined

function renderPng(svg: string): Uint8Array<ArrayBuffer> {
  const renderer = new Resvg(svg, { font: {
    fontBuffers,
    defaultFontFamily: 'DejaVu Sans Mono',
    monospaceFamily: 'DejaVu Sans Mono',
    sansSerifFamily: 'DejaVu Sans',
  } })
  try {
    const image = renderer.render()
    try {
      return new Uint8Array(image.asPng())
    } finally {
      image.free()
    }
  } finally {
    renderer.free()
  }
}

/** The embedded renderer and fonts generate both live and exported covers entirely in process. */
export async function generateCovers(payload: CoverPayload): Promise<CoverImages> {
  ready ??= initWasm(readFileSync(wasm))
  await ready
  const images = {} as CoverImages
  for (const theme of coverThemes) images[theme] = renderPng(renderCover(payload, theme))
  return images
}
