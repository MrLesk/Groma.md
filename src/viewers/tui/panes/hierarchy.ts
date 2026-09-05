import type { TextChunk } from '@opentui/core'

import { kindGlyph, kindLabel } from '../../atoms/kind.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import type { TreeRow } from '../tree.ts'
import type { WorkRow, WorkSelection } from '../work/model.ts'
import { accent, bold, dim, kindMark, plain, styleRow, type Line, type PaneLines } from './text.ts'
import type { WorkItem } from '../../../types.ts'
import { taskRows } from '../work/rows.ts'
import type { GromaRevision } from '../../../history/revisions.ts'

const legendKinds = [['actor', 'system'], ['container', 'component']] as const

/** The first visible row, chosen so the cursor row stays inside the window. */
export function scrollOffset(cursorIndex: number, rowCount: number, height: number, previous = 0): number {
  const visible = Math.max(cursorIndex - height + 1, Math.min(previous, cursorIndex))
  return Math.max(0, Math.min(visible, rowCount - height))
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
  const ids: (string | undefined)[] = []
  let cursor: number | undefined
  const push = (id: string | undefined, line: Line, lit: boolean): void => {
    const atCursor = id !== undefined && id === cursorId
    if (atCursor) cursor = lines.length
    ids.push(id)
    lines.push(styleRow(theme, line, width, lit, atCursor && focused))
  }
  if (commands.length > 0) {
    push(undefined, [dim(theme, ' Flows')], false)
    for (const command of commands) {
      const lit = command.id === activeActionId
      push(command.id, [plain(theme, `${lit ? '☑' : '☐'} ${command.title}`)], lit)
    }
    push(undefined, [dim(theme, '─'.repeat(width))], false)
  }
  for (const row of rows) {
    const selected = row.id === selectionId
    push(row.id, treeRow(theme, row, selected), selected)
  }
  return { lines, cursor, ids }
}

export function legendLines(theme: ViewerTheme, width: number): Line[] {
  return [
    [dim(theme, '─'.repeat(width))],
    ...legendKinds.map(kinds => [plain(theme, ` ${kinds.map(kind => `${kindGlyph(kind)} ${kindLabel(kind)}`).join('  ')}`)]),
  ]
}

/** Current-branch Groma commits, newest first, with unsupported revisions left visible. */
export function revisionLines(
  theme: ViewerTheme,
  width: number,
  revisions: readonly GromaRevision[],
  cursor: number,
  selectedId: string | undefined,
  focused: boolean,
): PaneLines {
  const lines: Line[] = [[accent(theme, ' History')], []]
  const ids: (string | undefined)[] = [undefined, undefined]
  let cursorRow: number | undefined
  for (const [index, revision] of revisions.entries()) {
    const atCursor = index === cursor
    if (atCursor) cursorRow = lines.length
    const selected = revision.id === selectedId
    lines.push(styleRow(theme, [marker(theme, selected), plain(theme, ` ${revision.subject}`)], width, selected, atCursor && focused))
    lines.push(styleRow(theme, [plain(theme, ' '), dim(theme, `  ${revision.shortId} · ${revision.date.slice(0, 10)}${revision.compatible ? '' : ' · Unsupported'}`)], width, false, atCursor && focused))
    ids.push(revision.id, revision.id)
  }
  return { lines, ids, cursor: cursorRow }
}

function statusMark(status: string, shown: readonly string[] | undefined): string {
  if (shown === undefined) return ''
  return shown.includes(status) ? '✓ ' : '○ '
}

/** Status groups and task rows; only the hierarchy supplies visibility controls. */
export function workListLines(
  theme: ViewerTheme,
  width: number,
  rows: readonly WorkRow[],
  selection: WorkSelection,
  shown: readonly string[] | undefined,
  focused: boolean,
  title = true,
): PaneLines {
  const lines: Line[] = title ? [[accent(theme, ' Backlog')], []] : []
  let cursor: number | undefined
  const task = (item: WorkItem): void => {
    const selected = selection.state === 'selected' && item.id === selection.taskId
    if (selected) cursor = lines.length
    lines.push(...taskRows(theme, item, width, selected, selected && focused))
  }
  for (const row of rows) {
    if (row.kind === 'task') {
      task(row.item)
      continue
    }
    const atCursor = selection.state === 'status' && selection.status === row.status
    if (atCursor) cursor = lines.length
    const mark = row.toggle ? statusMark(row.status, shown) : ''
    lines.push(styleRow(theme, [plain(theme, row.expanded ? ' ▾ ' : ' ▸ '), bold(theme, `${mark}${row.status} (${row.count})`)], width, false, atCursor && focused))
  }
  return { lines, cursor }
}
