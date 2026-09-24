import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import type { ScannerPlugin } from '@groma/scanner'
import { buildPackage as react } from '../plugins/scanners/react/build.ts'
import reactManifest from '../plugins/scanners/react/package.json'
import { buildPackage as vue } from '../plugins/scanners/vue/build.ts'
import vueManifest from '../plugins/scanners/vue/package.json'
import vueScanner, { scanVue } from '../plugins/scanners/vue/src/index.ts'
import { buildPackage as angular } from '../plugins/scanners/angular/build.ts'
import angularManifest from '../plugins/scanners/angular/package.json'
import { inferRelationships } from '../src/relationship-inference.ts'
import { buildImportGraph } from '../plugins/scanners/typescript/src/graph.ts'
import typescriptManifest from '../plugins/scanners/typescript/package.json'
import { frameworkProjects } from '../plugins/scanners/typescript-project.ts'
import { scannerFiles } from '../src/scanner/modules/selection.ts'

/** The files Groma hands each scanner with its package defaults. */
const reactFiles = (root: string) => scannerFiles(root, reactManifest.groma.scanner)
const vueFiles = (root: string) => scannerFiles(root, vueManifest.groma.scanner)
const typescriptFiles = (root: string) => scannerFiles(root, typescriptManifest.groma.scanner)

async function repository() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-nested-'))
  const git = Bun.spawn(['git', 'init', '--quiet'], { cwd: root })
  expect(await git.exited).toBe(0)
  return root
}

for (const [id, fixture, build, manifest, emitter, receiver] of [
  ['react', 'react-callback', react, reactManifest, 'editor.tsx', 'host.tsx'],
  ['vue', 'vue-output', vue, vueManifest, 'Emitter.vue', 'receiver.ts'],
  ['angular', 'angular-output', angular, angularManifest, 'emitter.ts', 'host.ts'],
] as const) {
  test.concurrent(`${id} scans sibling nested projects without mixing callback targets`, async () => {
    const root = await repository()
    const artifact = await mkdtemp(path.join(os.tmpdir(), 'groma-nested-plugin-'))
    try {
      await writeFile(path.join(root, '.gitignore'), 'node_modules/\nignored/\n')
      await writeFile(path.join(root, 'package.json'), JSON.stringify({ private: true }))
      const dependency = id === 'angular' ? '@angular/core' : id
      for (const directory of ['tooling', 'inactive', 'declarations']) {
        await mkdir(path.join(root, directory))
        await writeFile(path.join(root, directory, 'package.json'), JSON.stringify({ devDependencies: { [dependency]: '*' } }))
      }
      await writeFile(path.join(root, 'tooling/compiler.ts'), 'export const tool = true')
      await writeFile(path.join(root, 'inactive/tsconfig.json'), JSON.stringify({ files: ['missing.ts'] }))
      await writeFile(path.join(root, 'inactive/source.ts.fixture'), 'fixture only')
      await writeFile(path.join(root, 'declarations/tsconfig.json'), '{}')
      await writeFile(path.join(root, 'declarations/index.d.ts'), 'export declare const typeOnly: true')
      for (const app of ['apps/one', 'apps/two']) {
        const directory = path.join(root, app)
        await cp(path.resolve(import.meta.dir, '../test/fixtures', fixture), directory, { recursive: true })
        for (const file of await readdir(directory)) {
          if (file.endsWith('.fixture')) await rename(path.join(directory, file), path.join(directory, file.replace(/\.fixture$/, '')))
        }
        if (id === 'vue') {
          await mkdir(path.join(directory, 'node_modules'))
          const require = createRequire(new URL('../plugins/scanners/vue/package.json', import.meta.url))
          await symlink(path.dirname(require.resolve('vue/package.json')), path.join(directory, 'node_modules/vue'), 'dir')
        } else await symlink(path.resolve(import.meta.dir, '../node_modules'), path.join(directory, 'node_modules'), 'dir')
      }
      await build(artifact)
      const scanner: ScannerPlugin = (await import(path.join(artifact, 'dist/index.js'))).default
      const files = () => scannerFiles(root, manifest.groma.scanner)
      await scanner.checkReadiness?.(root, {}, await files())
      const observation = (await scanner.scan(root, {}, await files()))!
      const owners = new Map(observation.files.map(file => [file.file, file.file]))
      const relationships = inferRelationships([observation], owners)
      for (const app of ['apps/one', 'apps/two']) {
        expect(relationships).toContainEqual(expect.objectContaining({ source: `${app}/${emitter}`, target: `${app}/${receiver}` }))
      }
      expect(relationships.every(relation => relation.source.split('/')[1] === relation.target.split('/')[1])).toBe(true)
      expect(observation.invocations!.every(call => call.binding?.file.startsWith('apps/'))).toBe(true)
      expect(observation.files.every(file => file.file.startsWith('apps/'))).toBe(true)
      // A nested project's config is one of the scanner's files, so changing it triggers the scanner.
      expect(await files()).toContain('apps/two/tsconfig.json')
      await writeFile(path.join(root, 'apps/two/tsconfig.json'), '{ invalid')
      await expect(scanner.checkReadiness!(root, {}, await files())).rejects.toThrow()
      await expect(scanner.scan(root, {}, await files())).rejects.toThrow()
      await rm(path.join(root, 'apps'), { recursive: true })
      await scanner.checkReadiness?.(root, {}, await files())
      expect(await scanner.scan(root, {}, await files())).toBeUndefined()
    } finally {
      await rm(root, { recursive: true, force: true })
      await rm(artifact, { recursive: true, force: true })
    }
  })
}

test.concurrent('project discovery includes peer dependencies but excludes ignored declarations', async () => {
  const root = await repository()
  try {
    await writeFile(path.join(root, '.gitignore'), 'ignored/\n')
    for (const directory of ['packages/ui', 'ignored']) {
      await mkdir(path.join(root, directory), { recursive: true })
      await writeFile(path.join(root, directory, 'package.json'), JSON.stringify({ peerDependencies: { react: '*' } }))
      await writeFile(path.join(root, directory, 'tsconfig.json'), '{}')
      await writeFile(path.join(root, directory, 'view.tsx'), 'export const view = <div />')
    }
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: { react: '*' } }))
    await writeFile(path.join(root, 'tsconfig.json'), '{}')
    expect(await frameworkProjects(root, await reactFiles(root), 'react', ['.tsx'])).toEqual([path.join(root, 'packages/ui')])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('an export-only package manifest does not hide its parent framework source', async () => {
  const root = await repository()
  try {
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: { vue: '*' } }))
    await writeFile(path.join(root, 'tsconfig.json'), '{}')
    await mkdir(path.join(root, 'src/widget'), { recursive: true })
    await writeFile(path.join(root, 'src/widget/package.json'), JSON.stringify({ exports: './Widget.vue' }))
    await writeFile(path.join(root, 'src/widget/Widget.vue'), '<template><p>Widget</p></template>')
    expect(await frameworkProjects(root, await vueFiles(root), 'vue', ['.vue'])).toEqual([root])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('a Vue package uses an ancestor TypeScript config that includes its components', async () => {
  const root = await repository()
  try {
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ private: true }))
    await writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({ include: ['packages/**/*.vue'] }))
    await mkdir(path.join(root, 'packages/client'), { recursive: true })
    await writeFile(path.join(root, 'packages/client/package.json'), JSON.stringify({ name: 'client', dependencies: { vue: '*' } }))
    await writeFile(path.join(root, 'packages/client/App.vue'), '<script setup lang="ts">const title = "App"</script><template>{{ title }}</template>')
    const files = await vueFiles(root)
    expect(await frameworkProjects(root, files, 'vue', ['.vue'])).toEqual([])
    expect(await frameworkProjects(root, files, 'vue', ['.vue'], { inheritConfig: true })).toEqual([path.join(root, 'packages/client')])
    expect((await scanVue(root, {}, files))?.files.map(file => file.file)).toContain('packages/client/App.vue')
    const candidates = await scannerFiles(root, { include: vueManifest.groma.scanner.include })
    expect(await vueScanner.listSourceFiles(root, {}, candidates)).toContain('packages/client/App.vue')
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('a nested Vue package owns its components once when the parent config includes them', async () => {
  const root = await repository()
  try {
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'parent', dependencies: { vue: '*' } }))
    await writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({ include: ['**/*.vue', 'helper.ts'] }))
    await writeFile(path.join(root, 'Root.vue'), '<script setup lang="ts">import Child from "./packages/child/Child.vue"</script><template><Child /></template>')
    await writeFile(path.join(root, 'helper.ts'), 'export function help() { return 1 }')
    const child = path.join(root, 'packages/child')
    await mkdir(child, { recursive: true })
    await writeFile(path.join(child, 'package.json'), JSON.stringify({ name: 'child', dependencies: { vue: '*' } }))
    await writeFile(path.join(child, 'tsconfig.json'), JSON.stringify({ include: ['*.vue'] }))
    await writeFile(path.join(child, 'Child.vue'), '<script setup lang="ts">function wave() { return 42 }</script><template>Child</template>')
    const observation = (await scanVue(root, {}, await vueFiles(root)))!
    expect(observation.files.find(file => file.file === 'packages/child/Child.vue')?.roots).toHaveLength(1)
    expect(observation.operations?.filter(operation => operation.file === 'packages/child/Child.vue' && operation.name === 'wave')).toHaveLength(1)
    expect(observation.files.find(file => file.file === 'helper.ts')?.roots).toHaveLength(1)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('TypeScript uses nested config aliases and refreshes resolution after a config change', async () => {
  const root = await repository()
  try {
    await writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({ files: [], references: [{ path: './apps/one' }, { path: './apps/two' }] }))
    for (const app of ['one', 'two']) {
      const directory = path.join(root, 'apps', app)
      await mkdir(directory, { recursive: true })
      await writeFile(path.join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
        module: 'preserve', moduleResolution: 'bundler', paths: { '@local': ['./target.ts'] },
      } }))
      await writeFile(path.join(directory, 'entry.ts'), "import { work } from '@local'; export function run() { return work() }")
      await writeFile(path.join(directory, 'target.ts'), 'export function work() { return 1 }')
      await writeFile(path.join(directory, 'other.ts'), 'export function work() { return 2 }')
    }
    const graph = await buildImportGraph(root, await typescriptFiles(root))
    for (const app of ['one', 'two']) expect(graph.files.find(file => file.file === `apps/${app}/entry.ts`)!.imports).toEqual([`apps/${app}/target.ts`])
    const operations = new Map(graph.operations.map(operation => [operation.id, operation]))
    const calls = graph.invocations.filter(call => operations.get(call.source)?.name === 'run')
    expect(calls).toHaveLength(2)
    for (const call of calls) {
      expect(call.unresolved).toBe(false)
      expect(operations.get(call.targets[0]!)?.file).toBe(operations.get(call.source)!.file.replace('entry.ts', 'target.ts'))
    }
    await writeFile(path.join(root, 'apps/one/tsconfig.json'), JSON.stringify({ compilerOptions: {
      module: 'preserve', moduleResolution: 'bundler', paths: { '@local': ['./other.ts'] },
    } }))
    const files = await typescriptFiles(root)
    const after = await buildImportGraph(root, files)
    expect(after.files.find(file => file.file === 'apps/one/entry.ts')!.imports).toEqual(['apps/one/other.ts'])
    expect(after.files.find(file => file.file === 'apps/two/entry.ts')!.imports).toEqual(['apps/two/target.ts'])
    // A nested config is one of the scanner's files, so changing it triggers the scanner.
    expect(files).toContain('apps/one/tsconfig.json')
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('the config whose directory contains a file owns it, not a deeper config that includes it from elsewhere', async () => {
  const root = await repository()
  try {
    await mkdir(path.join(root, 'app'), { recursive: true })
    await mkdir(path.join(root, 'spec/deep'), { recursive: true })
    await writeFile(path.join(root, 'app/tsconfig.json'), JSON.stringify({ compilerOptions: {
      module: 'preserve', moduleResolution: 'bundler', paths: { '@local': ['./target.ts'] },
    } }))
    await writeFile(path.join(root, 'spec/deep/tsconfig.json'), JSON.stringify({
      include: ['../../app/**/*'], compilerOptions: { module: 'preserve', moduleResolution: 'bundler' },
    }))
    await writeFile(path.join(root, 'app/entry.ts'), "import { work } from '@local'; export function run() { return work() }")
    await writeFile(path.join(root, 'app/target.ts'), 'export function work() { return 1 }')
    const graph = await buildImportGraph(root, await typescriptFiles(root))
    expect(graph.files.find(file => file.file === 'app/entry.ts')!.imports).toEqual(['app/target.ts'])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('TypeScript configs with no inputs or an absent base keep valid source, but invalid options block it', async () => {
  const root = await repository()
  try {
    await writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({ files: [], references: [{ path: './app' }] }))
    await mkdir(path.join(root, 'app'))
    // A fresh checkout has neither installed package bases nor generated configs; the config's own settings remain.
    await writeFile(path.join(root, 'app/tsconfig.json'), JSON.stringify({
      extends: ['@tsconfig/node20/tsconfig.json', './.generated/tsconfig.json'],
      compilerOptions: { noLib: true, types: [], module: 'preserve', moduleResolution: 'bundler', paths: { '@local': ['./target.ts'] } },
    }))
    await writeFile(path.join(root, 'app/entry.ts'), "import { work } from '@local'; export function run() { return work() }")
    await writeFile(path.join(root, 'app/target.ts'), 'export function work() { return 1 }')
    await mkdir(path.join(root, 'test/fixture'), { recursive: true })
    const emptyConfig = path.join(root, 'test/fixture/tsconfig.json')
    await writeFile(emptyConfig, JSON.stringify({ include: ['*.tsx'] }))
    await writeFile(path.join(root, 'test/fixture/view.tsx.fixture'), 'export const view = <div />')
    const graph = await buildImportGraph(root, await typescriptFiles(root))
    expect(graph.files.map(file => file.file).sort()).toEqual(['app/entry.ts', 'app/target.ts'])
    expect(graph.files.find(file => file.file === 'app/entry.ts')!.imports).toEqual(['app/target.ts'])
    expect(graph.operations.some(operation => operation.file === 'app/entry.ts' && operation.name === 'run')).toBe(true)
    expect(graph.diagnostics.map(item => [item.severity, item.file])).toEqual([['warning', 'app/tsconfig.json'], ['warning', 'app/tsconfig.json']])
    await writeFile(emptyConfig, JSON.stringify({ compilerOptions: { target: 'invalid' }, include: ['*.tsx'] }))
    await expect(buildImportGraph(root, await typescriptFiles(root))).rejects.toThrow('target')
  } finally { await rm(root, { recursive: true, force: true }) }
})


test.concurrent('shared TypeScript operations keep one physical identity and all compiler claims', async () => {
  const root = await repository()
  try {
    await mkdir(path.join(root, 'shared'))
    await writeFile(path.join(root, 'shared/run.ts'), "import { target } from '@target'; export function run() { return target() }")
    for (const app of ['one', 'two']) {
      const directory = path.join(root, 'apps', app)
      await mkdir(directory, { recursive: true })
      await writeFile(path.join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
        module: 'preserve', moduleResolution: 'bundler', paths: { '@target': ['./target.ts'] },
      } }))
      await writeFile(path.join(directory, 'entry.ts'), "import { run } from '../../shared/run'; export function start() { return run() }")
      await writeFile(path.join(directory, 'target.ts'), 'export function target() { return 1 }')
    }
    const graph = await buildImportGraph(root, await typescriptFiles(root))
    const shared = graph.operations.filter(operation => operation.file === 'shared/run.ts' && operation.name === 'run')
    expect(shared).toHaveLength(1)
    const operations = new Map(graph.operations.map(operation => [operation.id, operation]))
    const claims = graph.invocations.filter(call => call.source === shared[0]!.id)
    expect(claims).toHaveLength(2)
    expect(claims.every(call => !call.unresolved)).toBe(true)
    expect(new Set(claims.flatMap(call => call.targets.map(target => operations.get(target)!.file))))
      .toEqual(new Set(['apps/one/target.ts', 'apps/two/target.ts']))
  } finally { await rm(root, { recursive: true, force: true }) }
})
