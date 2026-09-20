import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'

import os from 'node:os'
import path from 'node:path'
import { createScanObservation } from '@groma/scanner'

import { listTypeScriptFiles } from '../plugins/scanners/typescript/src/files.ts'
import { scanTypeScriptSource } from '../plugins/scanners/typescript/src/scan.ts'
import { loadArchitecture } from '../src/architecture-reader.ts'
import { requireGromaMapping } from '../src/okf-profile.ts'
import { upsertCode } from '../src/markdown-emitter.ts'
import { loadAnnotatedArchitecture, reconcileScanObservations } from '../src/core.ts'

const packageFiles = {
  'groma/index.md': '---\nokf_version: "0.2"\n---\n',
  'groma/project.md': `---
type: Groma Project
title: Shop architecture
groma:
  profile: architecture
---

Describes the shop used by scanner tests.
`,
  'groma/systems/shop/system.md': `---
type: C4 System
title: Shop
status: stable
groma:
  id: shop
---
`,
  'groma/systems/shop/containers/api/container.md': `---
type: C4 Container
title: Api
status: stable
groma:
  id: api
  parent: shop
---
`,
}

async function writeTree(root: string, files: Record<string, string>): Promise<void> {
  for (const [relative, source] of Object.entries(files)) {
    const filename = path.join(root, ...relative.split('/'))
    await mkdir(path.dirname(filename), { recursive: true })
    await writeFile(filename, source)
  }
}

async function temporaryTree(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-scanner-'))
  await writeTree(root, files)
  return root
}

async function gitAdd(root: string): Promise<void> {
  for (const args of [['init'], ['add', '-A']]) {
    const process = Bun.spawn(['git', ...args], { cwd: root, stdout: 'ignore', stderr: 'pipe' })
    const error = await new Response(process.stderr).text()
    expect(await process.exited, error).toBe(0)
  }
}

function observation(
  files: { file: string; symbols?: string[] }[],
) {
  return createScanObservation({
    scanner: { technology: 'fixture', id: 'typescript', engine: 'test', engineVersion: '1' },
    roots: [
      { id: 'root', kind: 'package', name: 'Shop', file: 'package.json' },
      { kind: 'project', parent: 'root', id: 'scope:src/api.ts', name: 'Api' },
    ],
    files: files.map(item => ({ roots: ['scope:src/api.ts'],
      file: item.file,
      symbols: (item.symbols ?? []).map(name => ({
        id: `${item.file}#${name}`,
        name,
        kind: 'function',
      })),
    })),
    diagnostics: [],
  })
}

test.concurrent('the shared contract validates and orders complete evidence', () => {
  const value = createScanObservation({
    scanner: { technology: 'fixture', id: 'test', engine: 'fixture', engineVersion: '1' },
    roots: [
      { id: 'root', kind: 'project', name: 'Fixture', file: 'fixture.proj' },
      { kind: 'project', parent: 'root', id: 'scope:b', name: 'B' },
      { kind: 'project', parent: 'root', id: 'scope:a', name: 'A' },
    ],
    files: [
      { roots: ['scope:b'], file: 'b.ts', symbols: [] },
      { roots: ['scope:a'], file: 'a.ts', symbols: [{ id: 'a.ts#run', name: 'run', kind: 'function' }] },
    ],
    diagnostics: [],
  })

  expect(value.files.map(file => file.file)).toEqual(['a.ts', 'b.ts'])
  expect(() => createScanObservation({
    ...value,
    files: [{ file: 'a.ts', roots: ['missing'], symbols: [] }],
  })).toThrow()
  expect(() => createScanObservation({ ...value, files: [{ file: 'a.ts', roots: [], symbols: [] }] }))
    .toThrow()
})

test.concurrent('TypeScript emits one file fact and separate inferred placement', async () => {
  const root = await temporaryTree({
    'package.json': JSON.stringify({ name: 'shop', bin: 'src/cli.ts' }),
    'src/cli.ts': "import { scan } from './scanner.ts'\nexport function run() { scan() }\n",
    'src/scanner.ts': "import { parse } from './parse.ts'\nexport function scan() { parse() }\n",
    'src/parse.ts': 'export function parse() {}\n',
    'src/unused.ts': 'export function unused() {}\n',
    'src/ignored.test.ts': 'export function ignored() {}\n',
    'test/helper.ts': 'export function helper() {}\n',
    'test-bun/helper.ts': 'export function bunHelper() {}\n',
  })
  try {
    await gitAdd(root)
    expect(await listTypeScriptFiles(root)).toEqual([
      'src/cli.ts',
      'src/parse.ts',
      'src/scanner.ts',
      'src/unused.ts',
    ])
    const result = await scanTypeScriptSource(root)
    expect(result?.files.map(file => file.file)).toEqual([
      'src/cli.ts',
      'src/parse.ts',
      'src/scanner.ts',
      'src/unused.ts',
    ])
    expect(result?.files.every(file => file.symbols.every(symbol => {
      return symbol.id.startsWith(`${file.file}#`)
    }))).toBeTrue()
    expect(result?.files.every(file => file.roots.length === 1)).toBeTrue()
    expect(result?.roots.some(root => root.id === 'scope:src/cli.ts' && root.parent === 'package')).toBeTrue()

  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('reconciliation keeps curated multi-file ownership and isolates new files', async () => {
  const profile = `---
type: C4 Component
title: Profile
status: stable
groma:
  id: profile
  parent: api
  code:
    - scanner: typescript
      file: src/profile.ts
      symbol: oldProfile
    - scanner: typescript
      file: src/profile-markdown.ts
      symbol: oldMarkdown
---

Curated responsibility.
`
  const root = await temporaryTree({
    ...packageFiles,
    'groma/systems/shop/containers/api/components/profile.md': profile,
  })
  try {
    const scan = observation([
      { file: 'src/api.ts', symbols: ['startApi'] },
      { file: 'src/profile.ts', symbols: ['readProfile'] },
      { file: 'src/profile-markdown.ts', symbols: ['parseProfileMarkdown'] },
      { file: 'src/new-helper.ts', symbols: ['help'] },
      { file: 'src/other/new-helper.ts', symbols: ['helpOther'] },
    ])
    const summary = await reconcileScanObservations(root, [scan])
    await reconcileScanObservations(root, [scan])

    expect(summary).toEqual({ created: 3, refreshed: 1, matched: 0 })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('reconciliation drops unreferenced missing Code files without changing authored architecture', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-code-refresh-'))
  try {
    await cp(path.resolve(import.meta.dir, '../test/fixtures/flows'), root, { recursive: true })
    const before = await loadAnnotatedArchitecture(root)
    const element = before.elements.find(item => item.code.length > 0)!
    const file = element.code[0]!.file
    const record = (await loadArchitecture(root)).documents.find(item => item.frontmatter.groma !== undefined && requireGromaMapping(item.frontmatter, item.sourceFilename).id === element.id)!
    await upsertCode(root, record.sourceFilename, [...element.code.map(({ scanner, file, symbol }) => ({ scanner, file, symbol })), { scanner: 'typescript', file: 'src/moved.fixture' }])
    await reconcileScanObservations(root, [observation([{ file }])])
    const after = await loadAnnotatedArchitecture(root)
    expect(after.elements.find(item => item.id === element.id)?.code.some(code => code.file === 'src/moved.fixture')).toBe(false)
    expect(after.elements.map(item => [item.id, item.parent, item.origin])).toEqual(before.elements.map(item => [item.id, item.parent, item.origin]))
    expect(after.relationships).toEqual(before.relationships)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('an observed name alone never claims an unknown file', async () => {
  const root = await temporaryTree({
    ...packageFiles,
    'groma/systems/shop/containers/api/components/orders.md': `---
type: C4 Component
title: Orders
status: stable
groma:
  id: orders
  parent: api
---

Curated without source evidence.
`,
  })
  try {
    const summary = await reconcileScanObservations(root, [observation([
      { file: 'src/orders.ts', symbols: ['placeOrder'] },
    ])])

    expect(summary).toEqual({ created: 1, refreshed: 0, matched: 0 })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('reconciliation qualifies reserved document names', async () => {
  const root = await temporaryTree(packageFiles)
  try {
    expect(await reconcileScanObservations(root, [observation([
      { file: 'src/index.ts' },
      { file: 'src/log.ts' },
    ])])).toEqual({ created: 2, refreshed: 0, matched: 0 })

    const qualified = (await loadArchitecture(root)).documents.flatMap(document => {
      if (!document.sourceFilename.includes('/components/src-')) return []
      const groma = document.frontmatter.groma as { id?: unknown }
      return [{
        id: groma.id,
        title: document.frontmatter.title,
        sourceFilename: document.sourceFilename,
      }]
    })
    expect(qualified).toEqual([
      {
        id: 'src-index',
        title: 'Index',
        sourceFilename: 'groma/systems/shop/containers/api/components/src-index.md',
      },
      {
        id: 'src-log',
        title: 'Log',
        sourceFilename: 'groma/systems/shop/containers/api/components/src-log.md',
      },
    ])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('an empty source project does not create architecture on repeat scans', async () => {
  const root = await temporaryTree({
    ...packageFiles,
  })
  const emptyProject = createScanObservation({
    scanner: { technology: 'fixture', id: 'csharp', engine: 'test', engineVersion: '1' },
    roots: [
      { id: 'root', kind: 'solution', name: 'Warehouse', file: 'Warehouse.sln' },
      { kind: 'project', parent: 'root', id: 'scope:Api/Api.csproj', name: 'Api' },
    ],
    files: [],
    diagnostics: [],
  })
  try {
    expect(await reconcileScanObservations(root, [emptyProject]))
      .toEqual({ created: 0, refreshed: 0, matched: 0 })
    expect(await reconcileScanObservations(root, [emptyProject]))
      .toEqual({ created: 0, refreshed: 0, matched: 0 })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
