#!/usr/bin/env bun

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Command } from 'commander'

import { acceptGhost } from './core.ts'
import { draftElement } from './draft.ts'
import { editArchitecture } from './edit.ts'
import { agentInstructionGuide } from './agent-instructions.ts'
import { runInitCommand } from './init-command.ts'
import { humanInstructionGuide } from './instructions.ts'
import { relateElements, removeRelationship } from './relate.ts'
import { registerScannerCommands } from './scanner/cli.ts'
import { formatScanSummary, scanRepository, watchScan } from './scanner.ts'
import {
  renderPlainWelcome,
  startWelcome,
} from './welcome.ts'
import type { WelcomeActionId, WelcomeScreen } from './welcome.ts'

const program = new Command()

async function openWeb(port?: number, scan = true): Promise<void> {
  const root = process.cwd()
  if (scan) await scanRepository(root)
  const { startWebViewer } = await import('./viewers/web/server.ts')
  const { url } = await startWebViewer(root, { port })
  console.log(`groma web at ${url}`)
}

async function openTerminalMap(scan = true): Promise<void> {
  const root = process.cwd()
  if (scan) await scanRepository(root)
  const { startTerminalViewer } = await import('./view-host.ts')
  const viewer = await startTerminalViewer(root)
  await viewer.closed
}

async function openTerminalMapFromWelcome(): Promise<void> {
  const child = Bun.spawn([process.execPath, fileURLToPath(import.meta.url), 'view'], {
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
      interactive: process.stdin.isTTY === true && process.stdout.isTTY === true,
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

async function exportWeb(directory: string, watch: boolean): Promise<void> {
  const root = process.cwd()
  await scanRepository(root)
  const { exportWebViewer } = await import('./viewers/web/export.ts')
  const exported = await exportWebViewer(root, directory, {
    watch,
    onError: error => console.error(error instanceof Error ? error.message : String(error)),
  })
  console.log(`groma export at ${path.resolve(directory)}`)
  if (!watch) {
    await exported.close()
    return
  }
  const stop = () => {
    process.off('SIGINT', stop)
    process.off('SIGTERM', stop)
    void exported.close().then(() => process.exit())
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  await exported.closed
}

async function scanOnce(): Promise<void> {
  const summary = await scanRepository(process.cwd())
  console.log('ok')
  console.log(formatScanSummary(summary))
}

async function runScan(watchEnabled: boolean): Promise<void> {
  if (!watchEnabled) return scanOnce()
  const session = await watchScan(process.cwd(), {
    onFold: summary => {
      console.log('ok')
      console.log(formatScanSummary(summary))
    },
    onError: error => {
      console.error(error instanceof Error ? error.message : String(error))
    },
  })
  await new Promise<void>(() => {
    const stop = () => {
      process.off('SIGINT', stop)
      process.off('SIGTERM', stop)
      void session.close().then(() => process.exit())
    }
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
  })
}

function unhandledWelcomeAction(action: never): never {
  throw new Error(`unhandled welcome action: ${action}`)
}

async function runWelcomeAction(action: WelcomeActionId): Promise<void> {
  switch (action) {
    case 'web': return openWeb()
    case 'view': return openTerminalMapFromWelcome()
    case 'scan': return scanOnce()
    default: return unhandledWelcomeAction(action)
  }
}

async function runInteractiveWelcome(screen: WelcomeScreen = 'launcher'): Promise<void> {
  const lifecycle = setInterval(() => {}, 1000)
  try {
    const session = await startWelcome(process.cwd(), screen)
    try {
      if (session.selection !== undefined) await runWelcomeAction(session.selection)
    } finally {
      session.close()
    }
  } finally {
    clearInterval(lifecycle)
  }
}

program
  .name('groma')
  .description("This repo's architecture in Git")
  .option('--plain', 'print as plain text')
  .action(async () => {
    const interactive = process.stdin.isTTY === true
      && process.stdout.isTTY === true
      && !program.opts().plain
    if (!interactive) {
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
  .option('--watch', 'refresh the static snapshot when local inputs change')
  .action(async (directory: string, options) => {
    await exportWeb(directory, options.watch === true)
  })

program
  .command('view')
  .description('Scan this repo and open the terminal map')
  .argument('[target]', 'element id, draft id, or repository-relative source file')
  .option('--plain', 'print the merged world as plain text')
  .action(async (target: string | undefined, options) => {
    if (target) {
      const { renderPlainRecord } = await import('./plain-world.ts')
      const result = await renderPlainRecord(process.cwd(), target)
      if (!result.ok) {
        console.error(result.message)
        process.exitCode = 1
        return
      }
      console.log(result.text)
      return
    }
    if (program.opts().plain || options.plain || !process.stdout.isTTY) {
      const { renderPlainWorld } = await import('./plain-world.ts')
      console.log(await renderPlainWorld(process.cwd()))
      return
    }
    await openTerminalMap()
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

program
  .command('draft')
  .description('Draft a system, container, or component as a ghost')
  .argument('<kind>', 'system, container, or component')
  .argument('<name>', 'element name')
  .requiredOption('--overview <markdown>', 'long architecture overview')
  .option('--description <text>', 'concise OKF description')
  .option('--parent <id>', 'parent element id')
  .option('--technology <text>', 'implementation technology')
  .option('--draft <draft-id>', 'the draft record this ghost belongs to')
  .action(async (kind: string, name: string, options) => {
    try {
      const id = await draftElement(process.cwd(), {
        kind,
        name,
        overview: options.overview,
        description: options.description,
        parent: options.parent,
        technology: options.technology,
        draft: options.draft,
      })
      console.log('ok')
      console.log(id)
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    }
  })

program
  .command('edit')
  .description('Update authored meaning')
  .argument('<id>', 'element id or draft id')
  .option('--overview <markdown>', 'long overview, or the outcome of a draft')
  .option('--description <text>', 'concise OKF description; empty removes it')
  .option('--draft <draft-id>', 'tag this element with the draft that touches it')
  .option('--group <name>', 'assign this component to a sibling group')
  .option('--ungroup', 'remove this component from its group')
  .option('--parent <id>', 'move an empty scanned component to this container')
  .option('--combine <ids...>', 'combine empty scan elements into this element')
  .action(async (id: string, options) => {
    try {
      const edited = await editArchitecture(process.cwd(), {
        id,
        overview: options.overview,
        description: options.description,
        draft: options.draft,
        group: options.group,
        ungroup: options.ungroup,
        parent: options.parent,
        combine: options.combine,
      })
      console.log('ok')
      console.log(edited)
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    }
  })

program
  .command('accept')
  .description('Accept a ghost once a scan has matched it')
  .argument('<id>', 'draft element id')
  .action(async (id: string) => {
    let result = await acceptGhost(process.cwd(), id)
    if (result === 'unmatched') {
      await scanRepository(process.cwd())
      result = await acceptGhost(process.cwd(), id)
    }
    if (result === 'accepted') {
      console.log('ok')
      return
    }
    console.error(result === 'not-draft' ? 'not a draft' : 'no scan match')
    process.exitCode = 1
  })

program
  .command('relate')
  .description('Author a relationship between two elements')
  .argument('<source-id>', 'source element id')
  .argument('<target-id>', 'target element id')
  .option('--description <prose>', 'how the source uses the target')
  .option('--technology <text>', 'interaction mechanism')
  .option('--remove', 'remove the only relationship between these elements')
  .action(async (source: string, target: string, options) => {
    try {
      if (options.remove && (options.description !== undefined || options.technology !== undefined)) {
        throw new Error('--remove cannot include --description or --technology')
      }
      if (!options.remove && (options.description === undefined || options.technology === undefined)) {
        throw new Error('--description and --technology are required')
      }
      const related = options.remove
        ? await removeRelationship(process.cwd(), source, target)
        : await relateElements(process.cwd(), {
          source,
          target,
          description: options.description,
          technology: options.technology,
        })
      console.log('ok')
      console.log(related)
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    }
  })

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
  .description('Print a shipped agent instruction guide')
  .argument('[guide]', 'curation')
  .action(async (guide: string | undefined) => {
    const selected = await agentInstructionGuide(guide)
    if (selected === undefined) {
      console.error(`unknown agent guide: ${guide}`)
      process.exitCode = 1
      return
    }
    console.log(selected.content)
  })

await program.parseAsync()
