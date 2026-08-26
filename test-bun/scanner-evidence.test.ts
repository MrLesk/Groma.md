import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { reconcileScanObservations } from '../src/core.ts'
import { isCSharpScanFile } from '../src/scanner/csharp/adapter.ts'
import {
  createScanObservation,
  parseScanObservation,
} from '../src/scanner/observation.ts'
import { listTypeScriptFiles } from '../src/scanner/typescript/files.ts'
import { scanTypeScriptSource } from '../src/scanner/typescript/scan.ts'

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
    'src/cli.ts': "import { scan } from './scanner.ts'\nexport function run() {}\n",
    'src/scanner.ts': "import { parse } from './parse.ts'\nexport function scan() {}\n",
    'src/parse.ts': 'export function parse() {}\n',
    'src/unused.ts': 'export function unused() {}\n',
    'src/ignored.test.ts': 'export function ignored() {}\n',
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
id: profile
kind: component
parent: api
code:
  - scanner: typescript
    file: src/profile.ts
    symbol: oldProfile
  - scanner: typescript
    file: src/profile-markdown.ts
    symbol: oldMarkdown
---

# Profile

Curated responsibility.
`
  const root = await temporaryTree({
    'groma/observed/README.md': '# Observed\n',
    'groma/missing/README.md': '# Missing\n',
    'groma/plans/README.md': '# Plans\n',
    'groma/observed/systems/shop/system.md': '---\nid: shop\nkind: system\n---\n\n# Shop\n',
    'groma/observed/systems/shop/containers/api/container.md': '---\nid: api\nkind: container\nparent: shop\n---\n\n# Api\n',
    'groma/observed/systems/shop/containers/api/components/profile.md': profile,
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
      path.join(root, 'groma/observed/systems/shop/containers/api/components/profile.md'),
      'utf8',
    )
    const added = await readFile(
      path.join(root, 'groma/observed/systems/shop/containers/api/components/new-helper.md'),
      'utf8',
    )
    const qualified = await readFile(
      path.join(root, 'groma/observed/systems/shop/containers/api/components/api-new-helper.md'),
      'utf8',
    )
    const scopeFile = await readFile(
      path.join(root, 'groma/observed/systems/shop/containers/api/components/api-api.md'),
      'utf8',
    )

    expect(summary).toEqual({ created: 3, refreshed: 1, matched: 0 })
    expect(curated.match(/file: src\/profile/g)).toHaveLength(2)
    expect(curated).toContain('symbol: readProfile')
    expect(curated).toContain('dependencies: 1')
    expect(curated).toContain('dependents: 2')
    expect(curated).toContain('symbol: parseProfileMarkdown')
    expect(curated).toContain('dependencies: 0')
    expect(curated).toContain('dependents: 1')
    expect(curated).toContain('Curated responsibility.')
    expect(added).toContain('file: src/new-helper.ts')
    expect(qualified).toContain('file: src/other/new-helper.ts')
    expect(scopeFile).toContain('file: src/api.ts')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('an observed name alone never claims an unknown file', async () => {
  const root = await temporaryTree({
    'groma/observed/README.md': '# Observed\n',
    'groma/missing/README.md': '# Missing\n',
    'groma/plans/README.md': '# Plans\n',
    'groma/observed/systems/shop/system.md': '---\nid: shop\nkind: system\n---\n\n# Shop\n',
    'groma/observed/systems/shop/containers/api/container.md': '---\nid: api\nkind: container\nparent: shop\n---\n\n# Api\n',
    'groma/observed/systems/shop/containers/api/components/orders.md': `---
id: orders
kind: component
parent: api
---

# Orders

Curated without source evidence.
`,
  })
  try {
    const summary = await reconcileScanObservations(root, [observation([
      { file: 'src/orders.ts', symbols: ['placeOrder'] },
    ])])
    const curated = await readFile(
      path.join(root, 'groma/observed/systems/shop/containers/api/components/orders.md'),
      'utf8',
    )
    const added = await readFile(
      path.join(root, 'groma/observed/systems/shop/containers/api/components/api-orders.md'),
      'utf8',
    )

    expect(summary).toEqual({ created: 1, refreshed: 0, matched: 0 })
    expect(curated).not.toContain('code:')
    expect(added).toContain('file: src/orders.ts')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('a qualified empty project container is reused on repeat scans', async () => {
  const root = await temporaryTree({
    'groma/observed/README.md': '# Observed\n',
    'groma/missing/README.md': '# Missing\n',
    'groma/plans/README.md': '# Plans\n',
    'groma/observed/systems/shop/system.md': '---\nid: shop\nkind: system\n---\n\n# Shop\n',
    'groma/observed/systems/shop/containers/api/container.md': '---\nid: api\nkind: container\nparent: shop\n---\n\n# Api\n',
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
      path.join(root, 'groma/observed/systems/warehouse/containers/warehouse-api/container.md'),
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
