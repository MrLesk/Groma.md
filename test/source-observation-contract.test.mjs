import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { parseFrontmatter } from 'comark'

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

async function readJson(filename) {
  return JSON.parse(await readFile(filename, 'utf8'))
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
    `  id: "${component.id}";`,
    `  name: "${component.name}";`,
    `  description: "${component.description}";`,
    `  technology: "${component.technology}";`,
    '};',
  ].join('\n')
}

function relationshipDeclaration(relationship) {
  return [
    '  {',
    `    sourceId: "${relationship.sourceId}";`,
    `    targetId: "${relationship.targetId}";`,
    `    description: "${relationship.description}";`,
    `    technology: "${relationship.technology}";`,
    '  },',
  ].join('\n')
}

function sourceRangeStart(sourceRange) {
  return Number(/:(\d+)-\d+$/.exec(sourceRange)?.[1])
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
    (await readdir(path.join(supportedRoot, 'src', 'components'))).sort(),
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
    assert.deepEqual(
      [...component.relationships].sort((left, right) => {
        return left.sourceId.localeCompare(right.sourceId)
          || left.targetId.localeCompare(right.targetId)
          || left.sourceRange.localeCompare(right.sourceRange)
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
    const reservedPrefix = [
      componentDeclaration(component),
      '',
      'export type GromaRelationships = [',
      ...sourceOrderedRelationships.map(relationshipDeclaration),
      '];',
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
    planIds.sort(),
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
