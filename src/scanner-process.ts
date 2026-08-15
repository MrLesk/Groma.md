import path from 'node:path'

import { startScanner } from './scanner.ts'

function repositoryArgument(arguments_: string[]): string {
  const repositoryIndex = arguments_.indexOf('--repository')
  if (repositoryIndex === -1) return process.cwd()
  if (repositoryIndex === arguments_.length - 1) {
    throw new TypeError('--repository requires a path')
  }
  return path.resolve(arguments_[repositoryIndex + 1])
}

async function main(): Promise<void> {
  const repositoryRoot = repositoryArgument(process.argv.slice(2))
  const scanner = await startScanner(repositoryRoot)
  let closing = false

  async function close(): Promise<void> {
    if (closing) return
    closing = true
    await scanner.close()
  }

  process.on('SIGINT', () => void close())
  process.on('SIGTERM', () => void close())
  process.stdout.write(`Scanner watching ${repositoryRoot}\n`)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`[groma scanner] ${message}\n`)
  process.exitCode = 1
})
