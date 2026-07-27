import { cp, mkdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const portIndex = process.argv.indexOf('--port')
const port = portIndex === -1 ? '4180' : process.argv[portIndex + 1]
const fixtureRoot = path.join(
  os.tmpdir(),
  `groma-live-reload-browser-${port}`,
)

await rm(fixtureRoot, { recursive: true, force: true })
await mkdir(fixtureRoot, { recursive: true })
await cp(
  path.join(projectRoot, 'groma'),
  path.join(fixtureRoot, 'groma'),
  { recursive: true },
)

const child = Bun.spawn({
  cmd: [
    process.execPath,
    'run',
    path.join(projectRoot, 'src/viewer/server.mjs'),
    '--port',
    port,
  ],
  cwd: projectRoot,
  env: {
    ...process.env,
    NODE_ENV: 'test',
    GROMA_TEST_REPOSITORY_ROOT: fixtureRoot,
  },
  stdin: 'ignore',
  stdout: 'inherit',
  stderr: 'inherit',
})

let stopping = false
async function stopFixtureServer(signal = 'SIGTERM') {
  if (stopping) return
  stopping = true
  child.kill(signal)
  await child.exited
  await rm(fixtureRoot, { recursive: true, force: true })
  process.exit(0)
}

process.on('SIGINT', () => void stopFixtureServer('SIGINT'))
process.on('SIGTERM', () => void stopFixtureServer('SIGTERM'))

const exitCode = await child.exited
await rm(fixtureRoot, { recursive: true, force: true })
process.exit(exitCode)
