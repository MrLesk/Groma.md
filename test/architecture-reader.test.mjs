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
} from '../src/architecture-reader.mjs'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

test('loads observed and planned Markdown as deterministic Comark-derived data', async () => {
  const revisions = await loadArchitecture(repositoryRoot)

  assert.deepEqual(
    revisions.map(({ revision }) => revision),
    [
      {
        id: 'observed',
        kind: 'observed',
        sourceDirectory: 'groma/observed',
      },
      {
        id: '01-markdown-foundation',
        kind: 'plan',
        sourceDirectory: 'groma/plans/01-markdown-foundation',
      },
      {
        id: '02-live-viewer',
        kind: 'plan',
        sourceDirectory: 'groma/plans/02-live-viewer',
      },
      {
        id: '03-code-observation',
        kind: 'plan',
        sourceDirectory: 'groma/plans/03-code-observation',
      },
    ],
  )
  assert.deepEqual(
    revisions.map(({ documents }) => documents.length),
    [5, 5, 10, 15],
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

test('returns each plan README as revision context rather than a C4 document', async () => {
  const revisions = await loadArchitecture(repositoryRoot)
  const plans = revisions.filter(({ revision }) => revision.kind === 'plan')

  assert.deepEqual(
    plans.map(({ context }) => context.sourceFilename),
    [
      'groma/plans/01-markdown-foundation/README.md',
      'groma/plans/02-live-viewer/README.md',
      'groma/plans/03-code-observation/README.md',
    ],
  )
  assert.ok(plans.every(({ documents }) => {
    return documents.every(document => !document.sourceFilename.endsWith('/README.md'))
  }))
})

test('stops a revision load and identifies the repository-relative file Comark could not parse', async t => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'groma-reader-'))
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }))

  const revisionRoot = path.join(temporaryRoot, 'groma', 'observed')
  await mkdir(path.join(revisionRoot, 'people'), { recursive: true })
  await writeFile(path.join(revisionRoot, 'README.md'), '# Observed\n')
  await writeFile(
    path.join(revisionRoot, 'people', 'broken.md'),
    '---\nid: [broken\n---\n\n# Broken\n',
  )

  await assert.rejects(
    loadRevision(temporaryRoot, 'observed'),
    error => {
      assert.ok(error instanceof ArchitectureReadError)
      assert.equal(error.sourceFilename, 'groma/observed/people/broken.md')
      assert.equal(error.revision.id, 'observed')
      assert.match(error.message, /groma\/observed\/people\/broken\.md/)
      return true
    },
  )
})
