import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadAnnotatedArchitecture } from '../src/core.ts'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

function run(command: string, args: string[], cwd: string) {
  return new Promise<{
    code: number | null
    stderr: string
  }>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', code => {
      resolve({ code, stderr })
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

test('groma scan reconciles source evidence and exits', async t => {
  const root = await createScanRepo(t)
  const result = await run('bun', [path.join(projectRoot, 'src/cli.ts'), 'scan'], root)

  assert.equal(result.code, 0, result.stderr)
  const model = await loadAnnotatedArchitecture(root)
  assert.ok(model.elements.some(element =>
    element.code.some(reference => reference.file === 'src/cli.ts')
  ))
  assert.ok(model.elements.some(element =>
    element.code.some(reference => reference.file === 'src/scanner.ts')
  ))
})
