import assert from 'node:assert/strict'
import { access, cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { parse } from 'comark'

import { validateRepository, validateRevision } from '../scripts/validate-architecture.mjs'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const foundationRoot = path.join(
  repositoryRoot,
  'groma',
  'plans',
  '01-markdown-foundation',
)

async function createFoundationFixture(t) {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'groma-validation-'))
  const revisionRoot = path.join(temporaryRoot, 'revision')
  await cp(foundationRoot, revisionRoot, { recursive: true })
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }))
  return revisionRoot
}

async function replaceInFile(file, search, replacement) {
  const source = await readFile(file, 'utf8')
  assert.ok(source.includes(search), `${file} does not contain the test input`)
  await writeFile(file, source.replace(search, replacement))
}

function collectLinkTargets(node, targets = []) {
  if (!Array.isArray(node)) {
    return targets
  }

  const isAstNode = typeof node[0] === 'string'
  if (isAstNode && node[0] === 'a' && node[1]?.href) {
    targets.push(node[1].href)
  }

  for (const child of isAstNode ? node.slice(2) : node) {
    collectLinkTargets(child, targets)
  }

  return targets
}

test('validates observed and every planned revision', async () => {
  const results = await validateRepository(repositoryRoot)

  assert.deepEqual(
    results.map(result => path.relative(repositoryRoot, result.revisionRoot)),
    [
      'groma/observed',
      'groma/plans/01-markdown-foundation',
      'groma/plans/02-live-viewer',
      'groma/plans/03-code-observation',
    ],
  )
  assert.deepEqual(results.map(result => result.elementCount), [5, 5, 10, 15])
})

test('observed index links readers to the Markdown foundation', async () => {
  const observedRoot = path.join(repositoryRoot, 'groma', 'observed')
  const indexFile = path.join(observedRoot, 'README.md')
  const tree = await parse(await readFile(indexFile, 'utf8'))
  const targets = new Set(collectLinkTargets(tree.nodes))
  const foundationTargets = [
    'systems/groma/system.md',
    'people/human-architect.md',
    'people/coding-agent.md',
    'systems/groma/containers/architecture-workspace/container.md',
    'systems/git/system.md',
  ]

  for (const target of foundationTargets) {
    assert.ok(targets.has(target), `observed index is missing ${target}`)
    await access(path.resolve(observedRoot, target))
  }
})

test('rejects duplicate stable IDs', async t => {
  const revisionRoot = await createFoundationFixture(t)
  const gitFile = path.join(revisionRoot, 'systems', 'git', 'system.md')
  await replaceInFile(gitFile, 'id: git', 'id: groma')

  await assert.rejects(
    validateRevision(revisionRoot),
    /duplicate id "groma"/,
  )
})

test('rejects unknown parent IDs', async t => {
  const revisionRoot = await createFoundationFixture(t)
  const workspaceFile = path.join(
    revisionRoot,
    'systems',
    'groma',
    'containers',
    'architecture-workspace',
    'container.md',
  )
  await replaceInFile(workspaceFile, 'parent: groma', 'parent: missing-system')

  await assert.rejects(
    validateRevision(revisionRoot),
    /unknown parent id "missing-system"/,
  )
})

test('rejects invalid C4 containment', async t => {
  const revisionRoot = await createFoundationFixture(t)
  const workspaceFile = path.join(
    revisionRoot,
    'systems',
    'groma',
    'containers',
    'architecture-workspace',
    'container.md',
  )
  await replaceInFile(workspaceFile, 'parent: groma', 'parent: human-architect')

  await assert.rejects(
    validateRevision(revisionRoot),
    /invalid C4 containment; container "architecture-workspace" requires a system parent/,
  )
})

test('rejects broken relationship links', async t => {
  const revisionRoot = await createFoundationFixture(t)
  const workspaceFile = path.join(
    revisionRoot,
    'systems',
    'groma',
    'containers',
    'architecture-workspace',
    'container.md',
  )
  await replaceInFile(
    workspaceFile,
    '../../../git/system.md',
    '../../../git/missing.md',
  )

  await assert.rejects(
    validateRevision(revisionRoot),
    /broken relationship link "\.\.\/\.\.\/\.\.\/git\/missing\.md"/,
  )
})

test('rejects relationship targets without a Markdown extension', async t => {
  const revisionRoot = await createFoundationFixture(t)
  const workspaceFile = path.join(
    revisionRoot,
    'systems',
    'groma',
    'containers',
    'architecture-workspace',
    'container.md',
  )
  await replaceInFile(
    workspaceFile,
    '../../../git/system.md',
    '../../../git/system',
  )

  await assert.rejects(
    validateRevision(revisionRoot),
    /relationship target must be a relative Markdown link "\.\.\/\.\.\/\.\.\/git\/system"/,
  )
})

test('rejects absolute relationship target URLs', async t => {
  const revisionRoot = await createFoundationFixture(t)
  const workspaceFile = path.join(
    revisionRoot,
    'systems',
    'groma',
    'containers',
    'architecture-workspace',
    'container.md',
  )
  await replaceInFile(
    workspaceFile,
    '../../../git/system.md',
    'https://example.com/git.md',
  )

  await assert.rejects(
    validateRevision(revisionRoot),
    /relationship target must be a relative Markdown link "https:\/\/example\.com\/git\.md"/,
  )
})

test('rejects an element without a level-one heading', async t => {
  const revisionRoot = await createFoundationFixture(t)
  const gitFile = path.join(revisionRoot, 'systems', 'git', 'system.md')
  await replaceInFile(gitFile, '# Git\n\n', '')

  await assert.rejects(
    validateRevision(revisionRoot),
    /requires one level-one heading/,
  )
})

test('rejects an element without prose immediately after its heading', async t => {
  const revisionRoot = await createFoundationFixture(t)
  const gitFile = path.join(revisionRoot, 'systems', 'git', 'system.md')
  await replaceInFile(
    gitFile,
    '\n# Git\n\nKeeps history, diffs, and collaboration for the architecture files.\n',
    '\n# Git\n',
  )

  await assert.rejects(
    validateRevision(revisionRoot),
    /requires prose immediately after its level-one heading/,
  )
})
