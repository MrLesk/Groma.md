import type { ViewerTheme } from '../atoms/theme.ts'
import type { SearchState, ViewerFocus } from '../navigation.ts'
import { accent, bold, dim, type Line } from './text.ts'

const paneHints: Record<ViewerFocus, string> = {
  architecture: '←↑↓→ select   enter open   backspace back   tab tree   w work',
  hierarchy: '↑↓ move   ←→ fold   enter select   tab map   w work',
  details: '↑↓ scroll   t tab   backspace back   esc map   w work',
}

export function footerHint(
  focus: ViewerFocus,
  actionTitle: string | undefined,
  picking: boolean,
): string {
  if (picking) {
    return actionTitle === undefined
      ? '↑↓ action   enter pick   t tab   esc map'
      : `${actionTitle}   ↑↓ action   enter pick   x clear   esc map`
  }
  if (actionTitle !== undefined) {
    if (focus === 'architecture') return `${actionTitle}   s next   x clear   enter open`
    if (focus === 'hierarchy') return `${actionTitle}   s next   x clear   enter select`
    return `${actionTitle}   s next   x clear   esc map`
  }
  return paneHints[focus]
}

export function searchLine(search: SearchState): string {
  const match = search.matches[search.index]
  const position = match === undefined
    ? search.query.trim().length === 0 ? '' : 'no matches'
    : `${search.index + 1} of ${search.matches.length} · ${match.title}`
  return `/ ${search.query}▏  ${position}   ↑↓ next   enter keep   esc back`
}

/** Wordmark and stats on the left, the exit hint on the right edge. */
export function headerLine(theme: ViewerTheme, width: number, stats: string | undefined): Line {
  const exitHint = 'Ctrl+C exit'
  const left = ` groma${stats === undefined ? '' : `  ${stats}`}`
  const gap = Math.max(1, width - 1 - [...left].length - 1 - exitHint.length)
  return [
    accent(theme, '▌'),
    bold(theme, 'groma'),
    ...(stats === undefined ? [] : [dim(theme, `  ${stats}`)]),
    dim(theme, `${' '.repeat(gap)}${exitHint}`),
  ]
}
