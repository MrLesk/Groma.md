import { realpath } from 'node:fs/promises'

import { loadArchitecture } from './architecture-reader.ts'
import { createClackInitUi } from './init-command-ui.ts'
import {
  initializeGroma,
  gromaInitialization,
  type GromaInitPrompts,
} from './initialize.ts'
import { formatScanSummary, scanRepository } from './scanner.ts'
import { NOT_INITIALIZED, type GromaDirectory } from './groma-filesystem.ts'
import { c4Kind } from './okf-profile.ts'

export type InitViewer = 'web' | 'view'
export type PackageInstaller = 'brew' | 'bun' | 'npm'

export interface InitCommandInput {
  directory?: string
  interactive: boolean
  projectName?: string
  repositoryRoot: string
  /** The caller scans and opens a viewer afterwards, so the wizard skips its scan and viewer questions. */
  opensViewer?: boolean
}

export interface InitCommandUi {
  cancel(message: string): void
  confirmBacklogInstall(): Promise<boolean | undefined>
  confirmInit(): Promise<boolean | undefined>
  confirmScan(): Promise<boolean | undefined>
  directory(): Promise<GromaDirectory | undefined>
  error(message: string): void
  install(message: string, operation: () => Promise<boolean>): Promise<boolean>
  installer(): Promise<PackageInstaller | undefined>
  intro(): Promise<void> | void
  note(message: string, title: string): void
  outro(message: string): void
  projectName(current?: string): Promise<string | undefined>
  viewer(): Promise<InitViewer | 'finish' | undefined>
}

export interface InitCommandDependencies {
  backlogAvailable(): boolean
  error(message: string): void
  executablePath(): Promise<string>
  install(installer: PackageInstaller): Promise<boolean>
  output(message: string): void
  scan(repositoryRoot: string): ReturnType<typeof scanRepository>
  ui: InitCommandUi
}

export interface InitCommandActions {
  openViewer(viewer: InitViewer): Promise<void>
}

class InitializationCancelled extends Error {}

const clackUi = createClackInitUi()

function installationCommand(installer: PackageInstaller): string[] {
  if (installer === 'brew') return ['brew', 'install', 'backlog-md']
  if (installer === 'npm') return ['npm', 'install', '--global', 'backlog.md']
  return ['bun', 'add', '--global', 'backlog.md']
}

export function inferPackageInstaller(executablePath: string): PackageInstaller | undefined {
  const normalized = executablePath.replaceAll('\\', '/').toLowerCase()
  if (normalized.includes('/.bun/install/global/')) return 'bun'
  if (normalized.includes('/cellar/') || normalized.includes('/homebrew/')) return 'brew'
  if (normalized.includes('/node_modules/')) return 'npm'
  return undefined
}

async function currentExecutablePath(): Promise<string> {
  const filename = process.argv[1]
  if (filename === undefined) return ''
  return realpath(filename).catch(() => filename)
}

async function installBacklog(installer: PackageInstaller): Promise<boolean> {
  try {
    const child = Bun.spawn(installationCommand(installer), {
      stdin: 'ignore',
      stdout: 'ignore',
      stderr: 'ignore',
    })
    return await child.exited === 0
  } catch {
    return false
  }
}

const defaultDependencies: InitCommandDependencies = {
  backlogAvailable: () => Bun.which('backlog') !== null,
  error: message => console.error(message),
  executablePath: currentExecutablePath,
  install: installBacklog,
  output: message => console.log(message),
  scan: scanRepository,
  ui: clackUi,
}

function cancelled(): never {
  throw new InitializationCancelled()
}

function interactivePrompts(ui: InitCommandUi): GromaInitPrompts {
  return {
    projectName: async current => await ui.projectName(current) ?? cancelled(),
    directory: async () => await ui.directory() ?? cancelled(),
  }
}

function settingsSummary(projectName: string, directory: GromaDirectory): string {
  return `Project: ${projectName}\nGroma folder: ${directory}/`
}

function commandReminder(ui: InitCommandUi): void {
  ui.note(
    'Run groma web for the browser map.\nRun groma view for the terminal map.',
    'Open Groma later',
  )
}

async function offerBacklog(
  dependencies: InitCommandDependencies,
): Promise<void> {
  if (dependencies.backlogAvailable()) return
  const wanted = await dependencies.ui.confirmBacklogInstall()
  if (wanted === undefined) cancelled()
  if (!wanted) return
  const inferred = inferPackageInstaller(await dependencies.executablePath())
  const installer = inferred ?? await dependencies.ui.installer()
  if (installer === undefined) cancelled()
  const command = installationCommand(installer)
  const installed = await dependencies.ui.install(
    `Installing Backlog.md with ${installer}`,
    () => dependencies.install(installer),
  )
  if (!installed) {
    dependencies.ui.error(
      `Could not run ${command.join(' ')}. Groma setup will continue.`,
    )
  }
}

function completionMessage(
  status: 'initialized' | 'unchanged' | 'updated',
  projectName: string,
): string {
  if (status === 'unchanged') return 'Groma settings unchanged'
  const verb = status === 'updated' ? 'Updated' : 'Initialized'
  return `${verb} Groma project: ${projectName}`
}

/** The first scan and the choice of viewer; a caller that scans and opens a viewer itself skips both. */
async function offerFirstScan(
  input: InitCommandInput,
  dependencies: InitCommandDependencies,
  actions: InitCommandActions,
  completed: string,
): Promise<void> {
  const ui = dependencies.ui
  if (input.opensViewer) {
    ui.outro(completed)
    return
  }
  const runScan = await ui.confirmScan()
  if (runScan === undefined) cancelled()
  if (!runScan) {
    commandReminder(ui)
    ui.outro(completed)
    return
  }
  const summary = await dependencies.scan(input.repositoryRoot)
  ui.note(formatScanSummary(summary), 'First scan complete')
  const viewer = await ui.viewer()
  if (viewer === undefined) cancelled()
  commandReminder(ui)
  ui.outro(completed)
  if (viewer !== 'finish') await actions.openViewer(viewer)
}

async function hasObservedComponents(repositoryRoot: string): Promise<boolean> {
  const records = await loadArchitecture(repositoryRoot)
  return records.documents.some(document => {
    return c4Kind(document.frontmatter.type) === 'component'
      && document.frontmatter.status === 'stable'
  })
}

export async function runInitCommand(
  input: InitCommandInput,
  actions: InitCommandActions,
  overrides: Partial<InitCommandDependencies> = {},
): Promise<'cancelled' | 'completed'> {
  const dependencies = { ...defaultDependencies, ...overrides }
  const ui = dependencies.ui
  try {
    if (input.interactive) await ui.intro()
    const result = await initializeGroma(
      input.repositoryRoot,
      { projectName: input.projectName, directory: input.directory },
      input.interactive ? interactivePrompts(ui) : undefined,
    )
    const completed = completionMessage(result.status, result.projectName)
    if (!input.interactive) {
      dependencies.output(completed)
      dependencies.output(`Groma folder: ${result.directory}/`)
      return 'completed'
    }

    ui.note(settingsSummary(result.projectName, result.directory), 'Groma settings')
    await offerBacklog(dependencies)
    if (result.status !== 'initialized' && await hasObservedComponents(input.repositoryRoot)) {
      ui.outro(completed)
      return 'completed'
    }
    await offerFirstScan(input, dependencies, actions, completed)
    return 'completed'
  } catch (error) {
    if (!(error instanceof InitializationCancelled)) throw error
    if (input.interactive) ui.cancel('Initialization cancelled.')
    return 'cancelled'
  }
}

export type FirstRunOutcome = 'ready' | 'declined' | 'missing' | 'cancelled'

/**
 * The terminal viewer's setup entry. Nothing to do when the project records exist;
 * one sentence and a failure without a TTY; on a TTY, the offer to run the init wizard.
 */
export async function ensureInitialized(
  input: InitCommandInput,
  overrides: Partial<InitCommandDependencies> = {},
): Promise<FirstRunOutcome> {
  if (gromaInitialization(input.repositoryRoot).initialized) return 'ready'
  const dependencies = { ...defaultDependencies, ...overrides }
  if (!input.interactive) {
    dependencies.error(NOT_INITIALIZED)
    return 'missing'
  }
  const wanted = await dependencies.ui.confirmInit()
  if (wanted === undefined) {
    dependencies.ui.cancel('Initialization cancelled.')
    return 'cancelled'
  }
  if (!wanted) {
    dependencies.output('Run groma init when you are ready.')
    return 'declined'
  }
  const outcome = await runInitCommand(input, { openViewer: async () => undefined }, overrides)
  return outcome === 'completed' ? 'ready' : 'cancelled'
}
