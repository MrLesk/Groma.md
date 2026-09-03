import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer, RGBA } from '@opentui/core'

import { borderCharacters, drawBorder } from '../atoms/border.ts'
import type { BorderCharacters } from '../atoms/border.ts'
import { cell } from '../atoms/cell.ts'
import { kindGlyph } from '../../atoms/kind.ts'
import { text } from '../atoms/text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import type { Bounds } from '../../../types.ts'
import type { ProjectedMapItem } from '../projection.ts'

/** A glyph every `step` columns from `inset` columns inside the frame, on every other interior row. */
interface SurfacePattern {
  glyph: string
  step: number
  inset: number
}

/** What a surface kind looks like: its pattern, and its frame weight by depth. */
interface SurfaceLook {
  pattern: SurfacePattern | undefined
  weight: number
}

/** Zone hatch on a dim frame, slab grain on a plain one, island dots, crosses or nothing on a bold one. */
function surfaceLook(item: ProjectedMapItem): SurfaceLook {
  if (item.kind === 'group') return { pattern: { glyph: '╱', step: 8, inset: 3 }, weight: TextAttributes.DIM }
  if (item.kind === 'container') return { pattern: { glyph: '╲', step: 8, inset: 2 }, weight: 0 }
  if (item.kind === 'actor') return { pattern: { glyph: '·', step: 2, inset: 1 }, weight: TextAttributes.BOLD }
  if (item.external) return { pattern: { glyph: '×', step: 2, inset: 1 }, weight: TextAttributes.BOLD }
  return { pattern: undefined, weight: TextAttributes.BOLD }
}

/** The surface interior inside the viewport: its background, then the kind pattern anchored to the surface, dim. */
export function fillSurface(buffer: OptimizedBuffer, item: ProjectedMapItem, viewport: Bounds, theme: ViewerTheme): void {
  const bounds = item.cellBounds
  const left = Math.max(bounds.x + 1, viewport.x)
  const top = Math.max(bounds.y + 1, viewport.y)
  const right = Math.min(bounds.x + bounds.width - 1, viewport.x + viewport.width)
  const bottom = Math.min(bounds.y + bounds.height - 1, viewport.y + viewport.height)
  if (right <= left || bottom <= top) return
  buffer.fillRect(left, top, right - left, bottom - top, theme.background)
  const pattern = surfaceLook(item).pattern
  if (pattern === undefined) return
  const first = bounds.x + pattern.inset
  const last = bounds.x + bounds.width - pattern.inset
  for (let y = top; y < bottom; y += 1) {
    if ((y - bounds.y) % 2 !== 1) continue
    for (let x = Math.max(left, first); x < Math.min(right, last); x += 1) {
      if ((x - first) % pattern.step === 0) cell(buffer, x, y, pattern.glyph, theme.foreground, theme.background, TextAttributes.DIM)
    }
  }
}

/** How a surface's frame and name draw: at its depth's weight, or heavy in the accent when selected or touched. */
interface FrameLook {
  characters: BorderCharacters
  color: RGBA
  attributes: number
}

function frameLook(item: ProjectedMapItem, theme: ViewerTheme, accented: boolean): FrameLook {
  return {
    characters: borderCharacters(item.origin, item.kind === 'group' ? 'zone' : 'surface', accented),
    color: accented ? theme.selected : theme.foreground,
    attributes: accented ? TextAttributes.BOLD : surfaceLook(item).weight,
  }
}

/** The name and kind glyph right after the top corner; a zone shows its name alone, dim. */
function drawSurfaceTitle(buffer: OptimizedBuffer, item: ProjectedMapItem, look: FrameLook, theme: ViewerTheme): void {
  const bounds = item.cellBounds
  const title = item.kind === 'group' ? item.title : `${kindGlyph(item.kind)} ${item.title}`
  const attributes = item.kind === 'group' ? TextAttributes.DIM : TextAttributes.BOLD
  text(buffer, ` ${title} `, bounds.x + 1, bounds.y, Math.max(0, bounds.width - 2), look.color, theme.background, attributes)
}

/** The frame at its look, then the name. */
export function drawSurfaceFrame(buffer: OptimizedBuffer, item: ProjectedMapItem, theme: ViewerTheme, accented: boolean): void {
  const look = frameLook(item, theme, accented)
  drawBorder(buffer, item.cellBounds, look.characters, look.color, theme.background, look.attributes)
  drawSurfaceTitle(buffer, item, look, theme)
}
