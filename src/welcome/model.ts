import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import path from 'node:path'

import { humanInstructionGuides } from '../instructions.ts'
import { scannerInventory } from '../scanner/modules/inventory.ts'
import type { ScannerReadiness } from '../scanner/modules/inventory.ts'

const { version } = createRequire(import.meta.url)('../../package.json') as {
  version: string
}

export const documentationUrl = 'https://groma.md'
export const welcomeVersion = version

export const welcomeActions = [
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
] as const

export const instructionsAction = {
  command: 'groma instructions',
  description: 'read how Groma works',
} as const

export const advancedCommands = [
  {
    command: 'groma export <directory> [--watch]',
    description: 'output folder; watch refreshes',
  },
  {
    command: 'groma scanner add <source>',
    description: 'exact package@version or ./path',
  },
  {
    command: 'groma scanner install',
    description: 'restore configured npm scanners',
  },
  {
    command: 'groma scanner list',
    description: 'show built-in/found/missing',
  },
  {
    command: 'groma scanner remove <id>',
    description: 'disable; keep shared cache',
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
    command: 'groma agent-instructions [guide]',
    description: 'guide: curation',
  },
] as const

export const instructionsIndex = welcomeActions.length
export const advancedIndex = instructionsIndex + 1

const advancedLabel = 'Advanced commands'
const parameterLegend = '<required> [optional] […more]'

export type WelcomeActionId = typeof welcomeActions[number]['id']

export interface WelcomeScanner {
  id: string
  status: ScannerReadiness
}

export interface WelcomeModel {
  project: string
  folder: string
  status: string
  scanners: readonly WelcomeScanner[]
}

export interface WelcomeSheet {
  commandWidth: number
  descriptionWidth: number
  innerWidth: number
}

export interface WelcomeRow {
  command: string
  description: string
  selected: boolean
  dim: boolean
}

export interface InstructionView {
  title: string
  description: string
  content: string
}

export const instructionViews: InstructionView[] = humanInstructionGuides.map(guide => ({
  title: guide.title,
  description: guide.description,
  content: guide.content,
}))

function displayFolder(repositoryRoot: string): string {
  const root = path.resolve(repositoryRoot)
  const home = homedir()
  return root === home || root.startsWith(`${home}${path.sep}`)
    ? `~${root.slice(home.length)}`
    : root
}

export async function loadWelcomeModel(repositoryRoot: string): Promise<WelcomeModel> {
  const root = path.resolve(repositoryRoot)
  const scanners = await scannerInventory(root)
  return {
    project: path.basename(root),
    folder: displayFolder(root),
    status: 'Architecture ready',
    scanners: scanners.map(({ id, status }) => ({ id, status })),
  }
}

export function pluginSummary(scanners: readonly WelcomeScanner[]): string {
  const scannerText = scanners.map(scanner => `${scanner.id}: ${scanner.status}`).join(' │ ')
  return `backlog: built-in │ ${scannerText}`
}

export function welcomeSheet(model: WelcomeModel): WelcomeSheet {
  const context = ` project: ${model.project} │ folder: ${model.folder} │ status: ${model.status} `
  const commands = [
    ...welcomeActions.map(action => action.command),
    instructionsAction.command,
    `▸ ${advancedLabel}`,
    ...advancedCommands.map(command => `  ${command.command}`),
    ...instructionViews.map(guide => guide.title),
  ]
  const descriptions = [
    ...welcomeActions.map(action => action.description),
    instructionsAction.description,
    parameterLegend,
    ...advancedCommands.map(command => command.description),
    ...instructionViews.map(guide => guide.description),
  ]
  const commandWidth = Math.max(...commands.map(command => command.length + 2))
  const descriptionWidth = Math.max(...descriptions.map(description => description.length))
  const innerWidth = Math.max(context.length, commandWidth + descriptionWidth + 5)
  return {
    commandWidth,
    descriptionWidth: innerWidth - commandWidth - 5,
    innerWidth,
  }
}

export async function renderPlainWelcome(repositoryRoot: string): Promise<string> {
  const model = await loadWelcomeModel(repositoryRoot)
  return [
    `groma.md v${welcomeVersion}`,
    'architecture in Git',
    `docs: ${documentationUrl}`,
    '',
    `project: ${model.project}`,
    `folder: ${model.folder}`,
    `status: ${model.status}`,
    `plugins: ${pluginSummary(model.scanners)}`,
    '',
    ...welcomeActions.map(action => `${action.command} — ${action.description}`),
    `${instructionsAction.command} — ${instructionsAction.description}`,
    '',
    `${advancedLabel} — ${parameterLegend}`,
    ...advancedCommands.map(command => `${command.command} — ${command.description}`),
  ].join('\n')
}

export function launcherRows(selectedIndex: number, advancedExpanded: boolean): WelcomeRow[] {
  const rows: WelcomeRow[] = welcomeActions.map((action, index) => ({
    command: action.command,
    description: action.description,
    selected: index === selectedIndex,
    dim: action.id === 'scan',
  }))
  rows.push({
    ...instructionsAction,
    selected: selectedIndex === instructionsIndex,
    dim: false,
  }, {
    command: `${advancedExpanded ? '▾' : '▸'} ${advancedLabel}`,
    description: parameterLegend,
    selected: selectedIndex === advancedIndex,
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

export function instructionRows(selectedIndex: number): WelcomeRow[] {
  return instructionViews.map((guide, index) => ({
    command: guide.title,
    description: guide.description,
    selected: selectedIndex === index + 1,
    dim: false,
  }))
}
