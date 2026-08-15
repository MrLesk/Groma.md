#!/usr/bin/env bun

import { startTerminalViewer } from './viewer/terminal-viewer.ts'

const [command] = process.argv.slice(2)

if (command !== 'view') {
  console.error('Usage: groma view')
  process.exitCode = 1
} else {
  const viewer = await startTerminalViewer(process.cwd())
  await viewer.closed
}
