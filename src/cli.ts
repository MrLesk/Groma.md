#!/usr/bin/env bun

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Command, Option } from 'commander'
import { confirm } from '@clack/prompts'
import packageJson from '../package.json' with { type: 'json' }

import { agentGuideNames, readAgentGuide } from './agent-instructions.ts'
import { ensureInitialized, runInitCommand } from './init-command.ts'
import { humanInstructionGuide } from './instructions.ts'
import { listWindowRequested, parseListWindow, withListWindowOptions, type ListWindow } from './list-window.ts'
import { registerLintCommand } from './lint-command.ts'
import { registerScannerCommands } from './scanner/cli.ts'
import { formatScanReport, scanRepository, watchScan } from './scanner.ts'
import { renderPlainWelcome, startWelcome } from './welcome.ts'
import { registerWriteCommands } from './write-commands.ts'
import type { WelcomeActionId, WelcomeScreen } from './welcome.ts'

const program = new Command()

function interactiveTerminal(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true
}

/** Ends a long-running command on Ctrl-C or SIGTERM once it has released what it holds. */
function stopOnSignal(close: () => Promise<void>): void {
  const stop = () => {
    process.off('SIGINT', stop)
    process.off('SIGTERM', stop)
    void close().then(() => process.exit())
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
}

async function startWebOnNextPort(port: number, scan: boolean, onListening: (url: string) => void) {
  const { startWebViewer } = await import('./viewers/web/server.ts')
  while (true) {
    try {
      return await startWebViewer(process.cwd(), { port: ++port, scan, onListening })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw error
    }
  }
}

async function openWeb(port?: number, scan = true): Promise<void> {
  try {
    const { startWebViewer } = await import('./viewers/web/server.ts')
    const onListening = (url: string) => console.log(`groma web at ${url}`)
    let viewer: { close: () => Promise<void> }
    try {
      viewer = await startWebViewer(process.cwd(), { port, scan, onListening })
    } catch (error) {
      if (port === 0 || (error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw error
      const message = error instanceof Error ? error.message : String(error)
      if (!interactiveTerminal()) throw new Error(`${message} Run groma web --port 0 to use an available port.`)
      const accepted = await confirm({
        message: `${message} Use the next available port? (y/n)`,
        initialValue: false,
      })
      if (accepted !== true) return
      viewer = await startWebOnNextPort(port ?? 4747, scan, onListening)
    }
    stopOnSignal(() => viewer.close())
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

async function openTerminalMap(scan = true): Promise<void> {
  const root = process.cwd()
  const { startTerminalViewer } = await import('./view-host.ts')
  const viewer = await startTerminalViewer(root, { scan })
  await viewer.closed
}

async function continueWhenReady(interactive: boolean): Promise<boolean> {
  const door = await ensureInitialized({
    repositoryRoot: process.cwd(), interactive, opensViewer: true,
  })
  if (door !== 'ready' && door !== 'declined') process.exitCode = 1
  return door === 'ready'
}

async function openTerminalView(target: string | undefined, plain: boolean, window: ListWindow): Promise<void> {
  if (!await continueWhenReady(interactiveTerminal() && target === undefined && !plain)) return
  if (target) {
    const { renderPlainRecord } = await import('./plain-world.ts')
    const result = await renderPlainRecord(process.cwd(), target, plain, window)
    if (!result.ok) {
      console.error(result.message)
      process.exitCode = 1
      return
    }
    process.stdout.write(result.text)
  } else if (plain || !process.stdout.isTTY) {
    const { renderPlainWorld } = await import('./plain-world.ts')
    console.log(await renderPlainWorld(process.cwd(), window))
  } else {
    await openTerminalMap()
  }
}

async function openTerminalFromWelcome(...command: string[]): Promise<void> {
  const entry = Bun.isStandaloneExecutable ? [] : [fileURLToPath(import.meta.url)]
  const child = Bun.spawn([process.execPath, ...entry, ...command], {
    cwd: process.cwd(),
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const exitCode = await child.exited
  if (exitCode !== 0) process.exitCode = exitCode
}

async function initializeProject(
  projectName: string | undefined,
  directory: string | undefined,
): Promise<void> {
  try {
    const outcome = await runInitCommand({
      repositoryRoot: process.cwd(),
      projectName,
      directory,
      interactive: interactiveTerminal(),
    }, {
      openViewer: viewer => viewer === 'web'
        ? openWeb(undefined, false)
        : openTerminalMap(false),
    })
    if (outcome === 'cancelled') process.exitCode = 1
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

async function exportWeb(directory: string): Promise<void> {
  const root = process.cwd()
  const { exportWebViewer } = await import('./viewers/web/export.ts')
  const exported = await exportWebViewer(root, directory)
  console.log(`groma export at ${path.resolve(directory)}`)
  await exported.close()
}

async function scanOnce(): Promise<void> {
  const root = process.cwd()
  const summary = await scanRepository(root)
  console.log('ok')
  console.log(formatScanReport(root, summary))
}

async function runScan(watchEnabled: boolean): Promise<void> {
  if (!watchEnabled) return scanOnce()
  const root = process.cwd()
  const session = await watchScan(root, {
    onFold: summary => {
      console.log('ok')
      console.log(formatScanReport(root, summary))
    },
    onError: error => {
      console.error(error instanceof Error ? error.message : String(error))
    },
  })
  stopOnSignal(() => session.close())
}

function unhandledWelcomeAction(action: never): never {
  throw new Error(`unhandled welcome action: ${action}`)
}

async function runWelcomeAction(action: WelcomeActionId): Promise<void> {
  switch (action) {
    case 'web': return openWeb()
    case 'view': return openTerminalFromWelcome('view')
    case 'scan': return scanOnce()
    case 'scanners': return openTerminalFromWelcome('scanner', 'settings')
    default: return unhandledWelcomeAction(action)
  }
}

async function runInteractiveWelcome(screen: WelcomeScreen = 'launcher'): Promise<void> {
  if (!await continueWhenReady(true)) return
  const lifecycle = setInterval(() => {}, 1000)
  try {
    let reopen = true
    while (reopen) {
      const session = await startWelcome(process.cwd(), screen)
      try {
        if (session.selection !== undefined) await runWelcomeAction(session.selection)
      } finally { session.close() }
      reopen = session.selection === 'scanners'
    }
  } finally {
    clearInterval(lifecycle)
  }
}

program
  .name('groma')
  .version(packageJson.version)
  .description("This repo's architecture in Git")
  .option('--plain', 'print as plain text')
  .action(async () => {
    const interactive = process.stdin.isTTY === true
      && process.stdout.isTTY === true
      && !program.opts().plain
    if (!interactive) {
      if (!await continueWhenReady(false)) return
      console.log(await renderPlainWelcome(process.cwd()))
      return
    }
    await runInteractiveWelcome()
  })

program
  .command('init')
  .description('Initialize this repository for Groma')
  .argument('[project-name]', 'project name')
  .option('--directory <directory>', 'groma or .groma')
  .action(async (projectName: string | undefined, options) => {
    await initializeProject(projectName, options.directory)
  })

program
  .command('web')
  .description('Scan this repo and open the browser map')
  .option('--port <number>', 'port to listen on', Number)
  .action(async options => {
    await openWeb(options.port)
  })

program
  .command('export')
  .description('Export the browser map as a read-only static site')
  .argument('<directory>', 'output directory')
  .addOption(new Option('--watch').hideHelp())
  .on('option:watch', () => {
    console.log('Coming soon.')
    process.exit(0)
  })
  .action(async (directory: string) => {
    await exportWeb(directory)
  })

withListWindowOptions(program
  .command('view')
  .description('Scan this repo and open the terminal map')
  .argument('[target]', 'element or flow id for complete Markdown, draft id, or exact source file for its owner and file relationships')
  .option('--plain', 'print actors, systems, their relationships and flows; with an element id, that element, its children, and its incoming and outgoing relationships'))
  .action(async (target: string | undefined, options) => {
    try {
      // A window pages the plain answers; with a record target, --plain alone chooses them over its Markdown.
      const plain = Boolean(program.opts().plain || options.plain)
        || (target === undefined && listWindowRequested(options))
      await openTerminalView(target, plain, parseListWindow(options, process.argv.slice(2)))
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    }
  })

program
  .command('scan')
  .description('Scan this repo and fold findings into Markdown')
  .option('--watch', 'scan again when supported source changes')
  .action(async options => {
    try {
      await runScan(options.watch === true)
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    }
  })

registerScannerCommands(program)
registerLintCommand(program)
registerWriteCommands(program)

program
  .command('instructions')
  .description('Open or print a shipped human guide')
  .argument('[guide]', 'overview or authoring')
  .action(async (guide: string | undefined) => {
    const selected = humanInstructionGuide(guide)
    if (selected === undefined) {
      console.error(`unknown guide: ${guide}`)
      process.exitCode = 1
      return
    }
    const interactive = guide === undefined
      && process.stdin.isTTY === true
      && process.stdout.isTTY === true
      && !program.opts().plain
    if (!interactive) {
      console.log(selected.content)
      return
    }
    await runInteractiveWelcome('instructions')
  })

program
  .command('agent-instructions')
  .description('Print the agent guide index, or one named guide')
  .argument('[guide]', agentGuideNames.join(', '))
  .action(async (guide: string | undefined) => {
    const selected = await readAgentGuide(guide)
    if (selected === undefined) {
      console.error(`unknown agent guide: ${guide}`)
      process.exitCode = 1
      return
    }
    console.log(selected)
  })

await program.parseAsync()
