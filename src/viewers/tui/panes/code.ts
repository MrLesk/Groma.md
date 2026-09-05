import { TextAttributes } from '@opentui/core'

import { codeTokens } from '../../source/highlight.ts'
import type { TaskDiffLine, TaskFileDiff } from '../../source/diff-lines.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import { chunk, dim, plain, wrap, type Line } from './text.ts'

/** Syntax colors remain palette references, so the terminal owns light and dark themes. */
function codeLine(theme: ViewerTheme, source: string): Line {
  return codeTokens(source).map(token => chunk(token.text,
    token.kind === undefined ? theme.foreground : theme.syntax[token.kind],
    token.kind === 'comment' ? TextAttributes.ITALIC
      : token.kind === 'keyword' || token.kind === 'type' || token.kind === 'function' ? TextAttributes.BOLD : 0))
}

export function fileFacts(theme: ViewerTheme, file: TaskFileDiff): Line {
  return [
    ...(file.additions === 0 ? [] : [chunk(`+${file.additions}`, theme.added)]),
    ...(file.additions > 0 && file.deletions > 0 ? [plain(theme, ' ')] : []),
    ...(file.deletions === 0 ? [] : [chunk(`−${file.deletions}`, theme.removed)]),
    ...(file.shared ? [dim(theme, ' Shared')] : []),
  ]
}

/** Exact paths remain selectable on every wrapped row, including their line counts. */
export function taskFileRows(theme: ViewerTheme, path: string, file: TaskFileDiff | undefined, width: number): Line[] {
  const marks = { added: 'A', deleted: 'D', modified: 'M', unchanged: '·' }
  const colors = { added: theme.added, deleted: theme.removed, modified: theme.modified, unchanged: theme.quiet }
  const rows: Line[] = wrap(path, width - 2).map((part, index) => [
    chunk(index === 0 ? `${file === undefined ? '…' : marks[file.status]} ` : '  ', file === undefined ? theme.quiet : colors[file.status]),
    plain(theme, part),
  ])
  const facts = file === undefined ? [] : fileFacts(theme, file)
  if (facts.length === 0) return rows
  const last = rows.at(-1)!
  const used = [...last, ...facts].reduce((sum, part) => sum + part.text.length, 0)
  if (used + 2 <= width) last.push(plain(theme, '  '), ...facts)
  else rows.push([plain(theme, '  '), ...facts])
  return rows
}

/** Numbered source uses the same syntax treatment as the diff reader. */
export function sourceLines(theme: ViewerTheme, view: { file: string; line: number; text?: string }, width: number): Line[] {
  if (view.text === undefined) return [[dim(theme, view.file)]]
  const rows = view.text.split('\n')
  const gutter = String(rows.length).length
  return rows.map((source, index) => [
    chunk(`${String(index + 1).padStart(gutter)} │ `, index + 1 === view.line ? theme.selected : theme.quiet),
    ...codeLine(theme, source.slice(0, Math.max(0, width - gutter - 3))),
  ])
}

/** Old/new line numbers and a colored gutter separate changes without replacing the terminal background. */
export function diffLines(theme: ViewerTheme, view: { file: string; diff?: TaskFileDiff }, width: number): Line[] {
  const diff = view.diff
  if (diff === undefined) return [[dim(theme, view.file)]]
  const labels = { added: 'Added', deleted: 'Removed', modified: 'Modified', unchanged: 'Unchanged' }
  const rows = diff.hunks.flatMap(hunk => hunk.lines)
  const digits = String(Math.max(1, ...rows.flatMap(row => [row.oldLine ?? 0, row.newLine ?? 0]))).length
  const lines: Line[] = [[plain(theme, `${labels[diff.status]}  `), ...fileFacts(theme, diff)]]
  for (const hunk of diff.hunks) {
    lines.push([], [chunk(hunk.header, theme.syntax.number, TextAttributes.BOLD)])
    lines.push(...hunk.lines.map(row => diffRow(theme, row, digits, width)))
  }
  return lines
}

function diffRow(theme: ViewerTheme, row: TaskDiffLine, digits: number, width: number): Line {
  const signs = { added: '+', removed: '−', context: ' ' }
  const gutter = `${String(row.oldLine ?? '').padStart(digits)} ${String(row.newLine ?? '').padStart(digits)} ${signs[row.kind]} `
  const color = row.kind === 'added' ? theme.added : theme.removed
  return [
    row.kind === 'context' ? chunk(gutter, theme.quiet) : chunk(gutter, color, TextAttributes.BOLD),
    ...codeLine(theme, row.text.slice(0, Math.max(0, width - gutter.length))),
  ]
}
