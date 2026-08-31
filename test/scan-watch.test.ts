import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { TestContext } from 'node:test'

import { watchScan } from '../src/scanner.ts'

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

async function createWatchRepo(t: TestContext): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-scan-watch-'))
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

Describes the scanned shop used by watcher tests.
`,
    'groma/observed/index.md': '# Observed\n',
    'groma/missing/index.md': '# Missing\n',
    'groma/plans/index.md': '# Plans\n',
    'src/cli.ts': "import { scan } from './scanner.ts'\nexport function run() {}\n",
    'src/scanner.ts': 'export function scan() {}\n',
  })
  const init = await run('git', ['init'], root)
  assert.equal(init.code, 0, init.stderr)
  return root
}

async function waitUntil(
  probe: () => Promise<boolean> | boolean,
  timeout = 8000,
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await probe()) return
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error('timed out')
}

async function observedSystems(root: string): Promise<string[]> {
  const directory = path.join(root, 'groma/observed/systems')
  try {
    return await readdir(directory)
  } catch {
    return []
  }
}

test('watchScan folds a settled TypeScript change and ignores plugin test files', async t => {
  const root = await createWatchRepo(t)
  const folds: number[] = []
  const session = await watchScan(root, {
    onFold: () => {
      folds.push(Date.now())
    },
  })
  t.after(() => session.close())

  await new Promise(resolve => setTimeout(resolve, 400))
  assert.deepEqual(folds, [])
  assert.deepEqual(await observedSystems(root), [])

  await writeFile(path.join(root, 'src/cli.test.ts'), 'export function testRun() {}\n')
  await new Promise(resolve => setTimeout(resolve, 400))
  assert.deepEqual(folds, [])
  assert.deepEqual(await observedSystems(root), [])

  await writeFile(path.join(root, 'src/orders.ts'), 'export function placeOrder() {}\n')
  await waitUntil(async () => (await observedSystems(root)).includes('shop'))
  assert.ok(folds.length >= 1)

  const afterFirst = folds.length
  await writeFile(path.join(root, 'src/stock.ts'), 'export function stock() {}\n')
  await waitUntil(() => folds.length > afterFirst)
})
