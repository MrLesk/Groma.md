import path from 'node:path'

import { startSourceRefresh } from './source-refresh.mjs'

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
  const refresh = await startSourceRefresh(repositoryRoot)
  let closing = false

  async function close() {
    if (closing) return
    closing = true
    await refresh.close()
  }

  process.on('SIGINT', () => void close())
  process.on('SIGTERM', () => void close())
  process.stdout.write(`Source refresh watching ${repositoryRoot}\n`)
  const failure = await refresh.done
  if (failure !== null) process.exitCode = 1
}

main().catch(error => {
  process.stderr.write(`[groma source refresh] ${error.message}\n`)
  process.exitCode = 1
})
