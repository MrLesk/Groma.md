#!/usr/bin/env bun

import { Command } from 'commander'

import { acceptGhost } from './core.ts'
import { createPlannedElement } from './create.ts'
import { editArchitecture } from './edit.ts'
import { authoring, overview, splash } from './instructions.ts'
import { formatScanSummary, scanRepository, watchScan } from './scanner.ts'

const program = new Command()

program
  .name('groma')
  .description("This repo's architecture in Git")
  .option('--plain', 'print as plain text')
  .action(() => {
    console.log(splash)
  })

program
  .command('view')
  .description('Open the terminal map')
  .argument('[target]', 'element id, plan id, or repository-relative source file')
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
    if (options.plain || !process.stdout.isTTY) {
      const { renderPlainWorld } = await import('./plain-world.ts')
      console.log(await renderPlainWorld(process.cwd()))
      return
    }
    const { startTerminalViewer } = await import('./view-host.ts')
    const viewer = await startTerminalViewer(process.cwd())
    await viewer.closed
  })

program
  .command('web')
  .description('Open the browser map')
  .action(async () => {
    const { startWebViewer } = await import('./viewers/web/server.ts')
    const { url } = await startWebViewer(process.cwd())
    console.log(`groma web at ${url}`)
  })

program
  .command('scan')
  .description('Scan this repo and fold findings into Markdown')
  .option('--watch', 'scan again when TypeScript source changes')
  .action(async options => {
    const root = process.cwd()
    if (options.watch) {
      const session = watchScan(root, {
        onFold: summary => {
          console.log('ok')
          console.log(formatScanSummary(summary))
        },
        onError: error => {
          console.error(error instanceof Error ? error.message : String(error))
        },
      })
      await new Promise<void>(resolve => {
        const stop = () => {
          session.close()
          resolve()
        }
        process.once('SIGINT', stop)
        process.once('SIGTERM', stop)
      })
      return
    }
    const summary = await scanRepository(root)
    console.log('ok')
    console.log(formatScanSummary(summary))
  })

program
  .command('create')
  .description('Author a planned element')
  .argument('<name>', 'element name')
  .requiredOption('--plan <plan-id>', 'plan id')
  .requiredOption('--kind <kind>', 'person, system, container, or component')
  .requiredOption('--description <prose>', 'element description')
  .option('--parent <id>', 'parent element id')
  .action(async (name: string, options) => {
    try {
      const id = await createPlannedElement(process.cwd(), {
        name,
        plan: options.plan,
        kind: options.kind,
        description: options.description,
        parent: options.parent,
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
  .argument('<id>', 'element id or plan id')
  .option('--description <prose>', 'lead prose or plan Outcome')
  .option('--plan <plan-id>', 'restate this element in the plan')
  .action(async (id: string, options) => {
    try {
      const edited = await editArchitecture(process.cwd(), {
        id,
        description: options.description,
        plan: options.plan,
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
  .description('Apply a matched planned ghost into observed')
  .argument('<id>', 'planned element id')
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
    console.error(result === 'missing' ? 'not a planned ghost' : 'no scan match')
    process.exitCode = 1
  })

program
  .command('instructions')
  .description('Print a shipped instruction guide')
  .argument('[guide]', 'overview or authoring')
  .action((guide: string | undefined) => {
    if (guide === undefined || guide === 'overview') {
      console.log(overview)
      return
    }
    if (guide === 'authoring') {
      console.log(authoring)
      return
    }
    console.error(`unknown guide: ${guide}`)
    process.exitCode = 1
  })

await program.parseAsync()
