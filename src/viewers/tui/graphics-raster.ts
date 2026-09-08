import { existsSync } from 'node:fs'
import path from 'node:path'
import type { RenderedImage, ResvgRenderOptions } from '@resvg/resvg-js'

/** Prefer one installed UI font; scanning every system font on each frame is expensive. */
export function graphicsFontOptions(): ResvgRenderOptions {
  const windows = process.env.SystemRoot ?? process.env.WINDIR ?? 'C:\\Windows'
  const candidates: readonly (readonly [string, string])[] = [
    [path.join(windows, 'Fonts', 'segoeui.ttf'), 'Segoe UI'],
    ['/System/Library/Fonts/Supplemental/Arial.ttf', 'Arial'],
    ['/Library/Fonts/Arial.ttf', 'Arial'],
    ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'DejaVu Sans'],
    ['/usr/share/fonts/dejavu-sans-fonts/DejaVuSans.ttf', 'DejaVu Sans'],
    ['/usr/share/fonts/TTF/DejaVuSans.ttf', 'DejaVu Sans'],
    ['/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf', 'Liberation Sans'],
    ['/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', 'Liberation Sans'],
  ]
  const chosen = candidates.find(([file]) => existsSync(file))
  return chosen === undefined ? { font: { loadSystemFonts: true } } : {
    font: { loadSystemFonts: false, fontFiles: [chosen[0]], defaultFontFamily: chosen[1], sansSerifFamily: chosen[1] },
  }
}

let options: ResvgRenderOptions | undefined

export async function rasterizeGraphics(svg: string): Promise<RenderedImage> {
  const { renderAsync } = await import('@resvg/resvg-js')
  options ??= graphicsFontOptions()
  return renderAsync(svg, options)
}
