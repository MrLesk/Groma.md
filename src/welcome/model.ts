import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import path from 'node:path'

import type { WorkSourcePlugin } from '@groma/work-source'
import { backlogPlugin } from '@groma/work-source-backlog'

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
    content: 'Writes the current architecture to <directory>. Add --watch to refresh that output after source changes.',
  },
  {
    command: 'groma scanner add <source>',
    description: 'exact package@version or ./path',
    content: 'Adds a scanner from an exact npm package version or a local directory to this project.',
  },
  {
    command: 'groma scanner install',
    description: 'restore configured npm scanners',
    content: 'Installs the exact npm scanner versions already configured for this project. Built-in and local scanners need no installation.',
  },
  {
    command: 'groma scanner list',
    description: 'show built-in/found/missing',
    content: 'Lists every configured scanner and whether it is built-in, ready, or missing.',
  },
  {
    command: 'groma scanner remove <id>',
    description: 'disable; keep shared cache',
    content: 'Removes a scanner from this project. Shared downloaded packages remain cached for other projects.',
  },
  {
    command: 'groma add <thing> <name> …',
    description: 'actor, external, draft, relation, group',
    content: [
      'Declares a person, an external system, or a draft record with its overview, a relation from one id to another, or a group of sibling components.',
      'The scanner never sees those; scanned software is drafted instead.',
    ].join('\n'),
  },
  {
    command: 'groma draft <kind> <name> …',
    description: 'kind, overview, optional draft',
    content: [
      'Drafts a system, container, or component as a ghost at the path it will keep.',
      'Use --draft <id> to file it under a draft record.',
      'Containers and components require --parent.',
    ].join('\n'),
  },
  {
    command: 'groma edit <id> …',
    description: 'id + change options',
    content: 'Changes an element, a draft record, or the project record by id: rename, describe, set technology, tag with a draft, or curate scanned structure.',
  },
  {
    command: 'groma remove <id>',
    description: 'person, external, ghost, draft, relation, group',
    content: 'Removes a person, an external system, a ghost, a draft no ghost belongs to, a relation, or a group. Scanned software stays.',
  },
  {
    command: 'groma accept <id>',
    description: 'matched draft id',
    content: 'Accepts a drafted element only after a scan has matched that id.',
  },
  {
    command: 'groma agent-instructions [guide]',
    description: 'guide: curation',
    content: [
      'Prints a Markdown guide for coding agents.',
      'Pass [guide] to choose one.',
      'The default guide is curation.',
      'This command always stays plain text.',
    ].join('\n'),
  },
] as const

export const instructionsIndex = welcomeActions.length
export const advancedIndex = instructionsIndex + 1

const advancedLabel = 'Advanced commands'
const parameterLegend = '<required> [optional] […more]'
export const nestedPageIndicator = ' ›'

export type WelcomeActionId = typeof welcomeActions[number]['id']

export interface WelcomePlugin {
  id: string
  status: ScannerReadiness
  install?: string
}

export interface WelcomeModel {
  project: string
  folder: string
  status: string
  plugins: readonly WelcomePlugin[]
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
  opensPage: boolean
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

export async function loadWelcomeModel(
  repositoryRoot: string,
  workSourcePlugin: WorkSourcePlugin = backlogPlugin,
): Promise<WelcomeModel> {
  const root = path.resolve(repositoryRoot)
  const scanners = await scannerInventory(root)
  const workSource = workSourcePlugin.readiness()
  return {
    project: path.basename(root),
    folder: displayFolder(root),
    status: 'Architecture ready',
    plugins: [
      { id: workSourcePlugin.id, ...workSource },
      ...scanners.map(({ id, status }) => ({ id, status })),
    ],
  }
}

export function pluginSummary(plugins: readonly WelcomePlugin[]): string {
  return plugins.map(plugin => {
    const install = plugin.install === undefined ? '' : ` (${plugin.install})`
    const status = plugin.status === 'found' ? '✓ ready' : plugin.status
    return `${plugin.id}: ${status}${install}`
  }).join(' │ ')
}

export function welcomeSheet(model: WelcomeModel): WelcomeSheet {
  const context = ` project: ${model.project} │ folder: ${model.folder} │ status: ${model.status} `
  const rows = [
    ...launcherRows(0),
    ...advancedRows(),
    ...instructionRows(0),
  ]
  const commands = rows.map(row => (
    `${row.command}${row.opensPage ? nestedPageIndicator : ''}`
  ))
  const descriptions = rows.map(row => row.description)
  const commandWidth = Math.max(...commands.map(command => command.length + 2))
  const descriptionWidth = Math.max(...descriptions.map(description => description.length))
  const innerWidth = Math.max(context.length, commandWidth + descriptionWidth + 5)
  return {
    commandWidth,
    descriptionWidth: innerWidth - commandWidth - 5,
    innerWidth,
  }
}

export async function renderPlainWelcome(
  repositoryRoot: string,
  workSourcePlugin: WorkSourcePlugin = backlogPlugin,
): Promise<string> {
  const model = await loadWelcomeModel(repositoryRoot, workSourcePlugin)
  return [
    `groma.md v${welcomeVersion}`,
    'architecture in Git',
    `docs: ${documentationUrl}`,
    '',
    `project: ${model.project}`,
    `folder: ${model.folder}`,
    `status: ${model.status}`,
    `plugins: ${pluginSummary(model.plugins)}`,
    '',
    ...welcomeActions.map(action => `${action.command} — ${action.description}`),
    `${instructionsAction.command} — ${instructionsAction.description}`,
    '',
    `${advancedLabel} — ${parameterLegend}`,
    ...advancedCommands.map(command => `${command.command} — ${command.description}`),
  ].join('\n')
}

export function launcherRows(selectedIndex: number): WelcomeRow[] {
  const rows: WelcomeRow[] = welcomeActions.map((action, index) => ({
    command: action.command,
    description: action.description,
    selected: index === selectedIndex,
    dim: false,
    opensPage: false,
  }))
  rows.push({
    ...instructionsAction,
    selected: selectedIndex === instructionsIndex,
    dim: false,
    opensPage: true,
  }, {
    command: advancedLabel,
    description: parameterLegend,
    selected: selectedIndex === advancedIndex,
    dim: false,
    opensPage: true,
  })
  return rows
}

export function advancedRows(selectedIndex = 0): WelcomeRow[] {
  return advancedCommands.map((command, index) => ({
    command: command.command,
    description: command.description,
    selected: selectedIndex === index + 1,
    dim: false,
    opensPage: false,
  }))
}

export function instructionRows(selectedIndex: number): WelcomeRow[] {
  return instructionViews.map((guide, index) => ({
    command: guide.title,
    description: guide.description,
    selected: selectedIndex === index + 1,
    dim: false,
    opensPage: false,
  }))
}
