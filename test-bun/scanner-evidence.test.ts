import { expect, test } from 'bun:test'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import {
  createScanObservation,
  parseScanObservation,
} from '@groma/scanner'

import {
  isCSharpScanFile,
  scanCSharpSource,
} from '../plugins/scanners/csharp/src/adapter.ts'
import { listTypeScriptFiles } from '../plugins/scanners/typescript/src/files.ts'
import { scanTypeScriptSource } from '../plugins/scanners/typescript/src/scan.ts'
import { loadArchitecture } from '../src/architecture-reader.ts'
import { reconcileScanObservations } from '../src/core.ts'

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
  relationships: { source: string; target: string; kind: string }[] = [],
) {
  return createScanObservation({
    scanner: { language: 'typescript', engine: 'test', engineVersion: '1' },
    root: { kind: 'package', name: 'Shop', file: 'package.json' },
    scopes: [{ id: 'scope:src/api.ts', name: 'Api' }],
    files: files.map(item => ({
      file: item.file,
      symbols: (item.symbols ?? []).map(name => ({
        id: `${item.file}#${name}`,
        name,
        kind: 'function',
      })),
    })),
    placements: files.map(item => ({ file: item.file, scope: 'scope:src/api.ts' })),
    relationships,
    diagnostics: [],
  })
}

test.concurrent('the shared contract validates and orders complete evidence', () => {
  const value = createScanObservation({
    scanner: { language: 'test', engine: 'fixture', engineVersion: '1' },
    root: { kind: 'project', name: 'Fixture', file: 'fixture.proj' },
    scopes: [{ id: 'scope:b', name: 'B' }, { id: 'scope:a', name: 'A' }],
    files: [
      { file: 'b.ts', symbols: [] },
      { file: 'a.ts', symbols: [{ id: 'a.ts#run', name: 'run', kind: 'function' }] },
    ],
    placements: [
      { file: 'b.ts', scope: 'scope:b' },
      { file: 'a.ts', scope: 'scope:a' },
    ],
    relationships: [{ source: 'scope:a', target: 'scope:b', kind: 'imports' }],
    diagnostics: [],
  })

  expect(value.complete).toBeTrue()
  expect(value.files.map(file => file.file)).toEqual(['a.ts', 'b.ts'])
  expect(parseScanObservation(JSON.stringify(value))).toEqual(value)
  expect(() => createScanObservation({
    ...value,
    placements: [{ file: 'missing.ts', scope: 'scope:a' }],
  })).toThrow('placement references unknown file')
  expect(() => createScanObservation({ ...value, placements: [] }))
    .toThrow('file has no placement')
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
    expect(result?.placements).toHaveLength(4)
    expect(result?.scopes.some(scope => scope.id === 'scope:src/cli.ts')).toBeTrue()
    expect(result?.relationships.filter(relationship => relationship.kind === 'source-dependency'))
      .toEqual([
        { source: 'src/cli.ts', target: 'src/scanner.ts', kind: 'source-dependency' },
        { source: 'src/scanner.ts', target: 'src/parse.ts', kind: 'source-dependency' },
      ])
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
    ], [
      { source: 'src/api.ts', target: 'src/profile.ts', kind: 'source-dependency' },
      { source: 'src/new-helper.ts', target: 'src/profile.ts', kind: 'source-dependency' },
      { source: 'src/profile.ts', target: 'src/profile-markdown.ts', kind: 'source-dependency' },
    ])
    const summary = await reconcileScanObservations(root, [scan])
    await reconcileScanObservations(root, [scan])
    const curated = await readFile(
      path.join(root, 'groma/systems/shop/containers/api/components/profile.md'),
      'utf8',
    )
    const added = await readFile(
      path.join(root, 'groma/systems/shop/containers/api/components/new-helper.md'),
      'utf8',
    )
    const qualified = await readFile(
      path.join(root, 'groma/systems/shop/containers/api/components/api-new-helper.md'),
      'utf8',
    )
    const scopeFile = await readFile(
      path.join(root, 'groma/systems/shop/containers/api/components/api-api.md'),
      'utf8',
    )

    expect(summary).toEqual({ created: 3, refreshed: 1, matched: 0 })
    expect(curated.match(/file: src\/profile/g)).toHaveLength(2)
    expect(curated).toContain('symbol: readProfile')
    expect(curated).toContain('symbol: parseProfileMarkdown')
    expect(curated).not.toMatch(/dependencyFiles:|dependencies:|dependents:/)
    expect(curated).toContain('Curated responsibility.')
    expect(added).toContain('file: src/new-helper.ts')
    expect(qualified).toContain('file: src/other/new-helper.ts')
    expect(scopeFile).toContain('file: src/api.ts')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('reconciliation drops missing Code files without changing authored architecture', async () => {
  const profilePath = 'groma/systems/shop/containers/api/components/profile.md'
  const legacyPath = 'groma/systems/shop/containers/api/components/legacy.md'
  const root = await temporaryTree({
    ...packageFiles,
    'src/profile.ts': 'export function readProfile() {}\n',
    [profilePath]: `---
type: C4 Component
title: Profile
status: stable
groma:
  id: profile
  parent: api
  group: Data
  code:
    - scanner: typescript
      file: src/profile.ts
      symbol: oldProfile
    - scanner: typescript
      file: src/moved-profile.ts
      symbol: movedProfile
---

Reads the customer profile.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Api](../container.md) | Shares the profile | Function call |
`,
    [legacyPath]: `---
type: C4 Component
title: Legacy
status: stable
groma:
  id: legacy
  parent: api
  code:
    - scanner: typescript
      file: src/legacy.ts
---

Keeps an authored responsibility after its only source file moves.
`,
  })
  try {
    const summary = await reconcileScanObservations(root, [observation([
      { file: 'src/profile.ts', symbols: ['readProfile'] },
    ])])
    const curated = await readFile(path.join(root, profilePath), 'utf8')
    const legacy = await readFile(path.join(root, legacyPath), 'utf8')

    expect(summary).toEqual({ created: 0, refreshed: 2, matched: 0 })
    expect(curated).toContain('file: src/profile.ts')
    expect(curated).not.toContain('src/moved-profile.ts')
    expect(curated).toContain('group: Data')
    expect(curated).toContain('Reads the customer profile.')
    expect(curated).toContain('| [Api](../container.md) | Shares the profile | Function call |')
    expect(legacy).not.toContain('src/legacy.ts')
    expect(legacy).toContain('Keeps an authored responsibility after its only source file moves.')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
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
    const curated = await readFile(
      path.join(root, 'groma/systems/shop/containers/api/components/orders.md'),
      'utf8',
    )
    const added = await readFile(
      path.join(root, 'groma/systems/shop/containers/api/components/api-orders.md'),
      'utf8',
    )

    expect(summary).toEqual({ created: 1, refreshed: 0, matched: 0 })
    expect(curated).not.toContain('code:')
    expect(added).toContain('file: src/orders.ts')
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
      if (!document.sourceFilename.includes('/components/api-')) return []
      const groma = document.frontmatter.groma as { id?: unknown }
      return [{
        id: groma.id,
        title: document.frontmatter.title,
        sourceFilename: document.sourceFilename,
      }]
    })
    expect(qualified).toEqual([
      {
        id: 'api-index',
        title: 'Api index',
        sourceFilename: 'groma/systems/shop/containers/api/components/api-index.md',
      },
      {
        id: 'api-log',
        title: 'Api log',
        sourceFilename: 'groma/systems/shop/containers/api/components/api-log.md',
      },
    ])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('a qualified empty project container is reused on repeat scans', async () => {
  const root = await temporaryTree({
    ...packageFiles,
  })
  const emptyProject = createScanObservation({
    scanner: { language: 'csharp', engine: 'test', engineVersion: '1' },
    root: { kind: 'solution', name: 'Warehouse', file: 'Warehouse.sln' },
    scopes: [{ id: 'scope:Api/Api.csproj', name: 'Api' }],
    files: [],
    placements: [],
    relationships: [],
    diagnostics: [],
  })
  try {
    expect(await reconcileScanObservations(root, [emptyProject]))
      .toEqual({ created: 2, refreshed: 0, matched: 0 })
    expect(await reconcileScanObservations(root, [emptyProject]))
      .toEqual({ created: 0, refreshed: 0, matched: 0 })
    expect(await readFile(
      path.join(root, 'groma/systems/warehouse/containers/warehouse-api/container.md'),
      'utf8',
    )).toContain('id: warehouse-api')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('C# watch evidence includes projects and excludes build output', () => {
  expect(isCSharpScanFile('src/Orders.cs')).toBeTrue()
  expect(isCSharpScanFile('Shop.csproj')).toBeTrue()
  expect(isCSharpScanFile('Shop.sln')).toBeTrue()
  expect(isCSharpScanFile('src/obj/Debug/Generated.cs')).toBeFalse()
  expect(isCSharpScanFile('src/bin/Debug/Generated.cs')).toBeFalse()
})

test.concurrent('C# adapter uses its plugin package and the shared contract', async () => {
  const expected = createScanObservation({
    scanner: { language: 'csharp', engine: 'test', engineVersion: '1' },
    root: { kind: 'project', name: 'Shop', file: 'Shop.csproj' },
    scopes: [{ id: 'scope:Shop.csproj', name: 'Shop' }],
    files: [],
    placements: [],
    relationships: [],
    diagnostics: [],
  })
  const root = await temporaryTree({
    'Shop.csproj': '<Project />',
    'dotnet-host.mjs': `#!/usr/bin/env node
const args = process.argv.slice(2).map(value => value.replaceAll('\\\\', '/'))
if (args[0] === 'build') {
  if (!args[1]?.endsWith('plugins/scanners/csharp/dotnet/Groma.CSharpScanner.csproj')) process.exit(2)
  process.exit(0)
}
if (!args[0]?.endsWith('plugins/scanners/csharp/dotnet/bin/Debug/net10.0/Groma.CSharpScanner.dll')) process.exit(3)
process.stdout.write(${JSON.stringify(JSON.stringify(expected))})
`,
  })
  try {
    const host = path.join(root, 'dotnet-host.mjs')
    await chmod(host, 0o755)
    expect(await scanCSharpSource(root, host)).toEqual(expected)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
