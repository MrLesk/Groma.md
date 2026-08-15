#!/usr/bin/env bun

import { formatScanSummary, scanRepository } from './scanner.ts'

const [command] = process.argv.slice(2)

if (command === 'view') {
  const { startTerminalViewer } = await import('./viewers/tui/terminal-viewer.ts')
  const viewer = await startTerminalViewer(process.cwd())
  await viewer.closed
} else if (command === 'scan') {
  const summary = await scanRepository(process.cwd())
  console.log('ok')
  console.log(formatScanSummary(summary))
} else {
  console.error('Usage: groma view|scan')
  process.exitCode = 1
}
