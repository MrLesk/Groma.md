import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer, RGBA } from '@opentui/core'

import type { Bounds, WorkItem, WorkSnapshot } from '../../../types.ts'
import { drawBorder } from '../atoms/border.ts'
import { cell } from '../atoms/cell.ts'
import { text } from '../atoms/text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import type { ProjectedMapItem, TerminalProjection } from '../projection.ts'
import { workGroups, type WorkAnchor, type WorkGroup } from './model.ts'

interface ListLine {
  kind: 'heading' | 'task' | 'title'
  value: string
  taskId?: string
}

function listLines(groups: readonly WorkGroup[]): ListLine[] {
  return groups.flatMap(group => [
    { kind: 'heading' as const, value: `${group.status} (${group.items.length})` },
    ...group.items.flatMap(item => [
      {
        kind: 'task' as const,
        taskId: item.id,
        value: [item.id, ...item.assignees].join('  '),
      },
      { kind: 'title' as const, taskId: item.id, value: item.title },
    ]),
  ])
}

export function drawWorkList(
  buffer: OptimizedBuffer,
  bounds: Bounds,
  groups: readonly WorkGroup[],
  taskId: string | undefined,
  focused: boolean,
  theme: ViewerTheme,
): void {
  const width = Math.max(0, bounds.width - 2)
  const height = Math.max(0, bounds.height - 2)
  if (width === 0 || height === 0) return
  text(
    buffer,
    'Tasks (Work focus)',
    bounds.x + 2,
    bounds.y + 1,
    width - 1,
    theme.selected,
    theme.background,
    TextAttributes.BOLD,
  )
  const lines = listLines(groups)
  const visibleHeight = Math.max(0, height - 2)
  const selectedLine = Math.max(0, lines.findIndex(line => line.taskId === taskId))
  const selectedBottom = Math.min(lines.length - 1, selectedLine + 1)
  const scroll = Math.max(0, Math.min(selectedLine - 1, selectedBottom - visibleHeight + 1))
  for (let index = 0; index < visibleHeight; index += 1) {
    const line = lines[scroll + index]
    if (line === undefined) break
    const y = bounds.y + 3 + index
    const selected = line.taskId !== undefined && line.taskId === taskId
    const background = selected && focused ? theme.selected : theme.background
    if (selected && focused) buffer.fillRect(bounds.x + 1, y, width, 1, background)
    if (selected && line.kind === 'task') {
      cell(
        buffer,
        bounds.x + 1,
        y,
        '▌',
        focused ? theme.background : theme.selected,
        background,
      )
    }
    const prefix = line.kind === 'heading' ? '▾ ' : '  '
    const color = selected && focused
      ? theme.background
      : selected ? theme.selected : theme.foreground
    text(
      buffer,
      `${prefix}${line.value}`,
      bounds.x + 2,
      y,
      width - 1,
      color,
      background,
      line.kind === 'heading' || selected && line.kind === 'task'
        ? TextAttributes.BOLD
        : line.kind === 'title' ? TextAttributes.DIM : 0,
    )
  }
}

interface DetailLine {
  value: string
  color: RGBA
  attributes: number
}

function wrap(value: string, width: number, prefix = ''): string[] {
  if (width <= prefix.length || value.length === 0) return value.length === 0 ? [] : [prefix]
  const result: string[] = []
  let rest = value
  let first = true
  while (rest.length > 0) {
    const inset = first ? prefix : ' '.repeat(prefix.length)
    const available = width - inset.length
    if (rest.length <= available) {
      result.push(`${inset}${rest}`)
      break
    }
    const slice = rest.slice(0, available + 1)
    const breakAt = slice.lastIndexOf(' ')
    const take = breakAt <= 0 ? available : breakAt
    result.push(`${inset}${rest.slice(0, take)}`)
    rest = rest.slice(take).trimStart()
    first = false
  }
  return result
}

function taskLines(item: WorkItem, width: number, theme: ViewerTheme): DetailLine[] {
  const plain = (value: string, attributes = 0): DetailLine => ({
    value,
    color: theme.foreground,
    attributes,
  })
  const dim = (value: string): DetailLine => ({
    value,
    color: theme.foreground,
    attributes: TextAttributes.DIM,
  })
  const accent = (value: string): DetailLine => ({
    value,
    color: theme.selected,
    attributes: TextAttributes.BOLD,
  })
  const heading = (value: string): DetailLine => dim(
    `${value} ${'─'.repeat(Math.max(0, width - value.length - 1))}`,
  )
  const rows: DetailLine[] = [accent([item.status, ...item.assignees].join(' · ')), plain('')]
  rows.push(...wrap(item.title, width).map(line => plain(line, TextAttributes.BOLD)))
  if (item.acceptanceCriteriaCount > 0) {
    rows.push(plain(''), heading(
      `Acceptance criteria · ${item.acceptanceCriteriaCompleted} of ${item.acceptanceCriteriaCount}`,
    ))
  }
  if (item.modifiedFiles.length > 0) {
    rows.push(plain(''), heading('Modified files'))
    for (const file of item.modifiedFiles) rows.push(...wrap(file, width).map(plain))
  }
  if (item.references.length > 0) {
    rows.push(plain(''), heading('References'))
    for (const reference of item.references) rows.push(...wrap(reference, width).map(plain))
  }
  return rows
}

export function drawWorkDetails(
  buffer: OptimizedBuffer,
  bounds: Bounds,
  item: WorkItem | undefined,
  scroll: number,
  focused: boolean,
  theme: ViewerTheme,
): void {
  if (bounds.width <= 0 || bounds.height <= 0) return
  buffer.fillRect(bounds.x, bounds.y, bounds.width, bounds.height, theme.background)
  drawBorder(
    buffer,
    bounds,
    'observed',
    focused ? theme.selected : theme.foreground,
    theme.background,
    'card',
    focused ? 0 : TextAttributes.DIM,
  )
  const width = Math.max(0, bounds.width - 4)
  text(
    buffer,
    ` ${item?.id ?? 'Task'} `,
    bounds.x + 2,
    bounds.y,
    width,
    item === undefined ? theme.foreground : theme.selected,
    theme.background,
    TextAttributes.BOLD,
  )
  if (item === undefined) return
  const rows = taskLines(item, width, theme)
  const visible = Math.max(0, bounds.height - 2)
  const offset = Math.max(0, Math.min(scroll, Math.max(0, rows.length - visible)))
  for (let index = 0; index < visible; index += 1) {
    const row = rows[offset + index]
    if (row === undefined) break
    text(
      buffer,
      row.value,
      bounds.x + 2,
      bounds.y + 1 + index,
      width,
      row.color,
      theme.background,
      row.attributes,
    )
  }
}

export function drawWorkMarker(
  buffer: OptimizedBuffer,
  item: ProjectedMapItem,
  projection: TerminalProjection,
  anchor: WorkAnchor,
  theme: ViewerTheme,
): void {
  const label = anchor.count === 1 ? '◆' : `◆${anchor.count}`
  const width = label.length + 2
  if (item.cellBounds.width < width + 4) return
  const x = item.cellBounds.x + item.cellBounds.width - width - 1
  const y = Math.max(item.cellBounds.y, projection.viewport.y)
  text(
    buffer,
    ` ${label} `,
    x,
    y,
    width,
    anchor.active ? theme.selected : theme.foreground,
    theme.background,
    anchor.active ? TextAttributes.BOLD : TextAttributes.DIM,
  )
}

export function drawWorkRecap(
  buffer: OptimizedBuffer,
  bounds: Bounds,
  work: WorkSnapshot | undefined,
  open: boolean,
  theme: ViewerTheme,
): void {
  const terminal = work?.statuses.at(-1)
  const groups = workGroups(work)
  const actionable = groups.filter(group => group.status !== terminal)
  const shown = (actionable.length === 0 ? groups : actionable).slice(0, 2)
  if (shown.length === 0 || bounds.width <= 0) return
  const counts = shown.map(group => `${group.items.length} ${group.status}`).join(' · ')
  const value = ` Backlog · ${counts} · w ${open ? 'close' : 'task details'} `
  const width = Math.min(value.length, bounds.width)
  const x = bounds.x + Math.max(0, Math.floor((bounds.width - width) / 2))
  buffer.fillRect(x, bounds.y, width, 1, theme.observedTint)
  text(buffer, value, x, bounds.y, width, theme.foreground, theme.observedTint)
}
