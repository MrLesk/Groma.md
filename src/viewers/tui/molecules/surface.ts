import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer, RGBA } from '@opentui/core'

import { borderCharacters, drawBorder } from '../atoms/border.ts'
import type { BorderCharacters } from '../atoms/border.ts'
import { kindGlyph } from '../../atoms/kind.ts'
import { text } from '../atoms/text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import type { Bounds } from '../../../types.ts'
import type { ProjectedMapItem } from '../projection.ts'

/** Frame weight distinguishes zones, containers and root islands. */
function frameWeight(item: ProjectedMapItem): number {
  if (item.kind === 'group') return TextAttributes.DIM
  return item.kind === 'container' ? 0 : TextAttributes.BOLD
}

/** A plain interior masks the routes and surfaces behind it. */
export function fillSurface(buffer: OptimizedBuffer, item: ProjectedMapItem, viewport: Bounds, theme: ViewerTheme): void {
  const bounds = item.cellBounds
  const left = Math.max(bounds.x + 1, viewport.x)
  const top = Math.max(bounds.y + 1, viewport.y)
  const right = Math.min(bounds.x + bounds.width - 1, viewport.x + viewport.width)
  const bottom = Math.min(bounds.y + bounds.height - 1, viewport.y + viewport.height)
  if (right <= left || bottom <= top) return
  buffer.fillRect(left, top, right - left, bottom - top, theme.background)
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
    attributes: accented ? TextAttributes.BOLD : frameWeight(item),
  }
}

/** The name and kind glyph right after the top corner; a zone shows its name alone, dim. */
function drawSurfaceTitle(buffer: OptimizedBuffer, item: ProjectedMapItem, look: FrameLook, theme: ViewerTheme, viewport: Bounds): void {
  const bounds = item.cellBounds
  if (item.preview === 'vertical') {
    const top = Math.max(bounds.y + 1, viewport.y)
    const bottom = Math.min(bounds.y + bounds.height - 1, viewport.y + viewport.height)
    const letters = [...item.title].slice(0, Math.max(0, bottom - top))
    const y = top + Math.floor((bottom - top - letters.length) / 2)
    for (const [index, letter] of letters.entries()) {
      text(buffer, letter, bounds.x + 1, y + index, 1, look.color, theme.background, TextAttributes.DIM)
    }
    return
  }
  // A zone and the shared actors and external islands show their name alone.
  const title = item.kind === 'group' || item.representationId === undefined ? item.title : `${kindGlyph(item.kind)} ${item.title}`
  const attributes = item.kind === 'group' ? TextAttributes.DIM : TextAttributes.BOLD
  text(buffer, ` ${title} `, bounds.x + 1, bounds.y, Math.max(0, bounds.width - 2), look.color, theme.background, attributes)
}

/** The frame at its look, then the name. */
export function drawSurfaceFrame(buffer: OptimizedBuffer, item: ProjectedMapItem, theme: ViewerTheme, accented: boolean, viewport: Bounds): void {
  const look = frameLook(item, theme, accented)
  drawBorder(buffer, item.cellBounds, look.characters, look.color, theme.background, look.attributes)
  drawSurfaceTitle(buffer, item, look, theme, viewport)
}
