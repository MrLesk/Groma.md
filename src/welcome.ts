import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import path from 'node:path'

import {
  createCliRenderer,
  FrameBufferRenderable,
  RGBA,
  TextAttributes,
} from '@opentui/core'
import type {
  CliRenderer,
  KeyEvent,
  OptimizedBuffer,
} from '@opentui/core'

import { text } from './viewers/tui/atoms/text.ts'

const { version } = createRequire(import.meta.url)('../package.json') as {
  version: string
}

const documentationUrl = 'https://groma.md'
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

const welcomeActions = [
  {
    id: 'web',
    command: 'groma web',
    description: 'scan and open the browser map',
  },
  {
    id: 'view',
    command: 'groma view',
    description: 'scan and open the terminal map',
  },
  {
    id: 'scan',
    command: 'groma scan',
    description: 'refresh architecture from source',
  },
  {
    id: 'help',
    command: 'groma --help',
    description: 'all commands and options',
  },
] as const

const advancedCommands = [
  {
    command: 'groma export <directory> [--watch]',
    description: 'output folder; watch refreshes',
  },
  {
    command: 'groma create <name> --kind <kind> …',
    description: 'overview + plan/observed',
  },
  {
    command: 'groma edit <id> …',
    description: 'id + change options',
  },
  {
    command: 'groma relate <from> <to> …',
    description: 'details + tech or remove',
  },
  {
    command: 'groma accept <id>',
    description: 'matched plan id',
  },
  {
    command: 'groma instructions [guide]',
    description: 'guide: overview or authoring',
  },
] as const

const advancedLabel = 'Advanced commands'
const parameterLegend = '<required> [optional] […more]'

export type WelcomeActionId = typeof welcomeActions[number]['id']

interface WelcomeModel {
  project: string
  folder: string
  status: string
}

interface WelcomeSheet {
  commandWidth: number
  descriptionWidth: number
  innerWidth: number
}

interface PaintedText {
  value: string
  color?: RGBA
  attributes?: number
}

interface WelcomeRow {
  command: string
  description: string
  selected: boolean
  dim: boolean
}

function displayFolder(repositoryRoot: string): string {
  const root = path.resolve(repositoryRoot)
  const home = homedir()
  return root === home || root.startsWith(`${home}${path.sep}`)
    ? `~${root.slice(home.length)}`
    : root
}

function welcomeModel(repositoryRoot: string): WelcomeModel {
  const root = path.resolve(repositoryRoot)
  return {
    project: path.basename(root),
    folder: displayFolder(root),
    status: 'Architecture ready',
  }
}

function welcomeSheet(model: WelcomeModel): WelcomeSheet {
  const context = ` project: ${model.project} │ folder: ${model.folder} │ status: ${model.status} `
  const commands = [
    ...welcomeActions.map(action => action.command),
    `▸ ${advancedLabel}`,
    ...advancedCommands.map(command => `  ${command.command}`),
  ]
  const descriptions = [
    ...welcomeActions.map(action => action.description),
    parameterLegend,
    ...advancedCommands.map(command => command.description),
  ]
  const commandWidth = Math.max(
    ...commands.map(command => command.length + 2),
  )
  const descriptionWidth = Math.max(
    ...descriptions.map(description => description.length),
  )
  const innerWidth = Math.max(
    context.length,
    commandWidth + descriptionWidth + 5,
  )
  return {
    commandWidth,
    descriptionWidth: innerWidth - commandWidth - 5,
    innerWidth,
  }
}

export function renderPlainWelcome(repositoryRoot: string): string {
  const model = welcomeModel(repositoryRoot)
  return [
    `groma.md v${version}`,
    'architecture in Git',
    `docs: ${documentationUrl}`,
    '',
    `project: ${model.project}`,
    `folder: ${model.folder}`,
    `status: ${model.status}`,
    '',
    ...welcomeActions.map(action => `${action.command} — ${action.description}`),
    '',
    `${advancedLabel} — ${parameterLegend}`,
    ...advancedCommands.map(command => `${command.command} — ${command.description}`),
  ].join('\n')
}

function welcomeRows(selectedIndex: number, advancedExpanded: boolean): WelcomeRow[] {
  const rows: WelcomeRow[] = welcomeActions.map((action, index) => ({
    command: action.command,
    description: action.description,
    selected: index === selectedIndex,
    dim: action.id === 'scan' || action.id === 'help',
  }))
  rows.push({
    command: `${advancedExpanded ? '▾' : '▸'} ${advancedLabel}`,
    description: parameterLegend,
    selected: selectedIndex === welcomeActions.length,
    dim: false,
  })
  if (advancedExpanded) {
    rows.push(...advancedCommands.map(command => ({
      command: `  ${command.command}`,
      description: command.description,
      selected: false,
      dim: true,
    })))
  }
  return rows
}

function commandParts(row: WelcomeRow, arrowVisible: boolean): PaintedText[] {
  const attributes = row.selected
    ? TextAttributes.BOLD
    : row.dim ? TextAttributes.DIM : 0
  return [
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

function commandBorder(
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

function drawCommands(
  buffer: OptimizedBuffer,
  sheet: WelcomeSheet,
  rows: readonly WelcomeRow[],
  arrowVisible: boolean,
  x: number,
  y: number,
): void {
  const width = sheet.innerWidth + 2
  text(buffer, commandBorder(sheet, '┌', '┬', '┐'), x, y, width, terminalForeground, terminalBackground)
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
    drawParts(buffer, commandParts(rowData, arrowVisible), x + 2, row)
    text(
      buffer,
      rowData.description,
      x + sheet.commandWidth + 5,
      row,
      sheet.descriptionWidth,
      terminalForeground,
      terminalBackground,
      rowData.dim ? TextAttributes.DIM : 0,
    )
    if (index < rows.length - 1) {
      text(
        buffer,
        commandBorder(sheet, '├', '┼', '┤'),
        x,
        row + 1,
        width,
        terminalForeground,
        terminalBackground,
      )
    }
  }
  const bottom = y + rows.length * 2
  text(buffer, commandBorder(sheet, '└', '┴', '┘'), x, bottom, width, terminalForeground, terminalBackground)
}

function paintWelcome(
  buffer: OptimizedBuffer,
  model: WelcomeModel,
  sheet: WelcomeSheet,
  selectedIndex: number,
  advancedExpanded: boolean,
  arrowVisible: boolean,
): void {
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
    { value: `  v${version}`, attributes: TextAttributes.DIM },
  ], x + 16, y + 2)
  drawParts(buffer, [
    { value: 'architecture in Git  │  docs: ', attributes: TextAttributes.DIM },
    { value: documentationUrl, color: brandGreen },
  ], x + 16, y + 3)

  const contextY = y + mark.length + 1
  drawContext(buffer, sheet, model, x, contextY)
  const commandsY = contextY + 4
  const rows = welcomeRows(selectedIndex, advancedExpanded)
  drawCommands(
    buffer,
    sheet,
    rows,
    arrowVisible,
    x,
    commandsY,
  )
  text(
    buffer,
    '↑/↓ navigate  │  Enter run/toggle  │  Esc/Q quit',
    x + 2,
    commandsY + rows.length * 2 + 2,
    width - 4,
    terminalForeground,
    terminalBackground,
    TextAttributes.DIM,
  )
}

export function mountWelcomeLauncher(
  renderer: CliRenderer,
  repositoryRoot: string,
): Promise<WelcomeActionId | undefined> {
  const model = welcomeModel(repositoryRoot)
  const sheet = welcomeSheet(model)
  let selectedIndex = 0
  let advancedExpanded = false
  let arrowVisible = true
  let closed = false
  let resolveSelected!: (selection: WelcomeActionId | undefined) => void
  const selected = new Promise<WelcomeActionId | undefined>(resolve => {
    resolveSelected = resolve
  })
  const frame = new FrameBufferRenderable(renderer, {
    id: 'groma-welcome',
    width: Math.max(1, renderer.width),
    height: Math.max(1, renderer.height),
    onSizeChange() {
      repaint()
    },
  })
  frame.width = '100%'
  frame.height = '100%'
  renderer.root.add(frame)

  function repaint(): void {
    if (closed || frame.isDestroyed) return
    paintWelcome(
      frame.frameBuffer,
      model,
      sheet,
      selectedIndex,
      advancedExpanded,
      arrowVisible,
    )
    frame.requestRender()
  }

  const blinkTimer = setInterval(() => {
    arrowVisible = !arrowVisible
    repaint()
  }, 500)

  function close(selection: WelcomeActionId | undefined): void {
    if (closed) return
    closed = true
    clearInterval(blinkTimer)
    renderer.keyInput.off('keypress', onKeypress)
    renderer.off('destroy', onRendererDestroy)
    if (!renderer.isDestroyed) renderer.destroy()
    resolveSelected(selection)
  }

  function onRendererDestroy(): void {
    close(undefined)
  }

  function moveSelection(key: 'up' | 'down'): void {
    const movement = key === 'up' ? -1 : 1
    selectedIndex = Math.max(
      0,
      Math.min(welcomeActions.length, selectedIndex + movement),
    )
    arrowVisible = true
    repaint()
  }

  function onKeypress(key: KeyEvent): void {
    if (key.eventType === 'release') return
    if (
      (key.ctrl && key.name === 'c')
      || key.name === 'escape'
      || key.name === 'q'
    ) {
      close(undefined)
      return
    }
    if (key.name === 'up' || key.name === 'down') {
      moveSelection(key.name)
      return
    }
    if (key.name === 'return') {
      if (selectedIndex === welcomeActions.length) {
        advancedExpanded = !advancedExpanded
        arrowVisible = true
        repaint()
        return
      }
      close(welcomeActions[selectedIndex]!.id)
    }
  }

  renderer.keyInput.on('keypress', onKeypress)
  renderer.once('destroy', onRendererDestroy)
  repaint()

  return selected
}

export async function startWelcomeLauncher(
  repositoryRoot: string,
): Promise<WelcomeActionId | undefined> {
  const renderer = await createCliRenderer({
    clearOnShutdown: true,
    consoleMode: 'disabled',
    exitOnCtrlC: false,
    screenMode: 'alternate-screen',
    useMouse: false,
  })
  try {
    return await mountWelcomeLauncher(renderer, repositoryRoot)
  } catch (error) {
    renderer.destroy()
    throw error
  }
}
