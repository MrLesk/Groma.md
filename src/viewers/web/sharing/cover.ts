import lockup from '../atoms/lockup.svg' with { type: 'text' }
import { escaped } from '../atoms/escape.ts'
import { cssBlock, palettes, webFontFamily, type WebTheme } from '../atoms/theme.ts'
import { mapCss } from '../iso/style.ts'
import type { WebMapPayload } from '../payload.ts'

export const COVER_SIZE = { width: 1200, height: 630 } as const
export type CoverPayload = Pick<WebMapPayload, 'sheet' | 'project'>

/** A full-size map field with a camera fitted above one glass footer. */
export function renderCover(payload: CoverPayload, theme: WebTheme, renderer: string): string {
  const json = JSON.stringify({ sheet: payload.sheet, project: payload.project }).replaceAll('<', '\\u003c')
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    :root { ${cssBlock(palettes[theme])} }
    * { box-sizing: border-box; }
    html, body { margin: 0; width: ${COVER_SIZE.width}px; height: ${COVER_SIZE.height}px; overflow: hidden; }
    body { position: relative; background: var(--paper); color: var(--ink); font-family: ${webFontFamily}; }
    .cover { position: absolute; inset: 10px; overflow: hidden; border-radius: 26px;
      border: 1px solid color-mix(in srgb, var(--map-line) 50%, transparent); }
    #map { position: absolute; inset: 0; }
    .architecture-frame { position: absolute; inset: 16px 18px auto; height: 432px; pointer-events: none; }
    .cover-footer { position: absolute; left: 18px; right: 18px; bottom: 16px; height: 126px;
      padding: 17px 26px; display: flex; align-items: center; justify-content: space-between; gap: 24px;
      border: 1px solid color-mix(in srgb, var(--map-line) 40%, transparent); border-radius: 20px;
      background: color-mix(in srgb, var(--paper) 56%, transparent); backdrop-filter: blur(14px); }
    .cover-identity { display: grid; gap: 9px; min-width: 0; }
    h1 { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font-size: 36px; font-weight: 700; line-height: 1.05; letter-spacing: -0.7px; }
    .cover-byline { display: flex; gap: 10px; align-items: center; font-size: 20px; color: var(--muted); }
    .cover-byline svg { width: 140px; height: 35px; color: var(--ink); }
    .cover-invitation { flex: none; font-size: 27px; letter-spacing: -0.65px; white-space: nowrap; }
    ${mapCss}
    #map .project-edit { display: none; }
  </style></head><body><main class="cover">
    <div id="map"></div><div class="architecture-frame"></div>
    <footer class="cover-footer"><div class="cover-identity">
      <h1>${escaped(payload.project?.title ?? 'Groma')}</h1>
      <div class="cover-byline"><span>By</span>${lockup}</div>
    </div><div class="cover-invitation">Explore the architecture →</div></footer>
  </main><script id="cover-data" type="application/json">${json}</script>
  <script>${renderer.replaceAll('</script', '<\\/script')}</script></body></html>`
}
