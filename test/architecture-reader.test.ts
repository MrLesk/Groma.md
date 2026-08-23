import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  ArchitectureReadError,
  loadArchitecture,
  loadRevision,
} from '../src/architecture-reader.ts'
import type { FilesystemAccess } from '../src/types.ts'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const fixtureRoot = path.join(repositoryRoot, 'test', 'fixtures', 'core-view')

test('loads observed, missing, and every plan as deterministic Comark-derived data', async () => {
  const revisions = await loadArchitecture(fixtureRoot)

  assert.deepEqual(
    revisions.map(({ revision }) => revision),
    [
      {
        kind: 'observed',
        sourceDirectory: 'groma/observed',
      },
      {
        kind: 'missing',
        sourceDirectory: 'groma/missing',
      },
      {
        kind: 'plan',
        name: 'checkout',
        sourceDirectory: 'groma/plans/checkout',
      },
      {
        kind: 'plan',
        name: 'inventory',
        sourceDirectory: 'groma/plans/inventory',
      },
    ],
  )
  assert.deepEqual(
    revisions.map(({ documents }) => documents.length),
    [4, 1, 1, 3],
  )

  for (const loadedRevision of revisions) {
    assert.deepEqual(
      Object.keys(loadedRevision.context).sort(),
      ['frontmatter', 'nodes', 'sourceFilename'],
    )
    assert.equal(
      loadedRevision.context.sourceFilename,
      `${loadedRevision.revision.sourceDirectory}/README.md`,
    )
    assert.ok(loadedRevision.context.nodes.length > 0)
    assert.deepEqual(loadedRevision.context.frontmatter, {})
    assert.ok(
      loadedRevision.documents.every(
        document => document.sourceFilename !== loadedRevision.context.sourceFilename,
      ),
    )

    for (const document of loadedRevision.documents) {
      assert.deepEqual(
        Object.keys(document).sort(),
        ['frontmatter', 'nodes', 'sourceFilename'],
      )
      assert.ok(Array.isArray(document.nodes))
      assert.equal(typeof document.frontmatter.id, 'string')
      assert.equal(typeof document.frontmatter.kind, 'string')
    }
  }

  assert.doesNotThrow(() => JSON.stringify(revisions))
  assert.ok(Object.isFrozen(revisions))
  assert.ok(Object.isFrozen(revisions[0]))
  assert.ok(Object.isFrozen(revisions[0].revision))
  assert.ok(Object.isFrozen(revisions[0].context.nodes))
  assert.ok(Object.isFrozen(revisions[0].documents[0].frontmatter))
})

test('keeps README and other prose as context rather than C4 documents', async () => {
  const revisions = await loadArchitecture(fixtureRoot)

  assert.deepEqual(
    revisions.map(({ context }) => context.sourceFilename),
    [
      'groma/observed/README.md',
      'groma/missing/README.md',
      'groma/plans/checkout/README.md',
      'groma/plans/inventory/README.md',
    ],
  )
  assert.ok(revisions.every(({ documents }) => {
    return documents.every(document => {
      return !document.sourceFilename.endsWith('/README.md')
        && !document.sourceFilename.endsWith('/notes.md')
    })
  }))
})

test('reports the selected revision filesystem read scope', async () => {
  const accesses: Array<{ operation: FilesystemAccess['operation']; path: string }> = []
  await loadRevision(
    fixtureRoot,
    { kind: 'observed' },
    {
      onFilesystemAccess(access) {
        accesses.push({
          operation: access.operation,
          path: path.relative(fixtureRoot, access.filename),
        })
      },
    },
  )

  assert.ok(accesses.length > 0)
  assert.deepEqual(
    [...new Set(accesses.map(access => access.operation))].sort(),
    ['read-directory', 'read-file'],
  )
  assert.ok(accesses.every(access => {
    return access.path === path.join('groma', 'observed')
      || access.path.startsWith(path.join('groma', 'observed', path.sep))
  }))
})

test('loads a plan named observed independently from the observed revision', async t => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'groma-reader-'))
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }))

  const fixtures = [
    ['groma/observed', 'observed-actor'],
    ['groma/plans/observed', 'planned-actor'],
  ]
  for (const [relativeRoot, id] of fixtures) {
    const revisionRoot = path.join(temporaryRoot, relativeRoot)
    await mkdir(path.join(revisionRoot, 'actors'), { recursive: true })
    await writeFile(path.join(revisionRoot, 'README.md'), `# ${id}\n`)
    await writeFile(
      path.join(revisionRoot, 'actors', `${id}.md`),
      `---\nid: ${id}\nkind: actor\n---\n\n# ${id}\n\nAn actor.\n`,
    )
  }
  await mkdir(path.join(temporaryRoot, 'groma', 'missing'), { recursive: true })
  await writeFile(
    path.join(temporaryRoot, 'groma', 'missing', 'README.md'),
    '# Missing\n',
  )

  const revisions = await loadArchitecture(temporaryRoot)

  assert.deepEqual(
    revisions.map(({ revision, context, documents }) => ({
      revision,
      context: context.sourceFilename,
      documentId: documents[0]?.frontmatter.id,
    })),
    [
      {
        revision: {
          kind: 'observed',
          sourceDirectory: 'groma/observed',
        },
        context: 'groma/observed/README.md',
        documentId: 'observed-actor',
      },
      {
        revision: {
          kind: 'missing',
          sourceDirectory: 'groma/missing',
        },
        context: 'groma/missing/README.md',
        documentId: undefined,
      },
      {
        revision: {
          kind: 'plan',
          name: 'observed',
          sourceDirectory: 'groma/plans/observed',
        },
        context: 'groma/plans/observed/README.md',
        documentId: 'planned-actor',
      },
    ],
  )
})

test('stops a revision load and identifies the repository-relative file Comark could not parse', async t => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'groma-reader-'))
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }))

  const revisionRoot = path.join(temporaryRoot, 'groma', 'observed')
  await mkdir(path.join(revisionRoot, 'actors'), { recursive: true })
  await writeFile(path.join(revisionRoot, 'README.md'), '# Observed\n')
  await writeFile(
    path.join(revisionRoot, 'actors', 'broken.md'),
    '---\nid: [broken\n---\n\n# Broken\n',
  )

  await assert.rejects(
    loadRevision(temporaryRoot, { kind: 'observed' }),
    error => {
      assert.ok(error instanceof ArchitectureReadError)
      assert.equal(error.sourceFilename, 'groma/observed/actors/broken.md')
      assert.equal(error.revision.kind, 'observed')
      assert.equal(error.stage, 'parse')
      assert.match(error.message, /groma\/observed\/actors\/broken\.md/)
      return true
    },
  )
})

test('reports filesystem failures without labeling them as Comark parse failures', async t => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'groma-reader-'))
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }))

  const revisionRoot = path.join(temporaryRoot, 'groma', 'observed')
  await mkdir(path.join(revisionRoot, 'actors'), { recursive: true })
  await writeFile(
    path.join(revisionRoot, 'actors', 'actor.md'),
    '---\nid: actor\nkind: actor\n---\n\n# Actor\n\nAn actor.\n',
  )

  await assert.rejects(
    loadRevision(temporaryRoot, { kind: 'observed' }),
    error => {
      assert.ok(error instanceof ArchitectureReadError)
      assert.equal(error.sourceFilename, 'groma/observed/README.md')
      assert.equal(error.stage, 'read')
      assert.ok(error.cause instanceof Error && 'code' in error.cause)
      assert.equal(error.cause.code, 'ENOENT')
      assert.match(error.message, /Could not read architecture Markdown/)
      assert.doesNotMatch(error.message, /Comark could not parse/)
      return true
    },
  )
})
