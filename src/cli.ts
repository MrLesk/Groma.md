#!/usr/bin/env bun

import { formatScanSummary, scanRepository } from './scanner.ts'

const [command] = process.argv.slice(2)

if (command === 'view') {
  const { startTerminalViewer } = await import('./viewers/tui/terminal-viewer.ts')
  const viewer = await startTerminalViewer(process.cwd())
  await viewer.closed
} else if (command === 'web') {
  const { startWebViewer } = await import('./viewers/web/server.ts')
  console.log(`groma web at ${startWebViewer(process.cwd())}`)
} else if (command === 'scan') {
  const summary = await scanRepository(process.cwd())
  console.log('ok')
  console.log(formatScanSummary(summary))
} else {
  console.error('Usage: groma view|web|scan')
  process.exitCode = 1
}
