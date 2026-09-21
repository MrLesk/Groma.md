import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createScanObservation } from '@groma/scanner'
import { scanReact } from '../plugins/scanners/react/src/scan.ts'
import { scanTypeScriptSource } from '../plugins/scanners/typescript/src/scan.ts'
import { loadAnnotatedArchitecture, reconcileScanObservations } from '../src/core.ts'
import { createScannerRegistry } from '../src/scanner/registry.ts'
import javascript from '../plugins/scanners/javascript/src/index.ts'
import php from '../plugins/scanners/php/src/index.ts'
import vue from '../plugins/scanners/vue/src/index.ts'
import angular from '../plugins/scanners/angular/src/index.ts'
import { buildPackage as buildAngular } from '../plugins/scanners/angular/build.ts'

const examples = [
  { scanner: javascript, entry: 'main.js', member: 'helper.js', files: {
    'package.json': JSON.stringify({ bin: { command: 'main.js' } }),
    'main.js': "import { run } from './helper.js'; run();",
    'helper.js': 'export function run() {}',
  } },
  { scanner: php, entry: 'main.php', member: 'helper.php', files: {
    'composer.json': JSON.stringify({ bin: ['main.php'] }),
    'main.php': "<?php require __DIR__.'/helper.php'; require __DIR__.'/library/shared.php'; run();",
    'helper.php': '<?php function run() {}',
    'library/composer.json': JSON.stringify({ name: 'example/library' }),
    'library/shared.php': '<?php function shared() {}',
  } },
  { scanner: vue, entry: 'main.ts', member: 'App.vue', files: {
    'package.json': JSON.stringify({ name: 'browser', dependencies: { vue: '3.0.0' } }),
    'tsconfig.json': JSON.stringify({ compilerOptions: { moduleResolution: 'Bundler', module: 'ESNext' }, include: ['*.ts', '*.vue'] }),
    'index.html': '<script type="module" src="/main.ts"></script>',
    'main.ts': "import App from './App.vue'; console.log(App);",
    'App.vue': '<script setup lang="ts">const title = "App";</script><template><main>{{title}}</main></template>',
  } },
  { scanner: angular, build: buildAngular, entry: 'main.ts', member: 'view.ts', files: {
    'package.json': JSON.stringify({ name: 'browser', dependencies: { '@angular/core': '20.0.0' } }),
    'tsconfig.json': JSON.stringify({ compilerOptions: { moduleResolution: 'Bundler', module: 'ESNext' }, include: ['*.ts'] }),
    'angular.json': JSON.stringify({ projects: { browser: { architect: { build: { options: { browser: 'main.ts' } } } } } }),
    'main.ts': "import { view } from './view'; view();",
    'view.ts': 'export function view() {}',
  } },
]

for (const example of examples) test.concurrent(`${example.scanner.id} reports declared execution and its local source inputs`, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'groma-declared-entry-'))
  const root = path.join(directory, 'project')
  try {
    for (const [file, source] of Object.entries(example.files)) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true })
      await writeFile(path.join(root, file), source!)
    }
    expect(await Bun.spawn(['git', 'init', '--quiet'], { cwd: root }).exited).toBe(0)
    const artifact = path.join(directory, 'scanner')
    if (example.build) await example.build(artifact)
    const scanner = example.build ? (await import(path.join(artifact, 'dist/index.js'))).default : example.scanner
    const scan = (await scanner.scan(root))!
    expect(scan.entryPoints).toHaveLength(1)
    expect(scan.entryPoints![0]!.file).toBe(example.entry)
    expect(scan.entryPoints![0]!.files).toContain(example.member)
    if (example.scanner.id === 'php') expect(scan.entryPoints![0]!.files).not.toContain('library/shared.php')
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test.concurrent('declared commands and browser builds share source identity across declarations and scanner subsets', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-js-entries-'))
  try {
    await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
    const source = {
      'package.json': JSON.stringify({ name: 'workspace', dependencies: { react: '19.0.0' }, bin: { command: 'src/cli.ts', worker: 'src/worker.ts' } }),
      'tsconfig.json': JSON.stringify({ compilerOptions: { module: 'ESNext', target: 'ESNext', moduleResolution: 'Bundler', jsx: 'preserve' }, include: ['**/*.ts', '**/*.tsx'] }),
      'index.html': '<script type="module" src="/src/browser.ts"></script>',
      'src/cli.ts': "import { shared } from './shared'; import { library } from '../library/lib'; shared(); library();",
      'src/worker.ts': 'export const worker = 1;',
      'src/browser.ts': "import { shared } from './shared'; import { view } from './view'; shared(); view();",
      'src/view.tsx': 'export function view() { return <main />; }',
      'src/shared.ts': 'export function shared() {}',
      'library/package.json': JSON.stringify({ name: 'library', exports: './lib.ts' }),
      'library/lib.ts': 'export function library() {}',
      'build.ts': [
        "import { fileURLToPath } from 'node:url';",
        "const renderer = { entry: 'src/browser.ts' };",
        'Bun.build({ entrypoints: [fileURLToPath(new URL(`./${renderer.entry}`, import.meta.url))], target: "browser" });',
      ].join('\n'),
    }
    for (const [file, text] of Object.entries(source)) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true })
      await writeFile(path.join(root, file), text)
    }
    expect(await Bun.spawn(['git', 'init', '--quiet'], { cwd: root }).exited).toBe(0)
    const typescript = (await scanTypeScriptSource(root))!
    const browserFacts = typescript.entryPoints!.filter(entry => entry.file === 'src/browser.ts')
    expect(browserFacts.map(entry => entry.declaration).sort()).toEqual(['build.ts', 'index.html'])
    expect(browserFacts.every(entry => entry.files.includes('src/view.tsx'))).toBe(true)
    expect(typescript.entryPoints!.find(entry => entry.file === 'src/cli.ts')!.files).not.toContain('library/lib.ts')
    const framework = (await scanReact(root))!
    expect(framework.entryPoints!.map(entry => entry.file)).toEqual(['src/browser.ts', 'src/browser.ts'])
    expect(framework.files.some(file => file.file === 'src/browser.ts')).toBe(true)
    await reconcileScanObservations(root, [framework, typescript])
    const model = await loadAnnotatedArchitecture(root)
    expect(model.elements.filter(element => element.kind === 'container')).toHaveLength(3)
    const owner = (file: string) => model.elements.find(element => element.code.some(reference => reference.file === file))!
    expect(owner('src/browser.ts').parent).toBe(owner('src/view.tsx').parent)
    for (const file of ['src/shared.ts', 'library/lib.ts']) {
      expect(model.elements.find(element => element.id === owner(file).parent)?.kind).toBe('system')
    }
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('excluding an execution declaration removes its fact even when source inventory is unchanged', async () => {
  const scan = createScanObservation({ scanner: { id: 'fixture', technology: 'fixture', engine: 'fixture', engineVersion: '1' },
    roots: [{ id: 'root', kind: 'source', name: 'Source' }],
    files: [{ file: 'entry', roots: ['root'], symbols: [] }],
    entryPoints: [{ file: 'entry', declaration: 'build', name: 'Run', files: ['entry'] }], diagnostics: [] })
  const registry = createScannerRegistry([{ id: 'fixture', watch: { include: ['**/*'], exclude: [] }, async scan() { return scan } }], file => file === 'build')
  const batch = await registry.collectObservations('.')
  expect(batch.observations[0]!.files).toEqual(scan.files)
  expect(batch.observations[0]!.entryPoints).toEqual([])
})
