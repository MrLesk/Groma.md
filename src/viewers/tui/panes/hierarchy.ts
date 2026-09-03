import type { TextChunk } from '@opentui/core'

import { kindGlyph, kindLabel } from '../../atoms/kind.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import type { TreeRow } from '../tree.ts'
import type { WorkGroup } from '../work/model.ts'
import { accent, bold, dim, kindMark, plain, styleRow, type Line, type PaneLines } from './text.ts'
import type { WorkItem } from '../../../types.ts'

const legendKinds = [['actor', 'system'], ['container', 'component']] as const

/** The first visible row, chosen so the cursor row stays inside the window. */
export function scrollOffset(cursorIndex: number, rowCount: number, height: number): number {
  return Math.max(0, Math.min(cursorIndex - Math.floor(height / 2), rowCount - height))
}

/** The selection mark in the first column. */
function marker(theme: ViewerTheme, marked: boolean): TextChunk {
  return marked ? accent(theme, '▌') : plain(theme, ' ')
}

function treeRow(theme: ViewerTheme, row: TreeRow, selected: boolean): Line {
  const expand = row.hasChildren ? row.expanded ? '▾' : '▸' : ' '
  const suffix = row.hasChildren && !row.expanded ? ` (${row.count})` : ''
  const ghost = row.origin !== 'observed' || row.external
  return [
    marker(theme, selected),
    plain(theme, `${'  '.repeat(row.depth)}${expand} `),
    kindMark(theme, row.kind, row.external),
    (ghost ? dim : plain)(theme, ` ${row.title}${suffix}`),
  ]
}

/** The flows list, a rule, and the containment tree. The cursor row is recorded whether or not the pane has focus, and inverted only when it does. */
export function hierarchyLines(
  theme: ViewerTheme,
  width: number,
  commands: readonly { id: string; title: string }[],
  rows: readonly TreeRow[],
  selectionId: string | undefined,
  cursorId: string | undefined,
  activeActionId: string | undefined,
  focused: boolean,
): PaneLines {
  const lines: Line[] = []
  let cursor: number | undefined
  const push = (id: string, line: Line, lit: boolean): void => {
    const atCursor = id === cursorId
    if (atCursor) cursor = lines.length
    lines.push(styleRow(theme, line, width, lit, atCursor && focused))
  }
  if (commands.length > 0) {
    lines.push([dim(theme, ' Flows')])
    for (const command of commands) {
      const lit = command.id === activeActionId
      push(command.id, [marker(theme, lit), plain(theme, `→ ${command.title}`)], lit)
    }
    lines.push([dim(theme, '─'.repeat(width))])
  }
  for (const row of rows) push(row.id, treeRow(theme, row, row.id === selectionId), false)
  return { lines, cursor }
}

export function legendLines(theme: ViewerTheme, width: number): Line[] {
  return [
    [dim(theme, '─'.repeat(width))],
    ...legendKinds.map(kinds => [plain(theme, ` ${kinds.map(kind => `${kindGlyph(kind)} ${kindLabel(kind)}`).join('  ')}`)]),
  ]
}

/** Work focus: every configured status with its tasks, two rows per task. */
export function workListLines(
  theme: ViewerTheme,
  width: number,
  groups: readonly WorkGroup[],
  taskId: string | undefined,
  focused: boolean,
): PaneLines {
  const lines: Line[] = [[accent(theme, ' Tasks (Work focus)')], []]
  let cursor: number | undefined
  const task = (item: WorkItem): void => {
    const selected = item.id === taskId
    if (selected) cursor = lines.length
    const head: Line = [marker(theme, selected), plain(theme, `  ${[item.id, ...item.assignees].join('  ')}`)]
    lines.push(styleRow(theme, head, width, selected, selected && focused))
    lines.push(styleRow(theme, [plain(theme, ' '), dim(theme, `  ${item.title}`)], width, false, selected && focused))
  }
  for (const group of groups) {
    lines.push([plain(theme, ' ▾ '), bold(theme, `${group.status} (${group.items.length})`)])
    for (const item of group.items) task(item)
  }
  return { lines, cursor }
}
