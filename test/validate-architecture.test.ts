import assert from 'node:assert/strict'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { fileURLToPath } from 'node:url'

import { validateRepository } from '../scripts/validate-architecture.ts'

const fixtureRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'validate')
const relationshipsPath = ['groma', 'relationships.md']

async function copyPackage(t: TestContext): Promise<string> {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'groma-validation-'))
  await cp(fixtureRoot, temporaryRoot, { recursive: true })
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }))
  return temporaryRoot
}

async function replaceInFile(file: string, search: string, replacement: string): Promise<void> {
  const source = await readFile(file, 'utf8')
  assert.ok(source.includes(search), `${file} does not contain the test input`)
  await writeFile(file, source.replace(search, replacement))
}

test('a marked OKF profile validates every C4 kind, counts drafts, and ignores an ordinary OKF concept', { concurrency: true }, async () => {
  const result = await validateRepository(fixtureRoot)
  const kinds = new Set(result.elements.map(element => element.kind))

  assert.equal(result.elementCount, 6)
  assert.deepEqual(kinds, new Set(['actor', 'system', 'container', 'component']))
  assert.equal(result.relationshipCount, 2)
  assert.equal(result.draftCount, 1)
})

test('a generic OKF package is rejected before architecture validation', { concurrency: true }, async t => {
  const repositoryRoot = await copyPackage(t)
  await replaceInFile(
    path.join(repositoryRoot, 'groma', 'project.md'),
    'type: Groma Project',
    'type: Project',
  )

  await assert.rejects(validateRepository(repositoryRoot), /type must be "Groma Project"/)
})

test('the root index contains only the pinned OKF declaration', { concurrency: true }, async t => {
  const repositoryRoot = await copyPackage(t)
  await replaceInFile(
    path.join(repositoryRoot, 'groma', 'index.md'),
    'okf_version: "0.2"',
    'okf_version: "0.2"\ngroma: architecture',
  )

  await assert.rejects(validateRepository(repositoryRoot), /root index frontmatter must contain only okf_version/)
})

test('canonical C4 containment remains strict', { concurrency: true }, async t => {
  const repositoryRoot = await copyPackage(t)
  await replaceInFile(
    path.join(repositoryRoot, 'groma', 'systems', 'shop', 'containers', 'api', 'container.md'),
    'parent: shop',
    'parent: missing-system',
  )

  await assert.rejects(validateRepository(repositoryRoot), /unknown parent id "missing-system"/)
})

test('canonical relationship targets must resolve even when generic links do not', { concurrency: true }, async t => {
  const repositoryRoot = await copyPackage(t)
  await replaceInFile(
    path.join(repositoryRoot, ...relationshipsPath),
    'externals/git.md',
    'externals/missing.md',
  )

  await assert.rejects(validateRepository(repositoryRoot), /endpoint.*missing.md.*has no file owner or concept/)
})

test('a Groma relationship table keeps its canonical columns', { concurrency: true }, async t => {
  const repositoryRoot = await copyPackage(t)
  await replaceInFile(
    path.join(repositoryRoot, ...relationshipsPath),
    '| Source | Target | Description | Technology |',
    '| Source | Target | Detail | Technology |',
  )

  await assert.rejects(validateRepository(repositoryRoot), /Target.*Description.*Technology/)
})
