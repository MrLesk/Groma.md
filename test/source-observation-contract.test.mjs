import assert from 'node:assert/strict'
import {
  cp,
  lstat,
  mkdtemp,
  realpath,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { parse, parseFrontmatter } from 'comark'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const fixtureRoot = path.join(
  repositoryRoot,
  'fixtures',
  'source-observation',
)
const supportedRoot = path.join(fixtureRoot, 'supported')
const unsupportedShapeError = {
  name: 'UnsupportedSourceShapeError',
  code: 'GROMA_UNSUPPORTED_SOURCE_SHAPE',
  message: 'Repository does not match groma.typescript-bun/v1.',
}

async function readJson(filename) {
  return JSON.parse(await readFile(filename, 'utf8'))
}

function throwUnsupportedShape() {
  const error = new Error(unsupportedShapeError.message)
  error.name = unsupportedShapeError.name
  error.code = unsupportedShapeError.code
  throw error
}

function isBeneath(root, candidate) {
  const relativePath = path.relative(root, candidate)
  return relativePath === ''
    || (
      relativePath !== '..'
      && !relativePath.startsWith(`..${path.sep}`)
      && !path.isAbsolute(relativePath)
    )
}

// This oracle validates one stable filesystem snapshot. It intentionally does
// not model concurrent ancestor replacement during validation or byte reads.
async function assertStableSnapshotPhysicalFixture(suppliedRoot) {
  let root
  try {
    root = await realpath(suppliedRoot)
    const rootStat = await lstat(root)
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
      throwUnsupportedShape()
    }

    async function requireEntry(relativePath, kind) {
      const filename = path.join(root, relativePath)
      const stat = await lstat(filename)
      if (
        stat.isSymbolicLink()
        || (kind === 'directory' && !stat.isDirectory())
        || (kind === 'file' && !stat.isFile())
      ) {
        throwUnsupportedShape()
      }
      const physicalPath = await realpath(filename)
      if (!isBeneath(root, physicalPath) || physicalPath !== filename) {
        throwUnsupportedShape()
      }
      return filename
    }

    await requireEntry('package.json', 'file')
    const srcRoot = await requireEntry('src', 'directory')
    await requireEntry('src/index.ts', 'file')
    await requireEntry('src/components', 'directory')

    async function inspectDirectory(directory) {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name)
        const relativePath = path.relative(root, entryPath)
        const stat = await lstat(entryPath)
        if (stat.isSymbolicLink()) {
          throwUnsupportedShape()
        }
        const physicalPath = await realpath(entryPath)
        if (!isBeneath(root, physicalPath) || physicalPath !== entryPath) {
          throwUnsupportedShape()
        }
        if (stat.isDirectory()) {
          await inspectDirectory(entryPath)
        } else if (
          path.dirname(relativePath) === path.join('src', 'components')
          && entry.name.endsWith('.ts')
        ) {
          await requireEntry(relativePath, 'file')
        }
      }
    }

    await inspectDirectory(srcRoot)
  } catch (error) {
    if (
      error?.name === unsupportedShapeError.name
      && error?.code === unsupportedShapeError.code
    ) {
      throw error
    }
    throwUnsupportedShape()
  }
}

async function createPhysicalProbe(t) {
  const temporaryRoot = await mkdtemp(
    path.join(os.tmpdir(), 'groma-source-contract-'),
  )
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }))
  const repository = path.join(temporaryRoot, 'repository')
  await cp(supportedRoot, repository, { recursive: true })
  return { temporaryRoot, repository }
}

function assertUnsupportedShape(error) {
  assert.equal(error?.name, unsupportedShapeError.name)
  assert.equal(error?.code, unsupportedShapeError.code)
  assert.equal(error?.message, unsupportedShapeError.message)
  return true
}

function isStrictUtf8WithoutBom(bytes) {
  if (
    bytes.length >= 3
    && bytes[0] === 0xef
    && bytes[1] === 0xbb
    && bytes[2] === 0xbf
  ) {
    return false
  }
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return true
  } catch {
    return false
  }
}

function isExactSourceBytes(bytes) {
  if (!isStrictUtf8WithoutBom(bytes)) {
    return false
  }
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  return source.endsWith('\n')
    && !source.includes('\r')
    && !source.includes('\u2028')
    && !source.includes('\u2029')
}

async function sourceRangeText(root, sourceRange) {
  const match = /^(?<filename>.+):(?<start>\d+)-(?<end>\d+)$/.exec(sourceRange)
  assert.ok(match, `invalid source range: ${sourceRange}`)

  const start = Number(match.groups.start)
  const end = Number(match.groups.end)
  assert.ok(start > 0 && end >= start, `invalid source lines: ${sourceRange}`)

  const source = await readFile(path.join(root, match.groups.filename), 'utf8')
  const lines = source.split('\n')
  assert.ok(end <= lines.length, `range exceeds source: ${sourceRange}`)
  return lines.slice(start - 1, end).join('\n')
}

function componentDeclaration(component) {
  return [
    'export type GromaComponent = {',
    `  id: ${JSON.stringify(component.id)};`,
    `  name: ${JSON.stringify(component.name)};`,
    `  description: ${JSON.stringify(component.description)};`,
    `  technology: ${JSON.stringify(component.technology)};`,
    '};',
  ].join('\n')
}

function relationshipDeclaration(relationship) {
  return [
    '  {',
    `    sourceId: ${JSON.stringify(relationship.sourceId)};`,
    `    targetId: ${JSON.stringify(relationship.targetId)};`,
    `    description: ${JSON.stringify(relationship.description)};`,
    `    technology: ${JSON.stringify(relationship.technology)};`,
    '  },',
  ].join('\n')
}

function sourceRangeStart(sourceRange) {
  return Number(/:(\d+)-\d+$/.exec(sourceRange)?.[1])
}

function bytewiseCompare(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'))
}

function isReadableText(value) {
  return typeof value === 'string'
    && value.length > 0
    && /^[\x20-\x7e]+$/.test(value)
    && value[0] !== ' '
    && value.at(-1) !== ' '
}

function escapeMarkdownText(value) {
  return [...value].map(character => {
    const codePoint = character.codePointAt(0)
    const isAsciiPunctuation = (
      (codePoint >= 0x21 && codePoint <= 0x2f)
      || (codePoint >= 0x3a && codePoint <= 0x40)
      || (codePoint >= 0x5b && codePoint <= 0x60)
      || (codePoint >= 0x7b && codePoint <= 0x7e)
    )
    return isAsciiPunctuation ? `\\${character}` : character
  }).join('')
}

function collectNodes(node, tag, nodes = []) {
  if (!Array.isArray(node)) {
    return nodes
  }

  const isAstNode = typeof node[0] === 'string'
  if (isAstNode && node[0] === tag) {
    nodes.push(node)
  }

  for (const child of isAstNode ? node.slice(2) : node) {
    collectNodes(child, tag, nodes)
  }
  return nodes
}

function nodeText(node) {
  if (typeof node === 'string') {
    return node
  }
  if (!Array.isArray(node)) {
    return ''
  }
  const children = typeof node[0] === 'string' ? node.slice(2) : node
  return children.map(nodeText).join('')
}

test('supported fixture has exact Bun markers and deterministic declaration evidence', async () => {
  const packageJson = await readJson(path.join(supportedRoot, 'package.json'))
  assert.equal(packageJson.private, true)
  assert.equal(packageJson.type, 'module')
  assert.equal(packageJson.engines.bun, '>=1.3.14')
  assert.equal(packageJson.scripts.start, 'bun run src/index.ts')

  const expected = await readJson(path.join(
    fixtureRoot,
    'supported.expected.json',
  ))
  assert.deepEqual(
    Object.keys(expected),
    ['contract', 'containerId', 'entryPoints', 'components'],
  )
  assert.equal(expected.contract, 'groma.typescript-bun/v1')
  assert.equal(expected.containerId, 'scanner')
  assert.deepEqual(
    expected.components.map(component => component.id),
    ['markdown-emitter', 'source-watcher', 'typescript-observer'],
  )
  assert.equal(expected.entryPoints.length, 1)
  const componentIds = new Set(
    expected.components.map(component => component.id),
  )
  assert.deepEqual(
    (await readdir(path.join(supportedRoot, 'src', 'components')))
      .sort(bytewiseCompare),
    expected.components.map(component => `${component.id}.ts`),
  )

  for (const entryPoint of expected.entryPoints) {
    assert.deepEqual(
      Object.keys(entryPoint),
      ['componentId', 'sourceRange'],
    )
    assert.equal(entryPoint.sourceRange, 'src/index.ts:1-3')
    const declaration = await sourceRangeText(supportedRoot, entryPoint.sourceRange)
    assert.equal(
      declaration,
      [
        'export type GromaEntryPoint = {',
        `  componentId: "${entryPoint.componentId}";`,
        '};',
      ].join('\n'),
    )
    assert.match(entryPoint.componentId, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    assert.ok(componentIds.has(entryPoint.componentId))

    const entrySource = await readFile(
      path.join(supportedRoot, 'src', 'index.ts'),
      'utf8',
    )
    assert.ok(entrySource.startsWith(`${declaration}\n`))
    assert.equal(entrySource.match(/\bGromaEntryPoint\b/g)?.length, 1)
    assert.doesNotMatch(entrySource, /\bGromaComponent\b|\bGromaRelationships\b/)
    assert.ok(entrySource.endsWith('\n'))
    assert.doesNotMatch(entrySource, /\r/)
  }

  for (const component of expected.components) {
    assert.deepEqual(
      Object.keys(component),
      [
        'id',
        'name',
        'description',
        'technology',
        'sourceRange',
        'relationships',
      ],
    )
    assert.equal(
      component.sourceRange,
      `src/components/${component.id}.ts:1-6`,
    )
    const declaration = await sourceRangeText(supportedRoot, component.sourceRange)
    assert.equal(declaration, componentDeclaration(component))
    assert.match(component.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    for (const field of ['name', 'description', 'technology']) {
      assert.equal(
        isReadableText(component[field]),
        true,
        `${component.id}.${field} must be readable text`,
      )
    }
    assert.deepEqual(
      [...component.relationships].sort((left, right) => {
        return bytewiseCompare(left.sourceId, right.sourceId)
          || bytewiseCompare(left.targetId, right.targetId)
          || bytewiseCompare(left.sourceRange, right.sourceRange)
      }),
      component.relationships,
    )

    for (const relationship of component.relationships) {
      assert.deepEqual(
        Object.keys(relationship),
        [
          'sourceId',
          'targetId',
          'description',
          'technology',
          'sourceRange',
        ],
      )
      assert.match(
        relationship.sourceRange,
        new RegExp(`^src/components/${component.id}\\.ts:\\d+-\\d+$`),
      )
      const evidence = await sourceRangeText(
        supportedRoot,
        relationship.sourceRange,
      )
      assert.equal(evidence, relationshipDeclaration(relationship))
      assert.equal(relationship.sourceId, component.id)
      assert.match(relationship.targetId, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      assert.equal(isReadableText(relationship.description), true)
      assert.equal(isReadableText(relationship.technology), true)
    }

    const componentSource = await readFile(
      path.join(supportedRoot, 'src', 'components', `${component.id}.ts`),
      'utf8',
    )
    const sourceOrderedRelationships = [...component.relationships]
      .sort((left, right) => {
        return sourceRangeStart(left.sourceRange)
          - sourceRangeStart(right.sourceRange)
      })
    const relationshipsDeclaration = component.relationships.length === 0
      ? 'export type GromaRelationships = [];'
      : [
          'export type GromaRelationships = [',
          ...sourceOrderedRelationships.map(relationshipDeclaration),
          '];',
        ].join('\n')
    const reservedPrefix = [
      componentDeclaration(component),
      '',
      relationshipsDeclaration,
    ].join('\n')
    assert.ok(
      componentSource.startsWith(`${reservedPrefix}\n`),
      `${component.id} does not use the exact reserved declaration prefix`,
    )
    assert.equal(
      componentSource.match(/\bGromaComponent\b/g)?.length,
      1,
    )
    assert.equal(
      componentSource.match(/\bGromaRelationships\b/g)?.length,
      1,
    )
    assert.ok(componentSource.endsWith('\n'))
    assert.doesNotMatch(componentSource, /\r/)
  }
})

test('supported fixture covers empty relationships and deterministic Markdown escaping', async () => {
  const expected = await readJson(path.join(
    fixtureRoot,
    'supported.expected.json',
  ))
  const markdownText = await readJson(path.join(
    fixtureRoot,
    'supported.expected-markdown-text.json',
  ))
  const component = expected.components.find(candidate => {
    return candidate.id === markdownText.componentId
  })
  assert.ok(component)
  assert.deepEqual(component.relationships, [])

  const emptyTupleSource = await readFile(
    path.join(
      supportedRoot,
      'src',
      'components',
      `${component.id}.ts`,
    ),
    'utf8',
  )
  assert.equal(
    emptyTupleSource.split('\n')[7],
    'export type GromaRelationships = [];',
  )

  assert.equal(escapeMarkdownText(component.name), markdownText.escapedName)
  assert.equal(markdownText.heading, `# ${markdownText.escapedName}`)
  assert.equal(
    escapeMarkdownText(component.description),
    markdownText.escapedDescription,
  )
  assert.equal(
    escapeMarkdownText(component.technology),
    markdownText.escapedTechnology,
  )

  const relationshipSource = expected.components.find(candidate => {
    return candidate.id === markdownText.relationshipSourceId
  })
  const relationship = relationshipSource.relationships.find(candidate => {
    return candidate.targetId === markdownText.relationshipTargetId
  })
  assert.ok(relationship)
  assert.equal(
    escapeMarkdownText(relationship.description),
    markdownText.escapedRelationshipDescription,
  )
  assert.equal(
    escapeMarkdownText(relationship.technology),
    markdownText.escapedRelationshipTechnology,
  )
  assert.equal(
    markdownText.relationshipTableRow,
    '| [Architecture workspace](../../architecture-workspace/container.md) '
      + `| ${markdownText.escapedRelationshipDescription} `
      + `| ${markdownText.escapedRelationshipTechnology} |`,
  )

  const linkLabelSource = expected.components.find(candidate => {
    return candidate.id === markdownText.linkLabelSourceId
  })
  const linkLabelTarget = expected.components.find(candidate => {
    return candidate.id === markdownText.linkLabelTargetId
  })
  const linkLabelRelationship = linkLabelSource.relationships.find(candidate => {
    return candidate.targetId === markdownText.linkLabelTargetId
  })
  assert.ok(linkLabelTarget)
  assert.ok(linkLabelRelationship)
  assert.equal(
    escapeMarkdownText(linkLabelTarget.name),
    markdownText.escapedLinkLabel,
  )
  assert.equal(
    markdownText.linkLabelTableRow,
    `| [${markdownText.escapedLinkLabel}](${markdownText.linkLabelHref}) `
      + `| ${escapeMarkdownText(linkLabelRelationship.description)} `
      + `| ${escapeMarkdownText(linkLabelRelationship.technology)} |`,
  )

  const markdown = [
    markdownText.heading,
    '',
    markdownText.escapedDescription,
    '',
    '## Technology',
    '',
    markdownText.escapedTechnology,
    '',
    '## Relationships',
    '',
    '| Target | Description | Technology |',
    '| --- | --- | --- |',
    markdownText.relationshipTableRow,
    markdownText.linkLabelTableRow,
  ].join('\n')
  const tree = await parse(markdown)
  assert.equal(nodeText(collectNodes(tree.nodes, 'h1')[0]), component.name)
  assert.deepEqual(
    collectNodes(tree.nodes, 'p').map(nodeText),
    [component.description, component.technology],
  )
  const tableRows = collectNodes(tree.nodes, 'tr')
  assert.equal(tableRows.length, 3)
  const relationshipCells = tableRows[1]
    .slice(2)
    .filter(child => child[0] === 'td')
  assert.equal(relationshipCells.length, 3)
  assert.equal(nodeText(relationshipCells[1]), relationship.description)
  assert.equal(nodeText(relationshipCells[2]), relationship.technology)

  const linkLabelCells = tableRows[2]
    .slice(2)
    .filter(child => child[0] === 'td')
  assert.equal(linkLabelCells.length, 3)
  const targetLink = collectNodes(linkLabelCells[0], 'a')[0]
  assert.equal(nodeText(targetLink), linkLabelTarget.name)
  assert.equal(targetLink[1].href, markdownText.linkLabelHref)
  assert.equal(
    nodeText(linkLabelCells[1]),
    linkLabelRelationship.description,
  )
  assert.equal(
    nodeText(linkLabelCells[2]),
    linkLabelRelationship.technology,
  )
})

test('readable text and bytewise ordering have explicit boundary behavior', () => {
  for (const accepted of [
    'Readable',
    'two words',
    'Markdown | \\ ` * _ [ ] ( ) < >',
  ]) {
    assert.equal(isReadableText(accepted), true, `expected accepted: ${accepted}`)
  }

  for (const rejected of [
    '',
    ' ',
    ' leading',
    'trailing ',
    '\u00a0leading',
    'trailing\u2003',
    'line\nbreak',
    'carriage\rreturn',
    'tab\ttext',
    'null\u0000text',
    'delete\u007ftext',
    'next\u0085line',
    'zero\u200bwidth',
    'bidi\u202econtrol',
    'line\u2028separator',
    'paragraph\u2029separator',
    'byte\uFEFForder',
    'private\ue000use',
    'München',
    '⭐️',
    '\ud800',
  ]) {
    assert.equal(isReadableText(rejected), false, `expected rejected: ${rejected}`)
  }

  assert.deepEqual(
    ['ä', 'z', 'a', 'aa'].sort(bytewiseCompare),
    ['a', 'aa', 'z', 'ä'],
  )
})

test('physical boundary validates one stable snapshot and rejects static inner links', async t => {
  const rootAliasProbe = await createPhysicalProbe(t)
  const rootAlias = path.join(rootAliasProbe.temporaryRoot, 'repository-alias')
  await symlink(rootAliasProbe.repository, rootAlias, 'dir')
  await assert.doesNotReject(assertStableSnapshotPhysicalFixture(rootAlias))
  assert.equal(
    isBeneath(
      rootAliasProbe.repository,
      `${rootAliasProbe.repository}-other${path.sep}file.ts`,
    ),
    false,
  )

  const outsideScopeTarget = path.join(
    rootAliasProbe.temporaryRoot,
    'outside-scope.txt',
  )
  await writeFile(outsideScopeTarget, 'outside scope\n')
  await symlink(
    outsideScopeTarget,
    path.join(rootAliasProbe.repository, 'docs-link.txt'),
    'file',
  )
  await assert.doesNotReject(
    assertStableSnapshotPhysicalFixture(rootAliasProbe.repository),
  )

  const cases = [
    {
      name: 'package file escaping outside',
      path: 'package.json',
      target: 'outside-package.json',
      type: 'file',
    },
    {
      name: 'source directory escaping outside',
      path: 'src',
      target: 'outside-src',
      type: 'dir',
    },
    {
      name: 'components ancestor escaping outside',
      path: 'src/components',
      target: 'outside-components',
      type: 'dir',
    },
    {
      name: 'entry file linking inside',
      path: 'src/index.ts',
      target: 'src/components/source-watcher.ts',
      type: 'file',
    },
    {
      name: 'component file escaping outside',
      path: 'src/components/source-watcher.ts',
      target: 'outside-component.ts',
      type: 'file',
    },
  ]

  for (const probeCase of cases) {
    const { temporaryRoot, repository } = await createPhysicalProbe(t)
    const linkPath = path.join(repository, probeCase.path)
    const targetPath = path.join(temporaryRoot, probeCase.target)
    const original = await lstat(linkPath)
    await rm(linkPath, { recursive: original.isDirectory(), force: true })

    if (probeCase.type === 'dir') {
      await cp(
        path.join(rootAliasProbe.repository, 'src'),
        targetPath,
        { recursive: true },
      )
    } else if (probeCase.target.startsWith('outside-')) {
      await writeFile(targetPath, '{}\n')
    }

    const symlinkTarget = probeCase.target.startsWith('outside-')
      ? targetPath
      : path.join(repository, probeCase.target)
    await symlink(symlinkTarget, linkPath, probeCase.type)
    await assert.rejects(
      assertStableSnapshotPhysicalFixture(repository),
      assertUnsupportedShape,
      probeCase.name,
    )
  }

  const nestedProbe = await createPhysicalProbe(t)
  const outsideIgnored = path.join(
    nestedProbe.temporaryRoot,
    'outside-readme.txt',
  )
  await writeFile(outsideIgnored, 'outside\n')
  await symlink(
    outsideIgnored,
    path.join(nestedProbe.repository, 'src', 'ignored.txt'),
    'file',
  )
  await assert.rejects(
    assertStableSnapshotPhysicalFixture(nestedProbe.repository),
    assertUnsupportedShape,
  )
})

test('source bytes reject BOM, non-LF separators, and malformed UTF-8', async () => {
  const packageBytes = await readFile(path.join(supportedRoot, 'package.json'))
  assert.equal(isStrictUtf8WithoutBom(packageBytes), true)

  const sourceBytes = await readFile(path.join(supportedRoot, 'src', 'index.ts'))
  assert.equal(isExactSourceBytes(sourceBytes), true)
  assert.equal(
    isStrictUtf8WithoutBom(Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      packageBytes,
    ])),
    false,
  )
  assert.equal(
    isExactSourceBytes(Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      sourceBytes,
    ])),
    false,
  )
  assert.equal(
    isExactSourceBytes(Buffer.from(
      sourceBytes.toString('utf8').replace('\n', '\r\n'),
    )),
    false,
  )
  assert.equal(
    isExactSourceBytes(Buffer.from(
      `${sourceBytes.toString('utf8').slice(0, -1)}\u2028\n`,
    )),
    false,
  )
  assert.equal(
    isExactSourceBytes(Buffer.from(
      `${sourceBytes.toString('utf8').slice(0, -1)}\u2029\n`,
    )),
    false,
  )
  assert.equal(
    isExactSourceBytes(Buffer.from([0x66, 0x6f, 0x80, 0x0a])),
    false,
  )
})

test('fixture IDs exactly match the plan-03 scanner components', async () => {
  const expected = await readJson(path.join(
    fixtureRoot,
    'supported.expected.json',
  ))
  const planComponentsRoot = path.join(
    repositoryRoot,
    'groma',
    'plans',
    '03-code-observation',
    'systems',
    'groma',
    'containers',
    'scanner',
    'components',
  )
  const planFiles = (await readdir(planComponentsRoot))
    .filter(filename => filename.endsWith('.md'))
    .sort()
  const planIds = []

  for (const filename of planFiles) {
    const source = await readFile(path.join(planComponentsRoot, filename), 'utf8')
    planIds.push(parseFrontmatter(source).data.id)
  }

  assert.deepEqual(
    expected.components.map(component => component.id),
    planIds.sort(bytewiseCompare),
  )
})

test('owned subtree has one hand-authored parent and no generated Markdown yet', async () => {
  const scannerRoot = path.join(
    repositoryRoot,
    'groma',
    'observed',
    'systems',
    'groma',
    'containers',
    'scanner',
  )
  const scanner = parseFrontmatter(
    await readFile(path.join(scannerRoot, 'container.md'), 'utf8'),
  ).data
  assert.deepEqual(scanner, {
    id: 'scanner',
    kind: 'container',
    parent: 'groma',
  })
  assert.deepEqual(
    await readdir(path.join(scannerRoot, 'components')),
    ['.gitkeep'],
  )
})

test('unsupported fixture offers no declaration to infer from ordinary classes', async () => {
  const entryPoint = await readFile(
    path.join(fixtureRoot, 'unsupported', 'src', 'index.ts'),
    'utf8',
  )
  const component = await readFile(
    path.join(
      fixtureRoot,
      'unsupported',
      'src',
      'components',
      'source-watcher.ts',
    ),
    'utf8',
  )

  assert.doesNotMatch(entryPoint, /\bGromaEntryPoint\b/)
  assert.doesNotMatch(component, /\bGromaComponent\b/)
  assert.match(component, /class SourceWatcher/)
})
