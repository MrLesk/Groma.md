#!/usr/bin/env bun

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Command } from 'commander'

import { writes } from './authoring.ts'
import { isGroupAddress } from './naming.ts'
import type { AddInput, RemoveInput } from './authoring.ts'
import { agentInstructionGuide } from './agent-instructions.ts'
import { ensureInitialized, runInitCommand } from './init-command.ts'
import { humanInstructionGuide } from './instructions.ts'
import { registerScannerCommands } from './scanner/cli.ts'
import { formatScanSummary, scanRepository, watchScan } from './scanner.ts'
import {
  renderPlainWelcome,
  startWelcome,
} from './welcome.ts'
import type { WelcomeActionId, WelcomeScreen } from './welcome.ts'

const program = new Command()

function interactiveTerminal(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true
}

async function openWeb(port?: number, scan = true): Promise<void> {
  try {
    const { startWebViewer } = await import('./viewers/web/server.ts')
    const { url } = await startWebViewer(process.cwd(), { port, scan })
    console.log(`groma web at ${url}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

async function openTerminalMap(scan = true): Promise<void> {
  const root = process.cwd()
  if (scan) await scanRepository(root)
  const { startTerminalViewer } = await import('./view-host.ts')
  const viewer = await startTerminalViewer(root)
  await viewer.closed
}

async function openTerminalView(target: string | undefined, plain: boolean): Promise<void> {
  const door = await ensureInitialized({
    repositoryRoot: process.cwd(),
    interactive: interactiveTerminal() && target === undefined && !plain,
    opensViewer: true,
  })
  if (door !== 'ready') {
    if (door !== 'declined') process.exitCode = 1
    return
  }
  if (target) {
    const { renderPlainRecord } = await import('./plain-world.ts')
    const result = await renderPlainRecord(process.cwd(), target)
    if (!result.ok) {
      console.error(result.message)
      process.exitCode = 1
      return
    }
    console.log(result.text)
  } else if (plain || !process.stdout.isTTY) {
    const { renderPlainWorld } = await import('./plain-world.ts')
    console.log(await renderPlainWorld(process.cwd()))
  } else {
    await openTerminalMap()
  }
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
    try {
      await openTerminalView(target, Boolean(program.opts().plain || options.plain))
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

program
  .command('draft')
  .description('Draft software or a directed relationship')
  .argument('<kind>', 'system, container, component, or relation')
  .argument('<name>', 'element name')
  .argument('[target]', 'target id when drafting a relation')
  .option('--overview <markdown>', 'long architecture overview')
  .option('--description <text>', 'concise OKF description')
  .option('--parent <id>', 'parent element id')
  .option('--technology <text>', 'implementation technology')
  .option('--draft <draft-id>', 'the draft record this ghost belongs to')
  .action(async (kind: string, name: string, target: string | undefined, options) => {
    try {
      const id = await writes.draft(process.cwd(), {
        kind,
        name,
        ...(kind === 'relation' ? { relation: target ?? '' } : {}),
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

/** `<verb> relation <a> <b>` names a relationship and `<verb> group <address> [ids...]` a group; every other id stands alone. Only remove reads the members. */
function addressed(id: string, ids: string[]): RemoveInput {
  if (id === 'relation') {
    const [source, target] = ids
    if (source === undefined || target === undefined || ids.length > 2) {
      throw new Error('relation takes a source id and a target id')
    }
    return { id: source, relation: target }
  }
  if (id === 'group') {
    const [address, ...members] = ids
    if (address === undefined || !isGroupAddress(address)) {
      throw new Error('group takes an address <container-id>/<group-kebab>')
    }
    return { id: address, members }
  }
  if (ids.length > 0) throw new Error(`${id} takes no further id`)
  return { id }
}

/** `add relation <a> <b>` and `add group <name> <ids...>` carry ids after the name; nothing else does. */
function addedIds(thing: string, ids: string[]): Pick<AddInput, 'relation' | 'members'> {
  if (thing === 'relation') {
    if (ids.length !== 1) throw new Error('add relation takes a source id and a target id')
    return { relation: ids[0] }
  }
  if (thing === 'group') return { members: ids }
  if (ids.length > 0) throw new Error('add takes one name; quote a name with spaces')
  return {}
}

program
  .command('add')
  .description('Declare an actor, external system, draft, flow, relation, or group')
  .argument('<thing>', 'actor, external, draft, flow, relation, or group')
  .argument('<name>', 'name, or the source id of a relation')
  .argument('[ids...]', 'target id of a relation, or the member ids of a group')
  .option('--overview <markdown>', 'long overview, or the outcome of a draft')
  .option('--steps <markdown>', 'flow Steps table: From | To | Action, with Markdown endpoint links')
  .option('--description <text>', 'concise OKF description, or how the source uses the target')
  .option('--technology <text>', 'technology of an external, or the interaction mechanism of a relation')
  .action(async (thing: string, name: string, ids: string[], options) => {
    try {
      const id = await writes.add(process.cwd(), {
        thing,
        name,
        ...addedIds(thing, ids),
        overview: options.overview,
        steps: options.steps,
        description: options.description,
        technology: options.technology,
      })
      console.log('ok')
      console.log(id)
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    }
  })

program
  .command('remove')
  .description('Remove a person, an external, a ghost, a draft nothing belongs to, a relation, or a group')
  .argument('<id>', 'element id, draft id, flow id, relation, or group')
  .argument('[ids...]', 'with relation: the source id and the target id; with group: the address and the members leaving')
  .action(async (id: string, ids: string[]) => {
    try {
      const removed = await writes.remove(process.cwd(), addressed(id, ids))
      console.log('ok')
      console.log(removed)
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    }
  })

program
  .command('edit')
  .description('Update authored meaning')
  .argument('<id>', 'element id, draft id, flow id, project, relation, or group')
  .argument('[ids...]', 'with relation: the source id and the target id; with group: the address')
  .option('--title <text>', 'new title; the id stays, or the new name of a group')
  .option('--overview <markdown>', 'long overview, or the outcome of a draft')
  .option('--steps <markdown>', 'flow Steps table: From | To | Action, with Markdown endpoint links')
  .option('--description <text>', 'concise OKF description (empty removes it), or how a relation works')
  .option('--technology <text>', 'technology of an element (empty removes it) or of a relation')
  .option('--draft <draft-id>', 'tag this element with the draft that touches it')
  .option('--group <name>', 'assign this component to a sibling group')
  .option('--ungroup', 'remove this component from its group')
  .option('--parent <id>', 'move an empty scanned component to this container')
  .option('--combine <ids...>', 'combine empty scan elements into this element')
  .action(async (id: string, ids: string[], options) => {
    try {
      const { id: target, relation } = addressed(id, ids)
      const edited = await writes.edit(process.cwd(), {
        id: target,
        relation,
        title: options.title,
        overview: options.overview,
        steps: options.steps,
        description: options.description,
        technology: options.technology,
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
  .description('Accept a matched draft element or explicitly accept a draft relationship')
  .argument('<id>', 'draft element id, or relation')
  .argument('[ids...]', 'source and target ids when accepting a relation')
  .action(async (id: string, ids: string[]) => {
    try {
      try {
        await writes.accept(process.cwd(), addressed(id, ids))
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'no scan match') throw error
        await scanRepository(process.cwd())
        await writes.accept(process.cwd(), { id })
      }
      console.log('ok')
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
