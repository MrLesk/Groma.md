import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

function run(command: string, args: string[], cwd: string) {
  return new Promise<{
    code: number | null
    stdout: string
    stderr: string
  }>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
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

async function writeTree(
  root: string,
  files: Record<string, string>,
): Promise<void> {
  for (const [relative, source] of Object.entries(files)) {
    const filename = path.join(root, ...relative.split('/'))
    await mkdir(path.dirname(filename), { recursive: true })
    await writeFile(filename, source)
  }
}

async function createScanRepo(t: TestContext): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-cli-scan-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeTree(root, {
    'package.json': JSON.stringify({ name: 'shop', bin: { shop: 'src/cli.ts' } }),
    '.gitignore': 'node_modules/\n',
    'groma/index.md': '---\nokf_version: "0.2"\n---\n',
    'groma/project.md': `---
type: Groma Project
title: Shop architecture
groma:
  profile: architecture
---

Describes the scanned shop used by CLI tests.
`,
    'groma/observed/index.md': '# Observed\n',
    'groma/missing/index.md': '# Missing\n',
    'groma/plans/index.md': '# Plans\n',
    'src/cli.ts': "import { scan } from './scanner.ts'\nexport function run() {}\n",
    'src/scanner.ts': 'export function scan() {}\n',
  })
  const init = await run('git', ['init'], root)
  assert.equal(init.code, 0, init.stderr)
  const add = await run('git', ['add', '-A'], root)
  assert.equal(add.code, 0, add.stderr)
  return root
}

test('groma scan runs once, prints ok and a short summary, and exits', async t => {
  const root = await createScanRepo(t)
  const result = await run('bun', [path.join(projectRoot, 'src/cli.ts'), 'scan'], root)

  assert.equal(result.code, 0, result.stderr)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, /^ok\ncreated \d+, refreshed \d+, matched \d+\n$/)
  assert.notEqual(result.stdout, 'ok\ncreated 0, refreshed 0, matched 0\n')
  assert.doesNotMatch(result.stdout, /scan-reconciler|architecture-model/)
  assert.doesNotMatch(result.stdout, /\{|\[|id:/)
})

test('groma scan --watch folds a settled TypeScript change and does not open a viewer', async t => {
  const root = await createScanRepo(t)
  const child = spawn('bun', [path.join(projectRoot, 'src/cli.ts'), 'scan', '--watch'], {
    cwd: root,
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
  t.after(() => {
    child.kill('SIGTERM')
  })

  await new Promise(resolve => setTimeout(resolve, 400))
  assert.equal(child.exitCode, null)
  assert.equal(stdout, '')

  await writeFile(path.join(root, 'src/orders.ts'), 'export function placeOrder() {}\n')
  const start = Date.now()
  while (Date.now() - start < 8000 && !/^ok\ncreated \d+, refreshed \d+, matched \d+\n/.test(stdout)) {
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  assert.match(stdout, /^ok\ncreated \d+, refreshed \d+, matched \d+\n/)
  assert.equal(child.exitCode, null)
  assert.doesNotMatch(stdout, /groma web at|System Context/)
  assert.equal(stderr, '')
})
