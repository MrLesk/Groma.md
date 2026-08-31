import type { Command } from 'commander'

import {
  addScanner,
  installScanners,
  removeScanner,
  scannerInventory,
} from './modules/inventory.ts'

function scannerLine(scanner: { id: string; source: string; status: string }): string {
  return `${scanner.id}\t${scanner.status}\t${scanner.source}`
}

async function runScannerCommand(action: () => Promise<void>): Promise<void> {
  try {
    await action()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

export function registerScannerCommands(program: Command): void {
  const scanner = program
    .command('scanner')
    .description('Manage scanner modules for this project')

  scanner
    .command('add')
    .description('Install and enable an exact npm package or local scanner path')
    .argument('<source>', 'package@version or ./path')
    .action(async (source: string) => {
      await runScannerCommand(async () => {
        const added = await addScanner(process.cwd(), source)
        console.log('ok')
        console.log(scannerLine(added))
      })
    })

  scanner
    .command('install')
    .description('Restore configured npm scanner packages')
    .action(async () => {
      await runScannerCommand(async () => {
        const installed = await installScanners(process.cwd())
        console.log('ok')
        console.log(`${installed} installed`)
      })
    })

  scanner
    .command('list')
    .description('List configured scanner readiness')
    .action(async () => {
      await runScannerCommand(async () => {
        for (const item of await scannerInventory(process.cwd())) {
          console.log(scannerLine(item))
        }
      })
    })

  scanner
    .command('remove')
    .description('Disable a scanner without deleting the shared cache')
    .argument('<id>', 'scanner id')
    .action(async (id: string) => {
      await runScannerCommand(async () => {
        const removed = await removeScanner(process.cwd(), id)
        console.log('ok')
        console.log(removed)
      })
    })
}
