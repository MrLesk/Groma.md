import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const fixtureRoot = path.join(projectRoot, 'test', 'fixtures', 'plain-view')
const cli = path.join(projectRoot, 'src', 'cli.ts')

function run(args: string[], cwd: string, options: { ttyStdout?: boolean } = {}) {
  return new Promise<{
    code: number | null
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
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let stderr = ''
    const timeout = options.ttyStdout
      ? setTimeout(() => {
          child.kill()
          reject(new Error('groma view --plain did not exit in TTY mode'))
        }, 5_000)
      : undefined
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => {
      stderr += chunk
    })
    child.on('error', error => {
      if (timeout !== undefined) clearTimeout(timeout)
      reject(error)
    })
    child.on('close', code => {
      if (timeout !== undefined) clearTimeout(timeout)
      resolve({ code, stderr })
    })
  })
}

test('groma view exits without a TUI when output is not interactive', async () => {
  for (const args of [['view'], ['view', '--plain']]) {
    const result = await run(args, fixtureRoot)
    assert.equal(result.code, 0, result.stderr)
  }
})

test('groma view --plain exits when output is interactive', async () => {
  const result = await run(['view', '--plain'], fixtureRoot, { ttyStdout: true })

  assert.equal(result.code, 0, result.stderr)
})

test('groma view resolves element, draft, and source-file targets', async () => {
  for (const target of ['stock', 'orders', 'next', 'src/orders.ts']) {
    const result = await run(['view', target], fixtureRoot)
    const plain = await run(['view', target, '--plain'], fixtureRoot)

    assert.equal(result.code, 0, result.stderr)
    assert.equal(plain.code, 0, plain.stderr)
  }
})

test('groma view rejects an unknown target', async () => {
  const result = await run(['view', 'no-such'], fixtureRoot)

  assert.equal(result.code, 1)
})

test('groma view fails when several elements share a code file', async (t: TestContext) => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'groma-view-'))
  t.after(() => rm(parent, { recursive: true, force: true }))
  const root = path.join(parent, 'repo')
  await cp(fixtureRoot, root, { recursive: true })
  await writeFile(
    path.join(root, 'groma/systems/shop/containers/api/components/other.md'),
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
})
