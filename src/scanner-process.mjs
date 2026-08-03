import path from 'node:path'

import { startScanner } from './scanner.mjs'

function repositoryArgument(arguments_) {
  const repositoryIndex = arguments_.indexOf('--repository')
  if (repositoryIndex === -1) return process.cwd()
  if (repositoryIndex === arguments_.length - 1) {
    throw new TypeError('--repository requires a path')
  }
  return path.resolve(arguments_[repositoryIndex + 1])
}

async function main() {
  const repositoryRoot = repositoryArgument(process.argv.slice(2))
  const scanner = await startScanner(repositoryRoot)
  let closing = false

  async function close() {
    if (closing) return
    closing = true
    await scanner.close()
  }

  process.on('SIGINT', () => void close())
  process.on('SIGTERM', () => void close())
  process.stdout.write(`Scanner watching ${repositoryRoot}\n`)
}

main().catch(error => {
  process.stderr.write(`[groma scanner] ${error.message}\n`)
  process.exitCode = 1
})
