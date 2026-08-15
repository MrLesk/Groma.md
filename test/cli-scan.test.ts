import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

function runCli(args: string[]) {
  return new Promise<{
    code: number | null
    stdout: string
    stderr: string
  }>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--import=tsx', 'src/cli.ts', ...args],
      {
        cwd: projectRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => {
      stdout += chunk
    })
    child.stderr.on('data', chunk => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', code => {
      resolve({ code, stdout, stderr })
    })
  })
}

test('groma scan runs once, prints ok and a short summary, and exits', async () => {
  const result = await runCli(['scan'])

  assert.equal(result.code, 0)
  assert.equal(result.stderr, '')
  assert.equal(result.stdout, 'ok\ncreated 0, refreshed 0, matched 0\n')
  assert.doesNotMatch(result.stdout, /scan-reconciler|architecture-model/)
  assert.doesNotMatch(result.stdout, /\{|\[|id:/)
})
