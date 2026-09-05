import type { ViewerTheme } from '../atoms/theme.ts'
import type { ViewerFocus } from '../navigation.ts'
import type { SearchState } from '../navigation-search.ts'
import { accent, bold, dim, type Line } from './text.ts'

const paneHints: Record<ViewerFocus, string> = {
  architecture: '[↑↓←→] Select  [Enter] Open',
  hierarchy: '[↑↓] Select  [←→] Fold  [Enter] Open  [Esc] Map',
  details: '[↑↓] Select/scroll  [Enter] Follow  [Tab] Tabs  [Esc] Map',
}

export function footerHint(
  focus: ViewerFocus,
  actionTitle: string | undefined,
  opensContainer = true,
): string {
  const base = paneHints[focus].replace('[Enter] Open', opensContainer ? '[Enter] Open' : '[Enter] Details')
  const flow = actionTitle === undefined ? '' : '  [s] Step  [x] Clear'
  return `${base}${flow}  [t] Hierarchy  [d] Details  [/] Search  [?] Help`
}

export function searchLine(search: SearchState): string {
  const match = search.matches[search.index]
  const position = match === undefined
    ? search.query.trim().length === 0 ? '' : 'no matches'
    : `${search.index + 1} of ${search.matches.length} · ${match.title}`
  return `/ ${search.query}▏  ${position}   [↑↓] Next  [Enter] Keep  [Esc] Back  [?] Help`
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
