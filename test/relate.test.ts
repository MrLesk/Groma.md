import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadAnnotatedArchitecture } from '../src/core.ts'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixtureRoot = path.join(projectRoot, 'test', 'fixtures', 'edit')
const stockPath = 'groma/observed/systems/shop/containers/api/components/stock.md'

function groma(root: string, args: string[]) {
  return new Promise<{ code: number | null, stdout: string, stderr: string }>(
    (resolve, reject) => {
      const child = spawn(
        'bun',
        [path.join(projectRoot, 'src/cli.ts'), ...args],
        { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
      )
      let stdout = ''
      let stderr = ''
      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', chunk => { stdout += chunk })
      child.stderr.on('data', chunk => { stderr += chunk })
      child.on('error', reject)
      child.on('close', code => { resolve({ code, stdout, stderr }) })
    },
  )
}

async function createRepo(t: TestContext): Promise<string> {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'groma-relate-'))
  t.after(() => rm(parent, { recursive: true, force: true }))
  const root = path.join(parent, 'repo')
  await cp(fixtureRoot, root, { recursive: true })
  return root
}

test('groma relate authors one validated observed relationship', async t => {
  const root = await createRepo(t)
  const filename = path.join(root, stockPath)
  const original = await readFile(filename, 'utf8')
  const args = [
    'relate',
    'stock',
    'orders',
    '--description',
    'Informs order placement',
    '--technology',
    'In-process data',
  ]
  const first = await groma(root, args)

  assert.equal(first.code, 0, first.stderr)
  assert.equal(first.stdout, 'ok\nstock\n')
  const model = await loadAnnotatedArchitecture(root)
  assert.ok(model.relationships.some(relationship => {
    return relationship.source === 'observed:stock'
      && relationship.target === 'observed:orders'
      && relationship.description === 'Informs order placement'
      && relationship.technology === 'In-process data'
  }))

  const beforeDuplicate = await readFile(filename, 'utf8')
  const duplicate = await groma(root, args)
  assert.notEqual(duplicate.code, 0)
  assert.match(duplicate.stderr, /relationship already exists/)
  assert.equal(await readFile(filename, 'utf8'), beforeDuplicate)

  const removed = await groma(root, ['relate', 'stock', 'orders', '--remove'])
  assert.equal(removed.code, 0, removed.stderr)
  assert.equal(removed.stdout, 'ok\nstock\n')
  assert.equal(
    (await readFile(filename, 'utf8')).replaceAll('\r\n', '\n'),
    original.replaceAll('\r\n', '\n'),
  )
})
