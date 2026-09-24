import lockup from '../atoms/lockup.svg' with { type: 'text' }
import { escaped } from '../atoms/escape.ts'
import { palettes, webFontFamily, type WebTheme } from '../atoms/theme.ts'
import { textWidth } from '../../../sheet/measure.ts'
import { fitCamera, pan } from '../iso/camera.ts'
import { gridPattern } from '../iso/grid.ts'
import { buildingsSvg, facadeDefs } from '../iso/paint-buildings.ts'
import { islandsSvg, sheetSvg, slabsSvg } from '../iso/paint-ground.ts'
import { routesSvg } from '../iso/paint-routes.ts'
import { presentScene } from '../iso/presentation.ts'
import { facadeDetailsVisible, surfacePatternsVisible } from '../iso/scale.ts'
import { mapDefs, mapDrawingCss } from '../iso/style.ts'
import { markup, node } from '../iso/svg.ts'
import { NESTED_POSE } from '../layers/orbit.ts'
import type { WebMapPayload } from '../payload.ts'

export const COVER_SIZE = { width: 1200, height: 630 } as const
export type CoverPayload = Pick<WebMapPayload, 'sheet' | 'project'>

function titleWithin(title: string, width: number): string {
  if (textWidth(title, 36) <= width) return title
  const letters = [...title]
  while (textWidth(`${letters.join('')}…`, 36) > width) letters.pop()
  return `${letters.join('')}…`
}

/** The real map sits on one continuous field; a glass footer carries the project's sharing identity. */
export function renderCover(payload: CoverPayload, theme: WebTheme): string {
  const palette = palettes[theme]
  const scene = presentScene(payload.sheet, payload.project ?? undefined, NESTED_POSE)
  const camera = pan(fitCamera(scene.bounds, { width: 1144, height: 432 }), 28, 26)
  const drawing = markup([
    node('g', {}, 'sheet', sheetSvg(scene)),
    node('g', {}, 'islands', islandsSvg(scene, camera.k)),
    node('g', {}, 'slabs', slabsSvg(scene, camera.k)),
    node('g', {}, 'routes', routesSvg(scene)),
    node('g', {}, 'items', buildingsSvg(scene)),
  ])
  const definitions = markup([...mapDefs(scene.view), ...facadeDefs(scene)]).replaceAll('var(--map-hatch)', palette.hatch)
  const title = titleWithin(payload.project?.title ?? 'Groma', 600)
  const brand = lockup.replace('<svg ', '<svg x="86" y="548" width="140" height="35" ')
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
    id="map" width="${COVER_SIZE.width}" height="${COVER_SIZE.height}" viewBox="0 0 1200 630"
    font-family="${escaped(webFontFamily)}" color="${palette.ink}">
    <style>${mapDrawingCss(palette, camera.k)} #map .project-edit { display: none; }</style>
    <defs>
      ${definitions}
      ${markup([gridPattern({ ...camera, k: 0.5 }, scene.view)])}
      <clipPath id="cover-frame"><rect x="10" y="10" width="1180" height="610" rx="26"/></clipPath>
      <clipPath id="cover-footer"><rect x="28" y="478" width="1144" height="126" rx="20"/></clipPath>
      <filter id="frost" filterUnits="userSpaceOnUse" x="0" y="454" width="1200" height="176">
        <feGaussianBlur stdDeviation="14"/>
      </filter>
      <g id="field"><rect width="1200" height="630" fill="${palette.paper}"/>
        <rect width="1200" height="630" fill="url(#grid)"/></g>
    </defs>
    <rect width="1200" height="630" fill="${palette.paper}"/>
    <g clip-path="url(#cover-frame)">
      <use xlink:href="#field"/>
      <g class="camera"${facadeDetailsVisible(camera.k) ? '' : ' data-facades-hidden=""'}${surfacePatternsVisible(camera.k) ? '' : ' data-surface-patterns-hidden=""'}
        transform="translate(${camera.x} ${camera.y}) scale(${camera.k})">${drawing}</g>
      <g clip-path="url(#cover-footer)"><use xlink:href="#field" filter="url(#frost)"/></g>
      <rect x="28" y="478" width="1144" height="126" rx="20" fill="${palette.paper}" fill-opacity="0.56"
        stroke="${palette.line}" stroke-opacity="0.4"/>
      <text x="54" y="526" fill="${palette.ink}" font-size="36" font-weight="700" letter-spacing="-0.7">${escaped(title)}</text>
      <text x="54" y="572" fill="${palette.muted}" font-size="20">By</text>${brand}
      <text x="1144" y="551" fill="${palette.ink}" font-size="27" letter-spacing="-0.65" text-anchor="end">Explore the architecture →</text>
    </g>
    <rect x="10" y="10" width="1180" height="610" rx="26" fill="none" stroke="${palette.line}" stroke-opacity="0.5"/>
  </svg>`
}
