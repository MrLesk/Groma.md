import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { buildImportGraph } from '../plugins/scanners/typescript/src/graph.ts'
import { scanTypeScriptSource } from '../plugins/scanners/typescript/src/scan.ts'

/** A monorepo as a fresh checkout has it: no node_modules and no build output. */
async function monorepo(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-ts-workspace-'))
  for (const [file, text] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), text)
  }
  expect(await Bun.spawn(['git', 'init', '--quiet'], { cwd: root }).exited).toBe(0)
  return root
}

const json = (value: unknown) => JSON.stringify(value)
const built = json({ compilerOptions: { outDir: 'dist', rootDir: 'src', module: 'ESNext', moduleResolution: 'Bundler' }, include: ['src'] })

test.concurrent('a bare import of a repository package resolves to its source through built exports, subpaths and source exports', async () => {
  const root = await monorepo({
    'packages/api/package.json': json({ name: '@acme/api', exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' } } }),
    'packages/api/tsconfig.json': built,
    'packages/api/src/index.ts': 'export function listPosts(): string[] { return [] }\n',
    // A condition whose target names no file gives way to the next, as TypeScript resolves them.
    'packages/ui/package.json': json({ name: '@acme/ui', exports: { './*': { types: './dist/*.d.ts', default: './src/*.ts' } } }),
    'packages/ui/src/button.ts': "export function button(): string { return 'button' }\n",
    // A manifest that is not JSON names no package.
    'templates/starter/package.json': '{ "name": "{{name}}", }',
    // Built output no config maps back to source, and a name two packages share: nothing is guessed.
    'packages/legacy/package.json': json({ name: '@acme/legacy', main: './dist/index.js' }),
    'packages/legacy/src/index.ts': "export function legacy(): string { return 'legacy' }\n",
    'packages/one/package.json': json({ name: '@acme/twin', exports: './src/index.ts' }),
    'packages/one/src/index.ts': "export function twin(): string { return 'one' }\n",
    'packages/two/package.json': json({ name: '@acme/twin', exports: './src/index.ts' }),
    'packages/two/src/index.ts': "export function twin(): string { return 'two' }\n",
    'apps/web/tsconfig.json': json({ compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler' }, include: ['src'] }),
    'apps/web/src/page.ts': [
      "import { listPosts } from '@acme/api'",
      "import { button } from '@acme/ui/button'",
      "import { legacy } from '@acme/legacy'",
      "import { twin } from '@acme/twin'",
      'export function page(): string[] { return [...listPosts(), button(), legacy(), twin()] }',
    ].join('\n'),
  })
  try {
    const graph = await buildImportGraph(root)
    expect(graph.files.find(node => node.file === 'apps/web/src/page.ts')?.imports.sort())
      .toEqual(['packages/api/src/index.ts', 'packages/ui/src/button.ts'])
    const files = new Map(graph.operations.map(operation => [operation.id, operation.file]))
    const targets = graph.invocations.filter(call => files.get(call.source) === 'apps/web/src/page.ts')
      .flatMap(call => call.targets.map(target => files.get(target)))
    expect(targets.sort()).toEqual(['packages/api/src/index.ts', 'packages/ui/src/button.ts'])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('a package file reads its imports with its own config, not the aliases of an app that imports it', async () => {
  const aliased = (options: object) => json({ compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler', paths: { 'src/*': ['./src/*'] }, ...options }, include: ['src'] })
  const root = await monorepo({
    'packages/sdk/package.json': json({ name: '@acme/sdk', exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' } } }),
    'packages/sdk/tsconfig.json': aliased({ outDir: 'dist', rootDir: 'src' }),
    'packages/sdk/src/index.ts': "export * from 'src/types.js'\n",
    'packages/sdk/src/types.ts': 'export interface Asset { id: string }\n',
    'server/tsconfig.json': aliased({}),
    'server/src/types.ts': 'export interface Job { name: string }\n',
    'server/src/main.ts': "import type { Asset } from '@acme/sdk'\nexport function main(asset: Asset): string { return asset.id }\n",
  })
  try {
    const graph = await buildImportGraph(root)
    const imports = (file: string) => graph.files.find(node => node.file === file)?.imports
    expect(imports('server/src/main.ts')).toEqual(['packages/sdk/src/index.ts'])
    expect(imports('packages/sdk/src/index.ts')).toEqual(['packages/sdk/src/types.ts'])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('a package bin and a script that run build output become entries on their source files', async () => {
  const root = await monorepo({
    'packages/cli/package.json': json({ name: '@acme/cli', bin: { acme: './dist/cli.js' }, scripts: { start: 'node dist/main.js' } }),
    'packages/cli/tsconfig.json': built,
    'packages/cli/src/cli.ts': "import { run } from './run'\nrun()\n",
    'packages/cli/src/main.ts': "import { run } from './run'\nrun()\n",
    'packages/cli/src/run.ts': 'export function run(): void {}\n',
  })
  try {
    const scan = (await scanTypeScriptSource(root))!
    expect(scan.entryPoints?.map(entry => entry.file).sort()).toEqual(['packages/cli/src/cli.ts', 'packages/cli/src/main.ts'])
  } finally { await rm(root, { recursive: true, force: true }) }
})
