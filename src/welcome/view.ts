import { RGBA, TextAttributes } from '@opentui/core'
import type { OptimizedBuffer } from '@opentui/core'

import { text } from '../viewers/tui/atoms/text.ts'
import {
  advancedCommands,
  advancedRows,
  documentationUrl,
  instructionRows,
  instructionViews,
  launcherRows,
  nestedPageIndicator,
  pluginSummary,
  welcomeVersion,
} from './model.ts'
import type {
  WelcomeModel,
  WelcomeRow,
  WelcomeSheet,
} from './model.ts'

const brandGreen = RGBA.fromHex('#1D9E75')
const terminalForeground = RGBA.defaultForeground()
const terminalBackground = RGBA.defaultBackground()
const mark = [
  '      ●',
  '      │',
  '  ┌───┼───┐',
  '  │   │   │',
  '  ▼   │   ▼',
  '    ──┴──',
] as const

interface PaintedText {
  value: string
  color?: RGBA
  attributes?: number
}

export interface ScrollPaintResult {
  maxScroll: number
  pageSize: number
  scroll: number
}

export interface AdvancedPaintResult extends ScrollPaintResult {
  tableScroll: number
}

function drawParts(
  buffer: OptimizedBuffer,
  parts: readonly PaintedText[],
  x: number,
  y: number,
): void {
  let cursor = x
  for (const part of parts) {
    text(
      buffer,
      part.value,
      cursor,
      y,
      [...part.value].length,
      part.color ?? terminalForeground,
      terminalBackground,
      part.attributes,
    )
    cursor += [...part.value].length
  }
}

function commandParts(row: WelcomeRow, arrowVisible: boolean): PaintedText[] {
  const attributes = row.selected
    ? TextAttributes.BOLD
    : row.dim ? TextAttributes.DIM : 0
  const parts: PaintedText[] = [
    {
      value: row.selected && arrowVisible ? '> ' : '  ',
      color: row.selected ? brandGreen : terminalForeground,
    },
    {
      value: row.command,
      color: row.selected ? brandGreen : terminalForeground,
      attributes,
    },
  ]
  if (row.opensPage) {
    parts.push({
      value: nestedPageIndicator,
      color: brandGreen,
      attributes,
    })
  }
  return parts
}

function tableBorder(
  sheet: WelcomeSheet,
  left: string,
  middle: string,
  right: string,
): string {
  return left
    + '─'.repeat(sheet.commandWidth + 2)
    + middle
    + '─'.repeat(sheet.descriptionWidth + 2)
    + right
}

function drawCommandRow(
  buffer: OptimizedBuffer,
  sheet: WelcomeSheet,
  row: WelcomeRow,
  arrowVisible: boolean,
  x: number,
  y: number,
): void {
  drawParts(buffer, commandParts(row, arrowVisible), x + 2, y)
  text(
    buffer,
    row.description,
    x + sheet.commandWidth + 5,
    y,
    sheet.descriptionWidth,
    terminalForeground,
    terminalBackground,
    row.dim ? TextAttributes.DIM : 0,
  )
}

function drawTable(
  buffer: OptimizedBuffer,
  sheet: WelcomeSheet,
  rows: readonly WelcomeRow[],
  arrowVisible: boolean,
  x: number,
  y: number,
): void {
  const width = sheet.innerWidth + 2
  text(buffer, tableBorder(sheet, '┌', '┬', '┐'), x, y, width, terminalForeground, terminalBackground)
  for (const [index, rowData] of rows.entries()) {
    const row = y + index * 2 + 1
    text(
      buffer,
      `│ ${' '.repeat(sheet.commandWidth)} │ ${' '.repeat(sheet.descriptionWidth)} │`,
      x,
      row,
      width,
      terminalForeground,
      terminalBackground,
    )
    drawCommandRow(buffer, sheet, rowData, arrowVisible, x, row)
    if (index < rows.length - 1) {
      text(
        buffer,
        tableBorder(sheet, '├', '┼', '┤'),
        x,
        row + 1,
        width,
        terminalForeground,
        terminalBackground,
      )
    }
  }
  text(
    buffer,
    tableBorder(sheet, '└', '┴', '┘'),
    x,
    y + rows.length * 2,
    width,
    terminalForeground,
    terminalBackground,
  )
}

function drawContext(
  buffer: OptimizedBuffer,
  sheet: WelcomeSheet,
  model: WelcomeModel,
  x: number,
  y: number,
): void {
  const width = sheet.innerWidth + 2
  text(buffer, `┌${'─'.repeat(sheet.innerWidth)}┐`, x, y, width, terminalForeground, terminalBackground)
  text(buffer, `│${' '.repeat(sheet.innerWidth)}│`, x, y + 1, width, terminalForeground, terminalBackground)
  drawParts(buffer, [
    { value: 'project: ', attributes: TextAttributes.DIM },
    { value: model.project, color: brandGreen },
    { value: ' │ folder: ', attributes: TextAttributes.DIM },
    { value: model.folder, color: brandGreen },
    { value: ' │ status: ', attributes: TextAttributes.DIM },
    { value: model.status, color: brandGreen },
  ], x + 2, y + 1)
  text(buffer, `└${'─'.repeat(sheet.innerWidth)}┘`, x, y + 2, width, terminalForeground, terminalBackground)
}

function paintShell(
  buffer: OptimizedBuffer,
  model: WelcomeModel,
  sheet: WelcomeSheet,
): { contentY: number; width: number; x: number } {
  const width = sheet.innerWidth + 2
  const x = 2
  const y = 2
  buffer.clear(terminalBackground)

  for (const [row, line] of mark.entries()) {
    text(buffer, line, x, y + row, width, terminalForeground, terminalBackground)
  }
  drawParts(buffer, [
    { value: 'groma', attributes: TextAttributes.BOLD },
    { value: '.md', color: brandGreen, attributes: TextAttributes.BOLD },
    { value: `  v${welcomeVersion}`, attributes: TextAttributes.DIM },
  ], x + 16, y + 2)
  drawParts(buffer, [
    { value: 'architecture in Git  │  docs: ', attributes: TextAttributes.DIM },
    { value: documentationUrl, color: brandGreen },
  ], x + 16, y + 3)

  const contextY = y + mark.length + 1
  drawContext(buffer, sheet, model, x, contextY)
  return { contentY: contextY + 3, width, x }
}

function wrap(value: string, width: number): string[] {
  if (width <= 0 || value.length === 0) return []
  const lines: string[] = []
  let rest = value
  while (rest.length > width) {
    const slice = rest.slice(0, width)
    const breakAt = slice.lastIndexOf(' ')
    const length = breakAt <= 0 ? width : breakAt
    lines.push(rest.slice(0, length))
    rest = rest.slice(length).trimStart()
  }
  if (rest !== '') lines.push(rest)
  return lines
}

function formattedRows(
  value: string,
  prefix: string,
  width: number,
  attributes = 0,
): PaintedText[][] {
  const available = Math.max(1, width - prefix.length)
  return wrap(value, available).map((line, index) => [{
    value: `${index === 0 ? prefix : ' '.repeat(prefix.length)}${line}`,
    attributes,
  }])
}

function markdownLineRows(
  rawLine: string,
  width: number,
  code: boolean,
): PaintedText[][] {
  if (code) return [[{ value: rawLine, attributes: TextAttributes.DIM }]]
  if (rawLine.trim() === '') return [[]]
  const heading = rawLine.match(/^#{1,6}\s+(.+)$/)
  if (heading !== null) {
    return formattedRows(heading[1]!, '', width, TextAttributes.BOLD)
  }
  const item = rawLine.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/)
  if (item !== null) {
    const marker = item[2] === '-' || item[2] === '*' ? '•' : item[2]!
    return formattedRows(item[3]!, `${item[1]}${marker} `, width)
  }
  const indentation = rawLine.match(/^\s*/)?.[0] ?? ''
  return formattedRows(rawLine.trim(), indentation, width)
}

function markdownRows(source: string, width: number): PaintedText[][] {
  const rows: PaintedText[][] = []
  let code = false
  for (const rawLine of source.split('\n')) {
    if (rawLine.startsWith('```')) code = !code
    else if (rawLine.trim() !== '' || rows.at(-1)?.length !== 0) {
      rows.push(...markdownLineRows(rawLine, width, code))
    }
  }
  return rows
}

function drawMarkdownViewport(
  buffer: OptimizedBuffer,
  source: string,
  width: number,
  x: number,
  y: number,
  height: number,
  requestedScroll: number,
): ScrollPaintResult {
  const rows = markdownRows(source, width)
  const pageSize = Math.max(1, height)
  const maxScroll = Math.max(0, rows.length - pageSize)
  const scroll = Math.max(0, Math.min(requestedScroll, maxScroll))
  for (const line of rows.slice(scroll, scroll + pageSize)) {
    drawParts(buffer, line, x, y)
    y += 1
  }
  return { maxScroll, pageSize, scroll }
}

export function paintLauncher(
  buffer: OptimizedBuffer,
  model: WelcomeModel,
  sheet: WelcomeSheet,
  selectedIndex: number,
  arrowVisible: boolean,
): void {
  const shell = paintShell(buffer, model, sheet)
  const rows = launcherRows(selectedIndex)
  drawTable(buffer, sheet, rows, arrowVisible, shell.x, shell.contentY)
  const pluginsY = Math.max(
    shell.contentY + rows.length * 2 + 1,
    buffer.height - 2,
  )
  drawParts(buffer, [
    { value: 'plugins: ', attributes: TextAttributes.DIM },
    { value: pluginSummary(model.plugins) },
  ], shell.x + 2, pluginsY)
  text(
    buffer,
    '↑/↓ navigate  │  Enter run/open  │  Esc/Q quit',
    shell.x + 2,
    pluginsY + 1,
    shell.width - 4,
    terminalForeground,
    terminalBackground,
    TextAttributes.DIM,
  )
}

export function paintAdvanced(
  buffer: OptimizedBuffer,
  model: WelcomeModel,
  sheet: WelcomeSheet,
  selectedIndex: number,
  requestedTableScroll: number,
  requestedDescriptionScroll: number,
  arrowVisible: boolean,
  reading = false,
): AdvancedPaintResult {
  const shell = paintShell(buffer, model, sheet)
  drawParts(buffer, commandParts({
    command: '← Back',
    description: '',
    selected: selectedIndex === 0,
    dim: false,
    opensPage: false,
  }, arrowVisible), shell.x + 2, shell.contentY)
  text(
    buffer,
    'Advanced commands',
    shell.x + 2,
    shell.contentY + 2,
    shell.width - 4,
    terminalForeground,
    terminalBackground,
    TextAttributes.BOLD,
  )

  const rows = advancedRows(selectedIndex)
  const tableY = shell.contentY + 3
  const pluginsY = buffer.height - 2
  const tablePageSize = Math.min(
    5,
    rows.length,
    Math.max(1, Math.floor((pluginsY - tableY - 5) / 2)),
  )
  const maxTableScroll = Math.max(0, rows.length - tablePageSize)
  const selectedRow = selectedIndex - 1
  let tableScroll = selectedIndex === 0
    ? 0
    : Math.max(0, Math.min(requestedTableScroll, maxTableScroll))
  if (selectedRow >= 0) {
    if (selectedRow < tableScroll) tableScroll = selectedRow
    if (selectedRow >= tableScroll + tablePageSize) {
      tableScroll = selectedRow - tablePageSize + 1
    }
  }
  const visibleRows = rows.slice(tableScroll, tableScroll + tablePageSize)
  if (visibleRows.length > 0) {
    drawTable(buffer, sheet, visibleRows, arrowVisible && !reading, shell.x, tableY)
  }
  const descriptionY = tableY + visibleRows.length * 2 + 2
  const selectedCommand = advancedCommands[selectedIndex - 1]
  const descriptionPaint = drawMarkdownViewport(
    buffer,
    selectedCommand?.content ?? '',
    sheet.innerWidth - 2,
    shell.x + 2,
    descriptionY,
    pluginsY - descriptionY,
    requestedDescriptionScroll,
  )
  drawParts(buffer, [
    { value: 'plugins: ', attributes: TextAttributes.DIM },
    { value: pluginSummary(model.plugins) },
  ], shell.x + 2, pluginsY)
  text(
    buffer,
    readingFooter(reading),
    shell.x + 2,
    pluginsY + 1,
    shell.width - 4,
    terminalForeground,
    terminalBackground,
    TextAttributes.DIM,
  )
  return { ...descriptionPaint, tableScroll }
}

export function paintInstructions(
  buffer: OptimizedBuffer,
  model: WelcomeModel,
  sheet: WelcomeSheet,
  selectedIndex: number,
  guideIndex: number,
  requestedScroll: number,
  arrowVisible: boolean,
  reading = false,
): ScrollPaintResult {
  const shell = paintShell(buffer, model, sheet)
  drawParts(buffer, commandParts({
    command: '← Back',
    description: '',
    selected: selectedIndex === 0,
    dim: false,
    opensPage: false,
  }, arrowVisible), shell.x + 2, shell.contentY)

  const rows = instructionRows(selectedIndex)
  const tableY = shell.contentY + 2
  drawTable(buffer, sheet, rows, arrowVisible && !reading, shell.x, tableY)
  const contentY = tableY + rows.length * 2 + 2
  const guide = instructionViews[guideIndex] ?? instructionViews[0]!
  const contentPaint = drawMarkdownViewport(
    buffer,
    guide.content,
    sheet.innerWidth - 2,
    shell.x + 2,
    contentY,
    buffer.height - contentY - 3,
    requestedScroll,
  )
  text(
    buffer,
    readingFooter(reading),
    shell.x + 2,
    buffer.height - 2,
    shell.width - 4,
    terminalForeground,
    terminalBackground,
    TextAttributes.DIM,
  )
  return contentPaint
}

function readingFooter(reading: boolean): string {
  const focus = reading ? 'Read [↑↓/j/k] Scroll [Tab] List' : 'List [↑↓] Select [Tab] Read [j/k] Scroll'
  return `${focus} [PgUp/Dn] [Bksp] Back [Esc/q] Quit`
}
