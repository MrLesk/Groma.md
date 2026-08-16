import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { authoring, overview, splash } from '../src/instructions.ts'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const cli = path.join(projectRoot, 'src', 'cli.ts')

function run(args: string[]) {
  return new Promise<{
    code: number | null
    stdout: string
    stderr: string
  }>((resolve, reject) => {
    const child = spawn('bun', [cli, ...args], {
      cwd: projectRoot,
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

test('bare groma prints the splash and exits without a viewer', async () => {
  const result = await run([])

  assert.equal(result.code, 0, result.stderr)
  assert.equal(result.stderr, '')
  assert.equal(result.stdout, `${splash}\n`)
  assert.doesNotMatch(result.stdout, /System Context/)
})

test('bare groma --plain prints the same splash', async () => {
  const result = await run(['--plain'])

  assert.equal(result.code, 0, result.stderr)
  assert.equal(result.stderr, '')
  assert.equal(result.stdout, `${splash}\n`)
})

test('groma instructions and instructions overview print the overview', async () => {
  const bare = await run(['instructions'])
  const named = await run(['instructions', 'overview'])

  assert.equal(bare.code, 0, bare.stderr)
  assert.equal(bare.stderr, '')
  assert.equal(bare.stdout, `${overview}\n`)
  assert.equal(named.code, 0, named.stderr)
  assert.equal(named.stdout, bare.stdout)
})

test('groma instructions authoring prints the authoring guide', async () => {
  const result = await run(['instructions', 'authoring'])

  assert.equal(result.code, 0, result.stderr)
  assert.equal(result.stderr, '')
  assert.equal(result.stdout, `${authoring}\n`)
})

test('groma instructions unknown guide fails with a clear message', async () => {
  const result = await run(['instructions', 'no-such'])

  assert.equal(result.code, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'unknown guide: no-such\n')
})

test('groma --help still lists the commands', async () => {
  const result = await run(['--help'])

  assert.equal(result.code, 0, result.stderr)
  assert.notEqual(result.stdout, `${splash}\n`)
  for (const name of ['view', 'scan', 'create', 'edit', 'accept', 'instructions']) {
    assert.match(result.stdout, new RegExp(`^\\s+${name}\\b`, 'm'))
  }
})
