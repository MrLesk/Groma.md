import type {
  InitCommandDependencies,
  InitCommandUi,
  InitViewer,
} from '../src/init-command.ts'

export interface UiAnswers {
  backlogInstall?: boolean | null
  init?: boolean | null
  directory?: 'groma' | '.groma' | null
  installer?: 'bun' | 'npm' | 'brew' | null
  projectName?: string | null
  scan?: boolean | null
  viewer?: InitViewer | 'finish' | null
}

export function initUi(answers: UiAnswers = {}) {
  const events: string[] = []
  const ui: InitCommandUi = {
    cancel: () => undefined,
    confirmBacklogInstall: async () => {
      events.push('ask:backlog')
      return answers.backlogInstall === null
        ? undefined
        : answers.backlogInstall ?? false
    },
    confirmInit: async () => {
      events.push('ask:init')
      return answers.init === null ? undefined : answers.init ?? false
    },
    confirmScan: async () => {
      events.push('ask:scan')
      return answers.scan === null ? undefined : answers.scan ?? false
    },
    directory: async () => {
      events.push('ask:directory')
      return answers.directory === null
        ? undefined
        : answers.directory ?? 'groma'
    },
    error: () => undefined,
    install: async (_, operation) => operation(),
    installer: async () => {
      events.push('ask:installer')
      return answers.installer === null
        ? undefined
        : answers.installer ?? 'bun'
    },
    intro: () => undefined,
    note: () => undefined,
    outro: () => undefined,
    projectName: async current => {
      events.push(`ask:name:${current ?? ''}`)
      return answers.projectName === null
        ? undefined
        : answers.projectName ?? current ?? 'Test project'
    },
    viewer: async () => {
      events.push('ask:viewer')
      return answers.viewer === null
        ? undefined
        : answers.viewer ?? 'finish'
    },
  }
  return { events, ui }
}

export function initDependencies(
  ui: InitCommandUi,
  overrides: Partial<InitCommandDependencies> = {},
): Partial<InitCommandDependencies> {
  return {
    backlogAvailable: () => true,
    executablePath: async () => '/usr/local/lib/node_modules/groma/src/cli.ts',
    install: async () => true,
    output: () => undefined,
    scan: async () => ({ created: 0, refreshed: 0, matched: 0 }),
    ui,
    ...overrides,
  }
}
