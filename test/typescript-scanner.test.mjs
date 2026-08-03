import assert from 'node:assert/strict'
import {
  appendFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  scanTypeScriptSource,
  UnsupportedSourceShapeError,
} from '../src/typescript-scanner.mjs'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const fixtureRoot = path.join(
  repositoryRoot,
  'fixtures',
  'scanners',
  'typescript',
)
const supportedRoot = path.join(fixtureRoot, 'supported')
const unsupportedRoot = path.join(fixtureRoot, 'unsupported')

async function readJson(filename) {
  return JSON.parse(await readFile(filename, 'utf8'))
}

async function assertUnsupportedRoot(root, options) {
  await assert.rejects(
    scanTypeScriptSource(root, options),
    error => {
      assert.ok(error instanceof UnsupportedSourceShapeError)
      assert.deepEqual(
        {
          name: error.name,
          code: error.code,
          message: error.message,
        },
        {
          name: 'UnsupportedSourceShapeError',
          code: 'GROMA_UNSUPPORTED_SOURCE_SHAPE',
          message: 'Repository does not match groma.scanner.typescript-bun/v1.',
        },
      )
      assert.equal(Object.hasOwn(error, 'components'), false)
      assert.equal(Object.hasOwn(error, 'relationships'), false)
      assert.equal(Object.hasOwn(error, 'entryPoints'), false)
      return true
    },
  )
}

test('scans the exact supported fixture with inclusive declaration evidence', async () => {
  const expected = await readJson(path.join(
    fixtureRoot,
    'supported.expected.json',
  ))

  const scanResult = await scanTypeScriptSource(supportedRoot)

  assert.deepEqual(scanResult, expected)
  assert.deepEqual(
    scanResult.entryPoints,
    [{
      componentId: 'source-watcher',
      sourceRange: 'src/index.ts:1-3',
    }],
  )
  assert.deepEqual(
    scanResult.components.map(component => ({
      id: component.id,
      sourceRange: component.sourceRange,
      relationships: component.relationships.map(relationship => ({
        sourceId: relationship.sourceId,
        targetId: relationship.targetId,
        sourceRange: relationship.sourceRange,
      })),
    })),
    [
      {
        id: 'markdown-emitter',
        sourceRange: 'src/components/markdown-emitter.ts:1-6',
        relationships: [],
      },
      {
        id: 'scanner-plugin',
        sourceRange: 'src/components/scanner-plugin.ts:1-6',
        relationships: [{
          sourceId: 'scanner-plugin',
          targetId: 'markdown-emitter',
          sourceRange: 'src/components/scanner-plugin.ts:9-14',
        }],
      },
      {
        id: 'source-watcher',
        sourceRange: 'src/components/source-watcher.ts:1-6',
        relationships: [
          {
            sourceId: 'source-watcher',
            targetId: 'architecture-workspace',
            sourceRange: 'src/components/source-watcher.ts:15-20',
          },
          {
            sourceId: 'source-watcher',
            targetId: 'scanner-plugin',
            sourceRange: 'src/components/source-watcher.ts:9-14',
          },
        ],
      },
    ],
  )
})

test('returns equivalent bytewise-ordered scan results on repeated reads', async () => {
  const first = await scanTypeScriptSource(supportedRoot)
  const second = await scanTypeScriptSource(supportedRoot)

  assert.deepEqual(second, first)
  assert.deepEqual(
    first.components.map(component => component.id),
    ['markdown-emitter', 'scanner-plugin', 'source-watcher'],
  )
  assert.deepEqual(
    first.components[2].relationships.map(({ targetId }) => targetId),
    ['architecture-workspace', 'scanner-plugin'],
  )
})

test('reads only bounded source files and never executes project text', async t => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'groma-scanner-'))
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }))
  await cp(supportedRoot, temporaryRoot, { recursive: true })
  await appendFile(
    path.join(temporaryRoot, 'src', 'index.ts'),
    'throw new Error("project code was executed");\n',
  )
  await mkdir(path.join(temporaryRoot, 'groma', 'plans'), { recursive: true })
  await writeFile(
    path.join(temporaryRoot, 'groma', 'plans', 'must-not-be-read.md'),
    '# Sentinel\n',
  )
  const accesses = []

  const scanResult = await scanTypeScriptSource(temporaryRoot, {
    onFilesystemAccess(access) {
      accesses.push({
        operation: access.operation,
        path: access.filename === temporaryRoot
          ? ''
          : path.relative(temporaryRoot, access.filename),
      })
    },
  })

  assert.equal(scanResult.contract, 'groma.scanner.typescript-bun/v1')
  assert.ok(accesses.length > 0)
  assert.deepEqual(
    [...new Set(accesses.map(({ operation }) => operation))].sort(),
    [
      'read-directory',
      'read-file',
    ],
  )
  assert.ok(accesses.every(access => {
    return access.path === ''
      || access.path === 'package.json'
      || access.path === 'src'
      || access.path.startsWith(`src${path.sep}`)
  }))
  assert.ok(accesses.every(access => !access.path.endsWith('.md')))
})

test('rejects the unsupported fixture with one exact all-or-nothing error', async () => {
  await assertUnsupportedRoot(unsupportedRoot)
})

test('rejects representative v1 violations without partial extraction', async t => {
  const cases = [
    {
      name: 'mismatched Bun package marker',
      mutate: async root => {
        const packageJson = await readJson(path.join(root, 'package.json'))
        packageJson.engines.bun = '>=1.3.13'
        await writeFile(
          path.join(root, 'package.json'),
          `${JSON.stringify(packageJson, null, 2)}\n`,
        )
      },
    },
    {
      name: 'additional TypeScript source path',
      mutate: async root => {
        await mkdir(path.join(root, 'src', 'nested'))
        await writeFile(
          path.join(root, 'src', 'nested', 'extra.tsx'),
          'export const extra = true\n',
        )
      },
    },
    {
      name: 'filename and declared component ID mismatch',
      mutate: async root => {
        const filename = path.join(
          root,
          'src',
          'components',
          'markdown-emitter.ts',
        )
        const source = await readFile(filename, 'utf8')
        await writeFile(
          filename,
          source.replace('id: "markdown-emitter"', 'id: "renamed-emitter"'),
        )
      },
    },
    {
      name: 'unresolved entry-point component ID',
      mutate: async root => {
        const filename = path.join(root, 'src', 'index.ts')
        const source = await readFile(filename, 'utf8')
        await writeFile(
          filename,
          source.replace('"source-watcher"', '"missing-component"'),
        )
      },
    },
    {
      name: 'invalid relationship target ID',
      mutate: async root => {
        const filename = path.join(
          root,
          'src',
          'components',
          'source-watcher.ts',
        )
        const source = await readFile(filename, 'utf8')
        await writeFile(
          filename,
          source.replace(
            'targetId: "architecture-workspace"',
            'targetId: "ArchitectureWorkspace"',
          ),
        )
      },
    },
    {
      name: 'decoded readable text with leading whitespace',
      mutate: async root => {
        const filename = path.join(
          root,
          'src',
          'components',
          'source-watcher.ts',
        )
        const source = await readFile(filename, 'utf8')
        await writeFile(
          filename,
          source.replace('name: "Source watcher"', 'name: " Source watcher"'),
        )
      },
    },
    {
      name: 'changed declaration trivia',
      mutate: async root => {
        const filename = path.join(
          root,
          'src',
          'components',
          'scanner-plugin.ts',
        )
        const source = await readFile(filename, 'utf8')
        await writeFile(
          filename,
          source.replace(
            'export type GromaComponent = {',
            'export  type GromaComponent = {',
          ),
        )
      },
    },
    {
      name: 'duplicate reserved identifier after the declaration',
      mutate: async root => {
        await appendFile(
          path.join(root, 'src', 'index.ts'),
          'type GromaEntryPoint = never;\n',
        )
      },
    },
    {
      name: 'CRLF source text',
      mutate: async root => {
        const filename = path.join(
          root,
          'src',
          'components',
          'markdown-emitter.ts',
        )
        const source = await readFile(filename, 'utf8')
        await writeFile(filename, source.replaceAll('\n', '\r\n'))
      },
    },
    {
      name: 'BOM-prefixed package JSON',
      mutate: async root => {
        const filename = path.join(root, 'package.json')
        const source = await readFile(filename)
        await writeFile(filename, Buffer.concat([
          Buffer.from([0xef, 0xbb, 0xbf]),
          source,
        ]))
      },
    },
    {
      name: 'BOM-prefixed entry source',
      mutate: async root => {
        const filename = path.join(root, 'src', 'index.ts')
        const source = await readFile(filename)
        await writeFile(filename, Buffer.concat([
          Buffer.from([0xef, 0xbb, 0xbf]),
          source,
        ]))
      },
    },
    {
      name: 'BOM-prefixed component source',
      mutate: async root => {
        const filename = path.join(
          root,
          'src',
          'components',
          'markdown-emitter.ts',
        )
        const source = await readFile(filename)
        await writeFile(filename, Buffer.concat([
          Buffer.from([0xef, 0xbb, 0xbf]),
          source,
        ]))
      },
    },
    {
      name: 'U+2028 line separator in opaque source',
      mutate: async root => {
        await appendFile(
          path.join(root, 'src', 'index.ts'),
          '\u2028\n',
        )
      },
    },
    {
      name: 'U+2029 paragraph separator in opaque source',
      mutate: async root => {
        await appendFile(
          path.join(
            root,
            'src',
            'components',
            'markdown-emitter.ts',
          ),
          '\u2029\n',
        )
      },
    },
    {
      name: 'invalid UTF-8 source text',
      mutate: async root => {
        await appendFile(
          path.join(root, 'src', 'index.ts'),
          Buffer.from([0xff]),
        )
      },
    },
  ]

  for (const fixtureCase of cases) {
    await t.test(fixtureCase.name, async subtest => {
      const temporaryRoot = await mkdtemp(
        path.join(os.tmpdir(), 'groma-scanner-invalid-'),
      )
      subtest.after(() => rm(temporaryRoot, {
        recursive: true,
        force: true,
      }))
      await cp(supportedRoot, temporaryRoot, { recursive: true })
      await fixtureCase.mutate(temporaryRoot)

      await assertUnsupportedRoot(temporaryRoot)
    })
  }
})
