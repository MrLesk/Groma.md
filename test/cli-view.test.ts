import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { fileURLToPath } from 'node:url'

import { renderPlainRecord, renderPlainWorld } from '../src/plain-world.ts'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const fixtureRoot = path.join(projectRoot, 'test', 'fixtures', 'plain-view')
const cli = path.join(projectRoot, 'src', 'cli.ts')

function run(args: string[], cwd: string, options: { ttyStdout?: boolean } = {}) {
  return new Promise<{
    code: number | null
    stdout: string
    stderr: string
  }>((resolve, reject) => {
    const commandArgs = options.ttyStdout
      ? [
          '-e',
          [
            'Object.defineProperty(process.stdout, "isTTY", { value: true })',
            `process.argv = ${JSON.stringify(['bun', ...args])}`,
            `await import(${JSON.stringify(cli)})`,
          ].join(';'),
        ]
      : [cli, ...args]
    const child = spawn('bun', commandArgs, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    const timeout = options.ttyStdout
      ? setTimeout(() => {
          child.kill()
          reject(new Error('groma view --plain did not exit in TTY mode'))
        }, 5_000)
      : undefined
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => {
      stdout += chunk
    })
    child.stderr.on('data', chunk => {
      stderr += chunk
    })
    child.on('error', error => {
      if (timeout !== undefined) clearTimeout(timeout)
      reject(error)
    })
    child.on('close', code => {
      if (timeout !== undefined) clearTimeout(timeout)
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

test('groma view --plain stays plain when stdout is a TTY', async () => {
  const expected = await renderPlainWorld(fixtureRoot)
  const result = await run(['view', '--plain'], fixtureRoot, { ttyStdout: true })

  assert.equal(result.code, 0, result.stderr)
  assert.equal(result.stderr, '')
  assert.equal(result.stdout, `${expected}\n`)
})

test('groma view prints the same text when stdout is not a TTY', async () => {
  const expected = await renderPlainWorld(fixtureRoot)
  const result = await run(['view'], fixtureRoot)

  assert.equal(result.code, 0, result.stderr)
  assert.equal(result.stderr, '')
  assert.equal(result.stdout, `${expected}\n`)
  assert.doesNotMatch(result.stdout, /System Context/)
})

async function okRecord(target: string): Promise<string> {
  const result = await renderPlainRecord(fixtureRoot, target)
  if (result.ok) return result.text
  assert.fail(result.message)
}

test('groma view target prints one record and --plain does not change it', async () => {
  for (const target of ['stock', 'orders', 'next', 'src/orders.ts']) {
    const expected = await okRecord(target)
    const result = await run(['view', target], fixtureRoot)
    const plain = await run(['view', target, '--plain'], fixtureRoot)

    assert.equal(result.code, 0, result.stderr)
    assert.equal(result.stderr, '')
    assert.equal(result.stdout, `${expected}\n`)
    assert.equal(plain.code, 0, plain.stderr)
    assert.equal(plain.stdout, result.stdout)
    assert.doesNotMatch(result.stdout, /System Context/)
  }
})

test('groma view unknown target fails with a clear message', async () => {
  const result = await run(['view', 'no-such'], fixtureRoot)

  assert.equal(result.code, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'unknown target: no-such\n')
  assert.doesNotMatch(result.stderr, /System Context/)
})

test('groma view fails when several elements share a code file', async (t: TestContext) => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'groma-view-'))
  t.after(() => rm(parent, { recursive: true, force: true }))
  const root = path.join(parent, 'repo')
  await cp(fixtureRoot, root, { recursive: true })
  await writeFile(
    path.join(root, 'groma/observed/systems/shop/containers/api/components/other.md'),
    [
      '---',
      'type: C4 Component',
      'title: Other',
      'status: stable',
      'groma:',
      '  id: other',
      '  parent: api',
      '  code:',
      '    - scanner: typescript',
      '      file: src/orders.ts',
      '---',
      '',
    ].join('\n'),
  )

  const result = await run(['view', 'src/orders.ts'], root)

  assert.equal(result.code, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'several elements share src/orders.ts\n')
  assert.doesNotMatch(result.stderr, /System Context/)
})
