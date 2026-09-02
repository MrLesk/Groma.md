import assert from 'node:assert/strict'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { fileURLToPath } from 'node:url'

import { ArchitectureReadError, loadArchitecture } from '../src/architecture-reader.ts'
import { GromaProfileError } from '../src/okf-profile.ts'
import type { FilesystemAccess } from '../src/types.ts'

const fixtureRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'validate')

async function copyPackage(t: TestContext): Promise<string> {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'groma-reader-'))
  await cp(fixtureRoot, temporaryRoot, { recursive: true })
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }))
  return temporaryRoot
}

test('loads the one tree only after recognizing the marked OKF package', async () => {
  const records = await loadArchitecture(fixtureRoot)

  assert.deepEqual(Object.keys(records), ['documents', 'drafts'])
  assert.equal(records.documents.length, 6)
  assert.deepEqual(
    records.drafts.map(document => document.sourceFilename),
    ['groma/drafts/next.md'],
  )
  assert.deepEqual(Object.keys(records.drafts[0]!).sort(), [
    'body',
    'frontmatter',
    'nodes',
    'sourceFilename',
  ])
  assert.ok(Object.isFrozen(records))
  assert.ok(Object.isFrozen(records.documents[0]?.frontmatter))
})

test('tolerates standard metadata and ignores unknown OKF concept types', async () => {
  const { documents } = await loadArchitecture(fixtureRoot)
  const buyer = documents.find(document => document.frontmatter.title === 'Buyer')

  assert.equal(documents.some(document => document.sourceFilename.endsWith('notes.md')), false)
  assert.equal(buyer?.frontmatter.type, 'C4 Actor')
  assert.equal(buyer?.frontmatter.description, 'A person who places an order.')
  assert.deepEqual(buyer?.frontmatter.tags, ['customer'])
  assert.match(buyer?.body ?? '', /^\s*Places orders/)
})

test('rejects a generic OKF package instead of opening it as Groma', async t => {
  const repositoryRoot = await copyPackage(t)
  const projectFile = path.join(repositoryRoot, 'groma', 'project.md')
  const source = await readFile(projectFile, 'utf8')
  await writeFile(projectFile, source.replace('type: Groma Project', 'type: Project'))

  await assert.rejects(loadArchitecture(repositoryRoot), error => {
    assert.ok(error instanceof GromaProfileError)
    assert.equal(error.sourceFilename, 'groma/project.md')
    return true
  })
})

test('a load reports the profile reads and the tree read', async () => {
  const accesses: Array<{ operation: FilesystemAccess['operation']; file: string }> = []
  await loadArchitecture(fixtureRoot, {
    onFilesystemAccess(access) {
      accesses.push({
        operation: access.operation,
        file: path.relative(fixtureRoot, access.filename),
      })
    },
  })

  assert.ok(accesses.some(access => access.file === path.join('groma', 'index.md')))
  assert.ok(accesses.some(access => access.file === path.join('groma', 'project.md')))
  assert.ok(accesses.some(access => access.operation === 'read-directory' && access.file === 'groma'))
})

test('identifies a malformed C4 document as a Comark parse failure', async t => {
  const repositoryRoot = await copyPackage(t)
  const broken = path.join(repositoryRoot, 'groma', 'actors', 'buyer.md')
  await writeFile(broken, '---\ntype: [broken\n---\n')

  await assert.rejects(loadArchitecture(repositoryRoot), error => {
    assert.ok(error instanceof ArchitectureReadError)
    assert.equal(error.sourceFilename, 'groma/actors/buyer.md')
    assert.equal(error.stage, 'parse')
    return true
  })
})
