import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { fileURLToPath } from 'node:url'
import { copyFixture, readTree } from './cli-helpers.ts'

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
    stdout: string
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
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', chunk => { stdout += chunk })
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
      resolve({ code, stderr, stdout })
    })
  })
}

test('groma view exits without a TUI when output is not interactive', { concurrency: true }, async () => {
  for (const args of [['view'], ['view', '--plain']]) {
    const result = await run(args, fixtureRoot)
    assert.equal(result.code, 0, result.stderr)
    assert.match(result.stdout, /^buyer\s+actor/m)
  }
})

test('groma view --plain exits when output is interactive', { concurrency: true }, async () => {
  const result = await run(['view', '--plain'], fixtureRoot, { ttyStdout: true })

  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /^buyer\s+actor/m)
})

test('element and every owned source file return the complete authored Markdown', { concurrency: true }, async () => {
  for (const target of ['stock', 'orders', 'src/orders.ts', 'src/routes/orders.ts']) {
    const result = await run(['view', target], fixtureRoot)
    const plain = await run(['view', target, '--plain'], fixtureRoot)
    const selectedId = target === 'stock' ? 'stock' : 'orders'
    const authored = await readFile(path.join(
      fixtureRoot, `groma/systems/shop/containers/api/components/${selectedId}.md`,
    ), 'utf8')

    assert.equal(result.code, 0, result.stderr)
    assert.equal(plain.code, 0, plain.stderr)
    assert.equal(result.stdout, authored)
    assert.equal(plain.stdout, result.stdout)
  }
})

test('draft lookup keeps its completion and membership summary', { concurrency: true }, async () => {
  const result = await run(['view', 'next'], fixtureRoot)
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /^next\nkind: draft\n/)
  assert.match(result.stdout, /\ncomplete\n/)
  assert.match(result.stdout, /\nstock\s+stable\n/)
})

test('flow lookup preserves the authored steps and the overview offers its index', { concurrency: true }, async () => {
  const root = path.join(projectRoot, 'test/fixtures/flows')
  const authored = await readFile(path.join(root, 'groma/flows/process-request.md'), 'utf8')
  const result = await run(['view', 'process-request'], root)
  const overview = await run(['view', '--plain'], root)
  assert.equal(result.code, 0, result.stderr)
  assert.equal(result.stdout, authored)
  assert.equal(overview.code, 0, overview.stderr)
  assert.match(overview.stdout, /\nflows\nprocess-request\s+/)
  assert.doesNotMatch(overview.stdout, /## Steps/)
})

test('overview groups remain labels on their sibling elements', { concurrency: true }, async () => {
  const result = await run(['view', '--plain'], fixtureRoot)
  assert.equal(result.code, 0, result.stderr)
  const grouped = result.stdout.split('\n').filter(line => line.includes('group:Fulfilment'))
  assert.deepEqual(grouped.map(line => line.trim().split(/\s+/)[0]), ['orders', 'stock'])
  assert.doesNotMatch(result.stdout, /## Requirements|## Notes/)
})

test('plain reads leave repository files untouched and do not scan new source', { concurrency: true }, async (t: TestContext) => {
  const root = await copyFixture(t, fixtureRoot, 'groma-view-read-')
  await mkdir(path.join(root, 'src'))
  await writeFile(path.join(root, 'src/new.ts'), 'export function unscanned() {}\n')
  const before = await readTree(root, '.')
  for (const args of [['view', '--plain'], ['view', 'orders'], ['view', 'src/routes/orders.ts'], ['view', 'next']]) {
    const result = await run(args, root)
    assert.equal(result.code, 0, result.stderr)
  }
  assert.deepEqual(await readTree(root, '.'), before)
})

test('groma view rejects an unknown target', { concurrency: true }, async () => {
  const result = await run(['view', 'no-such'], fixtureRoot)

  assert.equal(result.code, 1)
  assert.match(result.stderr, /unknown target: no-such/)
})

test('groma view fails when several elements share a code file', { concurrency: true }, async (t: TestContext) => {
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
  assert.match(result.stderr, /several elements share src\/orders\.ts/)
})
