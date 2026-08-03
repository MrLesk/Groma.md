import assert from 'node:assert/strict'
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
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
const scanResultFixture = path.join(
  repositoryRoot,
  'fixtures',
  'scanners',
  'typescript',
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
const mutationOperations = new Set([
  'remove',
  'write-file',
])

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

Owns scanner-generated components.
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

async function readScanResult() {
  return JSON.parse(await readFile(scanResultFixture, 'utf8'))
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
  const scanResult = await readScanResult()
  const beforeUnowned = await snapshotUnownedObserved(root)
  const accesses = []
  const { emitObservedComponents } = await loadEmitter()

  const result = await emitObservedComponents(root, scanResult, {
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
      'scanner-plugin',
      'source-watcher',
    ],
    outputDirectory: ownedRelativePath.split(path.sep).join('/'),
  })
  assert.deepEqual(
    (await readdir(path.join(root, ownedRelativePath))).sort((left, right) => {
      return Buffer.compare(Buffer.from(left), Buffer.from(right))
    }),
    [
      'markdown-emitter.md',
      'scanner-plugin.md',
      'source-watcher.md',
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
  const mutationsOutsideOwned = accesses
    .filter(access => mutationOperations.has(access.operation))
    .filter(access => {
      return access.path !== ownedRelativePath
        && !access.path.startsWith(`${ownedRelativePath}${path.sep}`)
    })
  assert.deepEqual(mutationsOutsideOwned, [])
  assert.deepEqual(
    [...new Set(accesses
      .filter(access => mutationOperations.has(access.operation))
      .map(access => access.operation))].sort(),
    ['remove', 'write-file'],
  )

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
    'Writes \\*bounded\\* scan results \\_without\\_ ambiguity\\.',
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
    /\| \[Architecture workspace\]\(\.\.\/\.\.\/architecture-workspace\/container\.md\) \| Limits scanner output \\\| preserves \\\*other\\\* files \| Filesystem \\\\ boundary \|/,
  )
  assert.match(
    watcherSource,
    /\| \[Scanner plugin\]\(scanner-plugin\.md\) \| Requests a fresh bounded scan result \| In\\-process event \|/,
  )
  assert.match(
    watcherSource,
    /- Entry point: `src\/index\.ts:1-3`/,
  )
  assert.match(
    watcherSource,
    /- Relationship to `architecture-workspace`: `src\/components\/source-watcher\.ts:15-20`[\s\S]*- Relationship to `scanner-plugin`: `src\/components\/source-watcher\.ts:9-14`/,
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
      'scanner-plugin',
      'source-watcher',
    ],
  )
})

test('repeated emission is byte-identical and removes stale owned files', async t => {
  const root = await createRepository(t)
  const scanResult = await readScanResult()
  const { emitObservedComponents } = await loadEmitter()

  await emitObservedComponents(root, scanResult)
  const first = await snapshotDirectory(path.join(root, ownedRelativePath))
  await emitObservedComponents(root, scanResult)
  const second = await snapshotDirectory(path.join(root, ownedRelativePath))

  assert.deepEqual(second, first)
  assert.equal(Object.hasOwn(second, 'stale-owned.md'), false)
})

test('renders a self-relationship as a resolvable Markdown file link', async t => {
  const root = await createRepository(t)
  const scanResult = await readScanResult()
  scanResult.components[0].relationships.push({
    sourceId: 'markdown-emitter',
    targetId: 'markdown-emitter',
    description: 'Checks its own output',
    technology: 'Local link',
    sourceRange: 'src/components/markdown-emitter.ts:9-14',
  })
  const { emitObservedComponents } = await loadEmitter()

  await emitObservedComponents(root, scanResult)

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
  const scanResult = await readScanResult()
  scanResult.components[1].relationships[0].targetId = 'missing-target'
  const beforeObserved = await snapshotDirectory(path.join(root, 'groma', 'observed'))
  const { emitObservedComponents } = await loadEmitter()

  await assert.rejects(
    emitObservedComponents(root, scanResult),
    /missing relationship target missing-target/,
  )

  assert.deepEqual(
    await snapshotDirectory(path.join(root, 'groma', 'observed')),
    beforeObserved,
  )
})

test('generated IDs cannot duplicate canonical observed elements', async t => {
  const root = await createRepository(t)
  const scanResult = await readScanResult()
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
    emitObservedComponents(root, scanResult),
    /duplicate observed element id markdown-emitter/,
  )
  assert.deepEqual(
    await snapshotDirectory(path.join(root, 'groma', 'observed')),
    beforeObserved,
  )
})

test('a decoded newline in a target heading rejects before any mutation', async t => {
  const root = await createRepository(t)
  const scanResult = await readScanResult()
  await writeDocument(
    root,
    'groma/observed/systems/groma/containers/architecture-workspace/container.md',
    `---
id: architecture-workspace
kind: container
parent: groma
---

# Architecture &#10; workspace

Stores architecture files.
`,
  )
  const beforeObserved = await snapshotDirectory(path.join(root, 'groma', 'observed'))
  const { emitObservedComponents } = await loadEmitter()
  const accesses = []

  const error = await emitObservedComponents(root, scanResult, {
    onFilesystemAccess(access) {
      accesses.push(access)
    },
  }).then(
    () => null,
    emissionError => emissionError,
  )
  const afterObserved = await snapshotDirectory(path.join(root, 'groma', 'observed'))

  assert.match(
    error?.message ?? '',
    /requires a single-line readable name/,
  )
  assert.equal(
    accesses.some(access => mutationOperations.has(access.operation)),
    false,
  )
  assert.deepEqual(afterObserved, beforeObserved)
})

test('an invisible format control target heading rejects before any mutation', async t => {
  const root = await createRepository(t)
  const scanResult = await readScanResult()
  await writeDocument(
    root,
    'groma/observed/systems/groma/containers/architecture-workspace/container.md',
    `---
id: architecture-workspace
kind: container
parent: groma
---

# &#8203;

Stores architecture files.
`,
  )
  const beforeObserved = await snapshotDirectory(path.join(root, 'groma', 'observed'))
  const { emitObservedComponents } = await loadEmitter()
  const accesses = []

  const error = await emitObservedComponents(root, scanResult, {
    onFilesystemAccess(access) {
      accesses.push(access)
    },
  }).then(
    () => null,
    emissionError => emissionError,
  )
  const afterObserved = await snapshotDirectory(path.join(root, 'groma', 'observed'))

  assert.match(
    error?.message ?? '',
    /requires a single-line readable name/,
  )
  assert.equal(
    accesses.some(access => mutationOperations.has(access.operation)),
    false,
  )
  assert.deepEqual(afterObserved, beforeObserved)
})
