import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { renderPlainWorld } from '../src/plain-world.ts'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const fixtureRoot = path.join(projectRoot, 'test', 'fixtures', 'plain-view')
const cli = path.join(projectRoot, 'src', 'cli.ts')

function run(args: string[], cwd: string) {
  return new Promise<{
    code: number | null
    stdout: string
    stderr: string
  }>((resolve, reject) => {
    const child = spawn('bun', [cli, ...args], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
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

test('groma view --plain prints the merged world and does not start the TUI', async () => {
  const expected = await renderPlainWorld(fixtureRoot)
  const result = await run(['view', '--plain'], fixtureRoot)

  assert.equal(result.code, 0, result.stderr)
  assert.equal(result.stderr, '')
  assert.equal(result.stdout, `${expected}\n`)
  assert.doesNotMatch(result.stdout, /System Context/)
})

test('groma view prints the same text when stdout is not a TTY', async () => {
  const expected = await renderPlainWorld(fixtureRoot)
  const result = await run(['view'], fixtureRoot)

  assert.equal(result.code, 0, result.stderr)
  assert.equal(result.stderr, '')
  assert.equal(result.stdout, `${expected}\n`)
  assert.doesNotMatch(result.stdout, /System Context/)
})
