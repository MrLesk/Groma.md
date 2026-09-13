import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import type { ScannerPlugin } from '@groma/scanner'
import { buildPackage as react } from '../plugins/scanners/react/build.ts'
import { buildPackage as vue } from '../plugins/scanners/vue/build.ts'
import { buildPackage as angular } from '../plugins/scanners/angular/build.ts'
import { inferRelationships } from '../src/relationship-inference.ts'
import { buildImportGraph } from '../plugins/scanners/typescript/src/graph.ts'
import { frameworkProjects } from '../plugins/scanners/projects.ts'
import { compileWatchPatterns } from '../src/scanner/watch-patterns.ts'
import typescript from '../plugins/scanners/typescript/src/index.ts'

async function repository() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-nested-'))
  const git = Bun.spawn(['git', 'init', '--quiet'], { cwd: root })
  expect(await git.exited).toBe(0)
  return root
}

for (const [id, fixture, build, emitter, receiver] of [
  ['react', 'react-callback', react, 'editor.tsx', 'host.tsx'],
  ['vue', 'vue-output', vue, 'Emitter.vue', 'receiver.ts'],
  ['angular', 'angular-output', angular, 'emitter.ts', 'host.ts'],
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
      await scanner.checkReadiness?.(root)
      const observation = (await scanner.scan(root))!
      const owners = new Map(observation.files.map(file => [file.file, file.file]))
      const relationships = inferRelationships([observation], owners)
      for (const app of ['apps/one', 'apps/two']) {
        expect(relationships).toContainEqual(expect.objectContaining({ source: `${app}/${emitter}`, target: `${app}/${receiver}` }))
      }
      expect(relationships.every(relation => relation.source.split('/')[1] === relation.target.split('/')[1])).toBe(true)
      expect(observation.invocations!.every(call => call.binding?.file.startsWith('apps/'))).toBe(true)
      expect(observation.files.every(file => file.file.startsWith('apps/'))).toBe(true)
      expect(compileWatchPatterns(scanner.watch)('apps/two/tsconfig.json')).toBe(true)
      await writeFile(path.join(root, 'apps/two/tsconfig.json'), '{ invalid')
      await expect(scanner.checkReadiness!(root)).rejects.toThrow()
      await expect(scanner.scan(root)).rejects.toThrow()
      await rm(path.join(root, 'apps'), { recursive: true })
      await scanner.checkReadiness?.(root)
      expect(await scanner.scan(root)).toBeUndefined()
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
    for (const directory of ['packages/ui', 'ignored', 'node_modules/dependency']) {
      await mkdir(path.join(root, directory), { recursive: true })
      await writeFile(path.join(root, directory, 'package.json'), JSON.stringify({ peerDependencies: { react: '*' } }))
      await writeFile(path.join(root, directory, 'tsconfig.json'), '{}')
      await writeFile(path.join(root, directory, 'view.tsx'), 'export const view = <div />')
    }
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: { react: '*' } }))
    await writeFile(path.join(root, 'tsconfig.json'), '{}')
    expect(await frameworkProjects(root, 'react', ['.tsx'])).toEqual([path.join(root, 'packages/ui')])
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
    const graph = await buildImportGraph(root)
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
    const after = await buildImportGraph(root)
    expect(after.files.find(file => file.file === 'apps/one/entry.ts')!.imports).toEqual(['apps/one/other.ts'])
    expect(after.files.find(file => file.file === 'apps/two/entry.ts')!.imports).toEqual(['apps/two/target.ts'])
    expect(compileWatchPatterns(typescript.watch)('apps/one/tsconfig.json')).toBe(true)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('empty TypeScript fixture configurations do not block valid source, but invalid options do', async () => {
  const root = await repository()
  try {
    await writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({ files: [], references: [{ path: './app' }] }))
    await mkdir(path.join(root, 'app'))
    await writeFile(path.join(root, 'app/tsconfig.json'), JSON.stringify({ compilerOptions: { noLib: true, types: [] } }))
    await writeFile(path.join(root, 'app/entry.ts'), 'export function run() { return 1 }')
    await mkdir(path.join(root, 'test/fixture'), { recursive: true })
    const emptyConfig = path.join(root, 'test/fixture/tsconfig.json')
    await writeFile(emptyConfig, JSON.stringify({ include: ['*.tsx'] }))
    await writeFile(path.join(root, 'test/fixture/view.tsx.fixture'), 'export const view = <div />')
    const graph = await buildImportGraph(root)
    expect(graph.files.map(file => file.file)).toEqual(['app/entry.ts'])
    expect(graph.operations.some(operation => operation.file === 'app/entry.ts' && operation.name === 'run')).toBe(true)
    await writeFile(emptyConfig, JSON.stringify({ compilerOptions: { target: 'invalid' }, include: ['*.tsx'] }))
    await expect(buildImportGraph(root)).rejects.toThrow('target')
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
    const graph = await buildImportGraph(root)
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
