import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { TestContext } from 'node:test'

import { loadAnnotatedArchitecture } from '../src/core.ts'
import { groma, run, writeTree } from './cli-helpers.ts'

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
  const result = await groma(root, ['scan'])

  assert.equal(result.code, 0, result.stderr)
  const model = await loadAnnotatedArchitecture(root)
  assert.ok(model.elements.some(element =>
    element.code.some(reference => reference.file === 'src/cli.ts')
  ))
  assert.ok(model.elements.some(element =>
    element.code.some(reference => reference.file === 'src/scanner.ts')
  ))
})
