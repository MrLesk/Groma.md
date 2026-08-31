import assert from 'node:assert/strict'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { fileURLToPath } from 'node:url'

import { ArchitectureReadError, loadArchitecture, loadRevision } from '../src/architecture-reader.ts'
import { GromaProfileError } from '../src/okf-profile.ts'
import type { FilesystemAccess } from '../src/types.ts'

const fixtureRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'validate')

async function copyPackage(t: TestContext): Promise<string> {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'groma-reader-'))
  await cp(fixtureRoot, temporaryRoot, { recursive: true })
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }))
  return temporaryRoot
}

test('loads deterministic revisions only after recognizing the marked OKF package', async () => {
  const revisions = await loadArchitecture(fixtureRoot)

  assert.deepEqual(revisions.map(record => record.revision), [
    { kind: 'observed', sourceDirectory: 'groma/observed' },
    { kind: 'missing', sourceDirectory: 'groma/missing' },
    { kind: 'plan', name: 'next', sourceDirectory: 'groma/plans/next' },
  ])
  assert.deepEqual(revisions.map(record => record.documents.length), [5, 1, 1])
  for (const record of revisions) {
    assert.equal(record.context.sourceFilename, `${record.revision.sourceDirectory}/index.md`)
    assert.deepEqual(Object.keys(record.context).sort(), [
      'body',
      'frontmatter',
      'nodes',
      'sourceFilename',
    ])
  }
  assert.ok(Object.isFrozen(revisions))
  assert.ok(Object.isFrozen(revisions[0]?.documents[0]?.frontmatter))
})

test('tolerates standard metadata and ignores unknown OKF concept types', async () => {
  const observed = await loadRevision(fixtureRoot, { kind: 'observed' })
  const buyer = observed.documents.find(document => document.frontmatter.title === 'Buyer')

  assert.equal(observed.documents.some(document => document.sourceFilename.endsWith('README.md')), false)
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

test('a selected revision reports both profile and revision reads', async () => {
  const accesses: Array<{ operation: FilesystemAccess['operation']; file: string }> = []
  await loadRevision(fixtureRoot, { kind: 'observed' }, {
    onFilesystemAccess(access) {
      accesses.push({
        operation: access.operation,
        file: path.relative(fixtureRoot, access.filename),
      })
    },
  })

  assert.ok(accesses.some(access => access.file === path.join('groma', 'index.md')))
  assert.ok(accesses.some(access => access.file === path.join('groma', 'project.md')))
  assert.ok(accesses.some(access => access.file === path.join('groma', 'observed')))
})

test('identifies a malformed C4 document as a Comark parse failure', async t => {
  const repositoryRoot = await copyPackage(t)
  const broken = path.join(repositoryRoot, 'groma', 'observed', 'actors', 'buyer.md')
  await writeFile(broken, '---\ntype: [broken\n---\n')

  await assert.rejects(loadRevision(repositoryRoot, { kind: 'observed' }), error => {
    assert.ok(error instanceof ArchitectureReadError)
    assert.equal(error.sourceFilename, 'groma/observed/actors/buyer.md')
    assert.equal(error.stage, 'parse')
    return true
  })
})
