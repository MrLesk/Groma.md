import assert from 'node:assert/strict'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { fileURLToPath } from 'node:url'

import { validateRepository, validateRevision } from '../scripts/validate-architecture.ts'

const fixtureRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'validate',
)
const observedFixture = path.join(fixtureRoot, 'groma', 'observed')

async function copyObserved(t: TestContext): Promise<string> {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'groma-validation-'))
  const revisionRoot = path.join(temporaryRoot, 'revision')
  await cp(observedFixture, revisionRoot, { recursive: true })
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }))
  return revisionRoot
}

async function replaceInFile(file: string, search: string, replacement: string): Promise<void> {
  const source = await readFile(file, 'utf8')
  assert.ok(source.includes(search), `${file} does not contain the test input`)
  await writeFile(file, source.replace(search, replacement))
}

test('a fixture with each C4 kind and a relationship validates', async () => {
  const results = await validateRepository(fixtureRoot)
  const kinds = new Set(results[0]?.elements.map(element => element.kind))

  assert.deepEqual(
    results.map(result => path.basename(result.revisionRoot)),
    ['observed', 'next'],
  )
  assert.deepEqual(results.map(result => result.elementCount), [5, 1])
  assert.ok(kinds.has('person'))
  assert.ok(kinds.has('system'))
  assert.ok(kinds.has('container'))
  assert.ok(kinds.has('component'))
  assert.ok((results[0]?.relationshipCount ?? 0) >= 1)
})

test('a container parent must be a known system', async t => {
  const revisionRoot = await copyObserved(t)
  await replaceInFile(
    path.join(revisionRoot, 'systems', 'shop', 'containers', 'api', 'container.md'),
    'parent: shop',
    'parent: missing-system',
  )

  await assert.rejects(
    validateRevision(revisionRoot),
    /unknown parent id "missing-system"/,
  )
})

test('a relationship target must resolve', async t => {
  const revisionRoot = await copyObserved(t)
  await replaceInFile(
    path.join(revisionRoot, 'systems', 'shop', 'system.md'),
    '../git/system.md',
    '../git/missing.md',
  )

  await assert.rejects(
    validateRevision(revisionRoot),
    /broken relationship link "\.\.\/git\/missing\.md"/,
  )
})
