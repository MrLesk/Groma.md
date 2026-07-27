import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

function waitForViewerUrl(child) {
  return new Promise((resolve, reject) => {
    let output = ''
    let errors = ''
    const timeout = setTimeout(() => {
      reject(new Error(`Viewer did not start.\n${output}\n${errors}`))
    }, 10_000)

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => {
      errors += chunk
    })
    child.stdout.on('data', chunk => {
      output += chunk
      const match = output.match(/at (http:\/\/127\.0\.0\.1:\d+\/)/)
      if (!match) return

      clearTimeout(timeout)
      resolve(match[1])
    })
    child.once('exit', (code, signal) => {
      clearTimeout(timeout)
      reject(
        new Error(
          `Viewer exited before startup: code=${code} signal=${signal}\n${errors}`,
        ),
      )
    })
  })
}

test('closes the server, SSE stream, and filesystem watchers on SIGTERM', async t => {
  const repositoryRoot = await mkdtemp(
    path.join(os.tmpdir(), 'groma-viewer-lifecycle-'),
  )
  await mkdir(repositoryRoot, { recursive: true })
  await cp(
    path.join(projectRoot, 'groma'),
    path.join(repositoryRoot, 'groma'),
    { recursive: true },
  )
  const child = spawn(
    'bun',
    ['run', 'src/viewer/server.mjs', '--port', '0'],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        GROMA_TEST_REPOSITORY_ROOT: repositoryRoot,
        NODE_ENV: 'test',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  let exited = false
  t.after(async () => {
    if (!exited) {
      child.kill('SIGKILL')
      await once(child, 'exit')
    }
    await rm(repositoryRoot, { recursive: true, force: true })
  })

  const viewerUrl = await waitForViewerUrl(child)
  const eventResponse = await fetch(new URL('/api/events', viewerUrl))
  const eventReader = eventResponse.body.getReader()
  const firstEvent = await eventReader.read()
  assert.match(new TextDecoder().decode(firstEvent.value), /architecture-changed/)

  const exit = once(child, 'exit')
  child.kill('SIGTERM')
  const [code, signal] = await exit
  exited = true
  await eventReader.cancel().catch(() => {})

  assert.equal(code, 0)
  assert.equal(signal, null)
})
