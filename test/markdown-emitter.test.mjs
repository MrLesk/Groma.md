import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { parse } from 'comark'

import { loadRevision } from '../src/architecture-reader.mjs'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const observationFixture = path.join(
  repositoryRoot,
  'fixtures',
  'source-observation',
  'supported.expected.json',
)
const ownedRelativePath = path.join(
  'groma',
  'observed',
  'systems',
  'groma',
  'containers',
  'scanner',
  'components',
)

const documents = {
  observedReadme: '# Observed architecture\n',
  person: `---
id: human-architect
kind: person
---

# Human architect

Shapes the system.
`,
  groma: `---
id: groma
kind: system
---

# Groma

Keeps architecture as Markdown.
`,
  scanner: `---
id: scanner
kind: container
parent: groma
---

# Scanner

Owns generated observations.
`,
  workspace: `---
id: architecture-workspace
kind: container
parent: groma
---

# Architecture workspace

Stores architecture files.
`,
  viewer: `---
id: viewer
kind: container
parent: groma
---

# Viewer

Displays architecture.
`,
  unrelatedComponent: `---
id: hand-authored-canvas
kind: component
parent: viewer
---

# Hand-authored canvas

Must remain byte-identical.
`,
}

async function readObservation() {
  return JSON.parse(await readFile(observationFixture, 'utf8'))
}

async function writeDocument(root, relativePath, source) {
  const filename = path.join(root, ...relativePath.split('/'))
  await mkdir(path.dirname(filename), { recursive: true })
  await writeFile(filename, source)
}

async function createRepository(t, { lockPlans = true } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-emitter-'))
  const plansRoot = path.join(root, 'groma', 'plans')
  t.after(async () => {
    await chmod(plansRoot, 0o700).catch(() => {})
    await rm(root, { recursive: true, force: true })
  })

  await writeDocument(root, 'groma/observed/README.md', documents.observedReadme)
  await writeDocument(
    root,
    'groma/observed/people/human-architect.md',
    documents.person,
  )
  await writeDocument(
    root,
    'groma/observed/systems/groma/system.md',
    documents.groma,
  )
  await writeDocument(
    root,
    'groma/observed/systems/groma/containers/scanner/container.md',
    documents.scanner,
  )
  await writeDocument(
    root,
    'groma/observed/systems/groma/containers/architecture-workspace/container.md',
    documents.workspace,
  )
  await writeDocument(
    root,
    'groma/observed/systems/groma/containers/viewer/container.md',
    documents.viewer,
  )
  await writeDocument(
    root,
    'groma/observed/systems/groma/containers/viewer/components/hand-authored-canvas.md',
    documents.unrelatedComponent,
  )
  await writeDocument(
    root,
    `${ownedRelativePath.split(path.sep).join('/')}/stale-owned.md`,
    '# Stale owned output\n',
  )
  await writeDocument(
    root,
    'groma/plans/secret/must-not-be-read.md',
    '# Inaccessible plan sentinel\n',
  )

  if (lockPlans) {
    await chmod(plansRoot, 0o000)
  }
  return realpath(root)
}

async function loadEmitter() {
  return import('../src/markdown-emitter.mjs')
}

async function snapshotDirectory(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const snapshot = {}

  for (const entry of entries.sort((left, right) => {
    return Buffer.compare(Buffer.from(left.name), Buffer.from(right.name))
  })) {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      Object.assign(snapshot, Object.fromEntries(
        Object.entries(await snapshotDirectory(filename))
          .map(([name, value]) => [`${entry.name}/${name}`, value]),
      ))
    } else {
      snapshot[entry.name] = await readFile(filename)
    }
  }
  return snapshot
}

async function snapshotUnownedObserved(root) {
  const observedRoot = path.join(root, 'groma', 'observed')
  const snapshot = await snapshotDirectory(observedRoot)
  const ownedPrefix = `${ownedRelativePath
    .split(path.sep)
    .slice(2)
    .join('/')}/`

  return Object.fromEntries(
    Object.entries(snapshot)
      .filter(([filename]) => !filename.startsWith(ownedPrefix)),
  )
}

test('emits canonical fixture Markdown while preserving every unowned path', async t => {
  const root = await createRepository(t)
  const observation = await readObservation()
  const beforeUnowned = await snapshotUnownedObserved(root)
  const accesses = []
  const { emitObservedComponents } = await loadEmitter()

  const result = await emitObservedComponents(root, observation, {
    onFilesystemAccess(access) {
      accesses.push({
        operation: access.operation,
        path: path.relative(root, access.filename),
      })
    },
  })

  assert.deepEqual(result, {
    componentIds: [
      'markdown-emitter',
      'source-watcher',
      'typescript-observer',
    ],
    outputDirectory: ownedRelativePath.split(path.sep).join('/'),
  })
  assert.deepEqual(
    (await readdir(path.join(root, ownedRelativePath))).sort((left, right) => {
      return Buffer.compare(Buffer.from(left), Buffer.from(right))
    }),
    [
      'markdown-emitter.md',
      'source-watcher.md',
      'typescript-observer.md',
    ],
  )
  assert.deepEqual(await snapshotUnownedObserved(root), beforeUnowned)
  assert.ok(accesses.length > 0)
  assert.ok(accesses.every(access => {
    return access.path !== path.join('groma', 'plans')
      && !access.path.startsWith(`groma${path.sep}plans${path.sep}`)
      && !access.path.startsWith(`fixtures${path.sep}`)
      && !access.path.startsWith(`src${path.sep}`)
  }))
  const mutationOperations = new Set([
    'make-directory',
    'make-temporary-directory',
    'remove',
    'rename',
    'rename-destination',
    'write-file',
  ])
  const mutationsOutsideOwned = accesses
    .filter(access => mutationOperations.has(access.operation))
    .filter(access => {
      return access.path !== ownedRelativePath
        && !access.path.startsWith(`${ownedRelativePath}${path.sep}`)
    })
  assert.deepEqual(mutationsOutsideOwned, [])

  const emitterSource = await readFile(
    path.join(root, ownedRelativePath, 'markdown-emitter.md'),
    'utf8',
  )
  assert.equal(emitterSource, [
    '---',
    'id: markdown-emitter',
    'kind: component',
    'parent: scanner',
    '---',
    '',
    '# Markdown \\| emitter \\\\ \\[safe\\]',
    '',
    'Writes \\*bounded\\* observations \\_without\\_ ambiguity\\.',
    '',
    '## Technology',
    '',
    'TypeScript \\| Bun \\`text\\`',
    '',
    '## Source evidence',
    '',
    '- Component: `src/components/markdown-emitter.ts:1-6`',
    '',
  ].join('\n'))

  const watcherSource = await readFile(
    path.join(root, ownedRelativePath, 'source-watcher.md'),
    'utf8',
  )
  assert.match(
    watcherSource,
    /\| \[Architecture workspace\]\(\.\.\/\.\.\/architecture-workspace\/container\.md\) \| Limits refreshes \\\| preserves \\\*other\\\* files \| Filesystem \\\\ boundary \|/,
  )
  assert.match(
    watcherSource,
    /\| \[TypeScript observer\]\(typescript-observer\.md\) \| Requests a fresh bounded observation \| In\\-process event \|/,
  )
  assert.match(
    watcherSource,
    /- Entry point: `src\/index\.ts:1-3`/,
  )
  assert.match(
    watcherSource,
    /- Relationship to `architecture-workspace`: `src\/components\/source-watcher\.ts:15-20`[\s\S]*- Relationship to `typescript-observer`: `src\/components\/source-watcher\.ts:9-14`/,
  )

  for (const filename of await readdir(path.join(root, ownedRelativePath))) {
    const source = await readFile(path.join(root, ownedRelativePath, filename), 'utf8')
    const tree = await parse(source)
    assert.deepEqual(Object.keys(tree.frontmatter).sort(), [
      'id',
      'kind',
      'parent',
    ])
    assert.equal(tree.frontmatter.kind, 'component')
    assert.equal(tree.frontmatter.parent, 'scanner')
    assert.ok(tree.nodes.some(node => node[0] === 'h2' && node[2] === 'Source evidence'))
    if (filename === 'source-watcher.md') {
      const table = tree.nodes.find(node => node[0] === 'table')
      const body = table.find(node => Array.isArray(node) && node[0] === 'tbody')
      assert.deepEqual(
        body.slice(2).map(row => row.slice(2).map(cell => cell[0])),
        [
          ['td', 'td', 'td'],
          ['td', 'td', 'td'],
        ],
      )
    }
  }

  const loaded = await loadRevision(root, { kind: 'observed' })
  const generatedDocuments = loaded.documents.filter(({ sourceFilename }) => {
    return sourceFilename.startsWith(
      `${ownedRelativePath.split(path.sep).join('/')}/`,
    )
  })
  assert.deepEqual(
    generatedDocuments.map(document => document.frontmatter.id),
    [
      'markdown-emitter',
      'source-watcher',
      'typescript-observer',
    ],
  )
})

test('repeated emission is byte-identical and removes stale owned files', async t => {
  const root = await createRepository(t)
  const observation = await readObservation()
  const { emitObservedComponents } = await loadEmitter()

  await emitObservedComponents(root, observation)
  const first = await snapshotDirectory(path.join(root, ownedRelativePath))
  await emitObservedComponents(root, observation)
  const second = await snapshotDirectory(path.join(root, ownedRelativePath))

  assert.deepEqual(second, first)
  assert.equal(Object.hasOwn(second, 'stale-owned.md'), false)
})

test('renders a self-relationship as a resolvable Markdown file link', async t => {
  const root = await createRepository(t)
  const observation = await readObservation()
  observation.components[0].relationships.push({
    sourceId: 'markdown-emitter',
    targetId: 'markdown-emitter',
    description: 'Checks its own output',
    technology: 'Local link',
    sourceRange: 'src/components/markdown-emitter.ts:9-14',
  })
  const { emitObservedComponents } = await loadEmitter()

  await emitObservedComponents(root, observation)

  const source = await readFile(
    path.join(root, ownedRelativePath, 'markdown-emitter.md'),
    'utf8',
  )
  assert.match(
    source,
    /\[Markdown \\\| emitter \\\\ \\\[safe\\\]\]\(markdown-emitter\.md\)/,
  )
  const loaded = await loadRevision(root, { kind: 'observed' })
  assert.ok(loaded.documents.some(document => {
    return document.frontmatter.id === 'markdown-emitter'
  }))
})

test('target-resolution failure leaves owned and unowned data unchanged', async t => {
  const root = await createRepository(t)
  const observation = await readObservation()
  observation.components[1].relationships[0].targetId = 'missing-target'
  const beforeObserved = await snapshotDirectory(path.join(root, 'groma', 'observed'))
  const { emitObservedComponents } = await loadEmitter()

  await assert.rejects(
    emitObservedComponents(root, observation),
    /missing relationship target missing-target/,
  )

  assert.deepEqual(
    await snapshotDirectory(path.join(root, 'groma', 'observed')),
    beforeObserved,
  )
})

test('replacement failure rolls owned files back and preserves all observed data', async t => {
  const root = await createRepository(t)
  const observation = await readObservation()
  const beforeObserved = await snapshotDirectory(path.join(root, 'groma', 'observed'))
  const failingDestination = path.join(
    root,
    ownedRelativePath,
    'source-watcher.md',
  )
  const { emitObservedComponents } = await loadEmitter()
  let injected = false

  await assert.rejects(
    emitObservedComponents(root, observation, {
      onFilesystemAccess(access) {
        if (
          !injected
          && access.operation === 'rename-destination'
          && access.filename === failingDestination
        ) {
          injected = true
          throw new Error('injected replacement failure')
        }
      },
    }),
    /could not replace the owned components directory/,
  )

  assert.equal(injected, true)
  assert.deepEqual(
    await snapshotDirectory(path.join(root, 'groma', 'observed')),
    beforeObserved,
  )
})

test('partial backup cleanup never rolls a committed replacement back', async t => {
  const root = await createRepository(t)
  const observation = await readObservation()
  await writeDocument(
    root,
    `${ownedRelativePath.split(path.sep).join('/')}/second-stale.md`,
    '# Second stale owned output\n',
  )
  const { emitObservedComponents } = await loadEmitter()
  let injected = false

  await emitObservedComponents(root, observation, {
    onFilesystemAccess(access) {
      if (
        !injected
        && access.operation === 'remove'
        && path.basename(access.filename)
          .startsWith('.groma-components-transaction-')
      ) {
        injected = true
        rmSync(
          path.join(access.filename, 'backup', 'second-stale.md'),
          { force: true },
        )
        throw new Error('injected partial cleanup failure')
      }
    },
  })

  assert.equal(injected, true)
  assert.deepEqual(
    (await readdir(path.join(root, ownedRelativePath))).sort(),
    [
      'markdown-emitter.md',
      'source-watcher.md',
      'typescript-observer.md',
    ],
  )
})

test('generated IDs cannot duplicate canonical observed elements', async t => {
  const root = await createRepository(t)
  const observation = await readObservation()
  await writeDocument(
    root,
    'groma/observed/systems/groma/containers/viewer/components/duplicate.md',
    `---
id: markdown-emitter
kind: component
parent: viewer
---

# Existing Markdown emitter

Conflicts with generated identity.
`,
  )
  const beforeObserved = await snapshotDirectory(path.join(root, 'groma', 'observed'))
  const { emitObservedComponents } = await loadEmitter()

  await assert.rejects(
    emitObservedComponents(root, observation),
    /duplicate observed element id markdown-emitter/,
  )
  assert.deepEqual(
    await snapshotDirectory(path.join(root, 'groma', 'observed')),
    beforeObserved,
  )
})

test('a noncanonical observed document cannot satisfy a relationship target', async t => {
  const root = await createRepository(t)
  const observation = await readObservation()
  await writeDocument(
    root,
    'groma/observed/systems/groma/containers/architecture-workspace/container.md',
    `---
id: architecture-workspace
kind: container
parent: groma
---

# Architecture workspace

## Technology

Markdown.
`,
  )
  const beforeObserved = await snapshotDirectory(path.join(root, 'groma', 'observed'))
  const { emitObservedComponents } = await loadEmitter()

  await assert.rejects(
    emitObservedComponents(root, observation),
    /requires prose immediately after its level-one heading/,
  )
  assert.deepEqual(
    await snapshotDirectory(path.join(root, 'groma', 'observed')),
    beforeObserved,
  )
})

test('rejects a linked owned target without changing its destination', async t => {
  const root = await createRepository(t)
  const observation = await readObservation()
  const ownedRoot = path.join(root, ownedRelativePath)
  const outsideOwned = path.join(root, 'outside-owned')
  await mkdir(outsideOwned)
  await writeFile(path.join(outsideOwned, 'sentinel.md'), '# Outside\n')
  await rm(ownedRoot, { recursive: true })
  await symlink(outsideOwned, ownedRoot, 'dir')
  const beforeOutside = await snapshotDirectory(outsideOwned)
  const { emitObservedComponents } = await loadEmitter()

  await assert.rejects(
    emitObservedComponents(root, observation),
    /owned components path must be a real directory/,
  )

  assert.equal((await lstat(ownedRoot)).isSymbolicLink(), true)
  assert.deepEqual(await snapshotDirectory(outsideOwned), beforeOutside)
})
