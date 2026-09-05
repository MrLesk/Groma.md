import type { WorkItem } from '../../../types.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import { bold, dim, styleRow, wrap, type Line } from '../panes/text.ts'

/** Both task lists show the same identity, acceptance progress and full title. */
export function taskRows(theme: ViewerTheme, item: WorkItem, width: number, selected: boolean, cursor: boolean): Line[] {
  const completed = item.acceptanceCriteriaCompleted
  const total = item.acceptanceCriteriaCount
  const pie = completed === 0 ? '○' : completed === total ? '●' : ['◔', '◑', '◕'][Math.min(2, Math.max(0, Math.round(completed / total * 4) - 1))]
  const progress = item.acceptanceCriteriaCount > 0 ? ` ${pie} ${completed}/${total}` : ''
  return [
    styleRow(theme, [bold(theme, item.id), dim(theme, progress)], width, selected, cursor),
    ...wrap(item.title, width - 2).map(row => styleRow(theme, [dim(theme, `  ${row}`)], width, selected, cursor)),
  ]
}
