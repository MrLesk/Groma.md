import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ScannerPlugin, SourceReference } from '@groma/scanner'
import { buildPackage } from '../plugins/scanners/angular/build.ts'
import manifest from '../plugins/scanners/angular/package.json'
import typescriptManifest from '../plugins/scanners/typescript/package.json'
import { scanTypeScriptSource } from '../plugins/scanners/typescript/src/scan.ts'
import { readCodeStructure as readReferenceOutline } from '../plugins/scanners/typescript/src/structure.ts'
import { loadArchitecture } from '../src/architecture-reader.ts'
import { buildArchitectureModel } from '../src/architecture-model.ts'
import { loadAnnotatedArchitecture, reconcileScanObservations } from '../src/core.ts'
import { editArchitecture } from '../src/edit.ts'
import { inferRelationships } from '../src/relationship-inference.ts'
import { scannerFiles } from '../src/scanner/modules/selection.ts'
import { createScannerSession } from '../src/scanner/session.ts'
import type { AnnotatedArchitectureModel } from '../src/types.ts'
import { readCodeStructure } from '../src/viewers/source/structure.ts'

/** The files Groma hands each scanner with its package defaults, and the Angular candidates a listing selects from. */
const angularFiles = (root: string) => scannerFiles(root, manifest.groma.scanner)
const angularCandidates = (root: string) => scannerFiles(root, { include: manifest.groma.scanner.include })
const typescriptFiles = (root: string) => scannerFiles(root, typescriptManifest.groma.scanner)

const fixture = path.resolve(import.meta.dir, '../test/fixtures/angular-output')
const outlineFixture = path.resolve(import.meta.dir, '../test/fixtures/angular-outline')

/** A Git repository that `fill` writes, and the Angular package built beside it. */
async function repository(fill: (root: string) => Promise<unknown>) {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-angular-test-'))
  const root = path.join(temporary, 'project')
  const artifact = path.join(temporary, 'scanner')
  await mkdir(root, { recursive: true })
  await fill(root)
  const child = Bun.spawn(['git', 'init', '--quiet'], { cwd: root, stdout: 'ignore', stderr: 'pipe' })
  expect(await child.exited, await new Response(child.stderr).text()).toBe(0)
  await buildPackage(artifact)
  const scanner: ScannerPlugin = (await import(path.join(artifact, 'dist/index.js'))).default
  return { temporary, root, artifact, scanner }
}

const setup = () => repository(async root => {
  await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
  await cp(fixture, root, { recursive: true })
  for (const name of ['emitter', 'host']) await rename(path.join(root, `${name}.ts.fixture`), path.join(root, `${name}.ts`))
})

const outlineSetup = () => repository(root => cp(outlineFixture, root, { recursive: true }))

/** A repository of the given sources. */
const workspace = (files: Record<string, string>) => repository(async root => {
  for (const [file, text] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), text)
  }
})

function owner(model: AnnotatedArchitectureModel, file: string) {
  const matches = model.elements.filter(element => element.code.some(reference => reference.file === file))
  expect(matches).toHaveLength(1)
  return matches[0]!
}

async function storedArchitecture(root: string) {
  return buildArchitectureModel((await loadArchitecture(root)).documents)
}

test.concurrent('Angular resolves an output callback beyond TypeScript and preserves source positions', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const angular = (await scanner.scan(root, {}, await angularFiles(root)))!
    expect(await scanner.scan(root, {}, await angularFiles(root))).toEqual(angular)
    const typescript = (await scanTypeScriptSource(root, await typescriptFiles(root)))!
    const owners = new Map(angular.files.map(file => [file.file, file.file]))
    expect(inferRelationships([typescript], owners)).toEqual([])
    expect(inferRelationships([typescript, angular], owners)).toEqual([
      expect.objectContaining({ source: 'emitter.ts', target: 'host.ts', technology: 'angular' }),
    ])
    const invocation = angular.invocations![0]!
    const source = await readFile(path.join(root, 'emitter.ts'), 'utf8')
    const host = await readFile(path.join(root, 'host.ts'), 'utf8')
    const template = await readFile(path.join(root, 'host.html'), 'utf8')
    const caller = angular.operations!.find(operation => operation.id === invocation.source)!
    const target = angular.operations!.find(operation => operation.id === invocation.targets[0])!
    expect(caller.position).toBe(source.indexOf('(value: string) =>'))
    expect(target.position).toBe(host.indexOf('receive(value: string)'))
    expect(invocation.position).toBe(source.indexOf('this.saved.emit'))
    expect(invocation.binding).toEqual({ file: 'host.html', line: 1, position: template.indexOf('(saved)') })
    expect(typescript.operations!.some(operation => operation.file === caller.file && operation.position === caller.position)).toBe(true)
    expect(angular.diagnostics.some(item => item.code === 'unsupported-angular-binding')).toBe(true)
    await writeFile(path.join(root, 'host.html'), '<sample-editor (saved)="receive($event); receive($event)" />\n')
    const unsupported = (await scanner.scan(root, {}, await angularFiles(root)))!
    expect(unsupported.invocations).toEqual([])
    expect(unsupported.diagnostics.some(item => item.code === 'unsupported-angular-binding' && item.file === 'host.html' && Number.isInteger(item.line))).toBe(true)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('Angular overlap and repeat scans retain a curated source owner', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const typescript = (await scanTypeScriptSource(root, await typescriptFiles(root)))!
    await reconcileScanObservations(root, [typescript])
    const before = await loadAnnotatedArchitecture(root)
    const source = owner(before, 'emitter.ts')
    await editArchitecture(root, { id: source.id, overview: 'Publishes the completed result.' })
    const angular = (await scanner.scan(root, {}, await angularFiles(root)))!
    await reconcileScanObservations(root, [typescript, angular])
    const snapshot = await storedArchitecture(root)
    await reconcileScanObservations(root, [angular, typescript])
    expect(await storedArchitecture(root)).toEqual(snapshot)
    const after = await loadAnnotatedArchitecture(root)
    expect(owner(after, 'emitter.ts').id).toBe(source.id)
    expect(new Set(owner(after, 'emitter.ts').code.map(reference => reference.scanner))).toEqual(new Set(['typescript', 'angular']))
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('Angular preserves external parent bindings to an output provider with an inline template', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const before = (await scanner.scan(root, {}, await angularFiles(root)))!
    const file = path.join(root, 'emitter.ts')
    await writeFile(file, (await readFile(file, 'utf8')).replace("templateUrl: './emitter.html'", "template: ''"))
    await rm(path.join(root, 'emitter.html'))
    const after = (await scanner.scan(root, {}, await angularFiles(root)))!
    const targets = (observation: typeof before) => observation.invocations!.map(call => ({
      member: call.member,
      files: call.targets.map(id => observation.operations!.find(operation => operation.id === id)!.file),
      unresolved: call.unresolved,
    }))
    expect(targets(after)).toEqual(targets(before))
    expect(after.invocations).toHaveLength(1)
    expect(after.files.some(file => file.file === 'emitter.html')).toBe(false)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('Angular packages class, template and declared styles as one source unit without dependencies', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const angular = (await scanner.scan(root, {}, await angularFiles(root)))!
    const typescript = (await scanTypeScriptSource(root, await typescriptFiles(root)))!
    expect(angular.files.some(file => file.file === 'shared.css')).toBe(false)
    await reconcileScanObservations(root, [typescript, angular])
    const model = await loadAnnotatedArchitecture(root)
    for (const [primary, companions] of [['host.ts', ['host.html', 'host.scss']], ['emitter.ts', ['emitter.html', 'emitter.css']]] as const) {
      for (const file of companions) expect(owner(model, file).id).toBe(owner(model, primary).id)
    }
    expect(owner(model, 'emitter.ts').id).not.toBe(owner(model, 'host.ts').id)
    expect(model.relationships).toHaveLength(1)
    await editArchitecture(root, { id: owner(model, 'host.ts').id, title: 'Result handler' })
    const before = await storedArchitecture(root)
    expect((await reconcileScanObservations(root, [angular, typescript])).created).toBe(0)
    expect(await storedArchitecture(root)).toEqual(before)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('the live scanner session refreshes a component when its external stylesheet changes', async () => {
  const { temporary, root, artifact } = await setup()
  let complete: (() => void) | undefined
  const session = await createScannerSession(root, { onFold() { complete?.() } })
  try {
    await session.change({ action: 'add', source: artifact })
    expect(session.state.scanners.find(scanner => scanner.id === 'angular')?.status).toBe('ready')
    const before = await storedArchitecture(root)
    const changed = Promise.withResolvers<void>()
    complete = () => changed.resolve()
    await writeFile(path.join(root, 'host.scss'), ':host { display: flex; }')
    await changed.promise
    expect(await storedArchitecture(root)).toEqual(before)
  } finally { await session.close(); await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('the built Angular package outlines component sources', async () => {
  const { temporary, root, scanner } = await outlineSetup()
  try {
    const files = await scanner.readCodeStructure!(root, [{ file: 'profile.component.ts', symbols: ['ProfileComponent'] }])
    const summary = files.map(file => [file.file, file.declarations.map(declaration => [
      declaration.kind, declaration.name, declaration.line, declaration.visibility, declaration.entry,
      declaration.kind === 'type' ? declaration.members.map(member => [member.name, member.line, member.visibility]) : [],
    ])])

    // Decorated declarations report the line of their name.
    expect(summary).toEqual([['profile.component.ts', [
      ['function', 'initials', 3, 'private', false, []],
      ['function', 'greeting', 7, 'public', false, []],
      ['type', 'ProfileComponent', 13, 'public', true, [
        ['constructor', 16, 'public'], ['save', 21, 'public'], ['label', 26, 'protected'], ['#reset', 30, 'private'],
      ]],
    ]]])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('the built Angular package and the TypeScript scanner outline a source alike', async () => {
  const { temporary, root, scanner } = await outlineSetup()
  try {
    const sources: [string, SourceReference][] = [
      [path.resolve(import.meta.dir, '../test/fixtures/typescript-outline'), { file: 'outline.ts', symbols: ['listed'] }],
      [root, { file: 'profile.component.ts', symbols: ['ProfileComponent'] }],
    ]
    for (const [sourceRoot, reference] of sources) {
      const outline = await scanner.readCodeStructure!(sourceRoot, [reference])
      expect(outline).toHaveLength(1)
      expect(outline).toEqual(await readReferenceOutline(sourceRoot, [reference]))
    }
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('a file Angular and TypeScript both own shows one outline', async () => {
  const { temporary, root, artifact, scanner } = await outlineSetup()
  try {
    await writeFile(path.join(root, 'groma/scanners.json'), JSON.stringify({ scanners: [
      { id: 'typescript', source: path.resolve(import.meta.dir, '../plugins/scanners/typescript'), include: typescriptManifest.groma.scanner.include },
      { id: 'angular', source: artifact, include: manifest.groma.scanner.include },
    ] }))
    const world = await loadAnnotatedArchitecture(root)
    const component = world.elements.find(element => element.kind === 'component')!
    const files = await readCodeStructure(root, world, null, component.representationId)

    // The component's Code lists this source under both scanners; only the TypeScript link names ProfileComponent.
    expect(files).toEqual(await scanner.readCodeStructure!(root, [{ file: 'profile.component.ts', symbols: ['ProfileComponent'] }]))
    expect(files?.[0]?.declarations.find(declaration => declaration.name === 'ProfileComponent')?.entry).toBe(true)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('Angular scans an Nx application through its solution config without specs or unreadable settings', async () => {
  const shop = 'apps/shop/src'
  const { temporary, root, scanner } = await workspace({
    // Nx declares Angular once at the workspace root and keeps each project's configs beside it.
    'package.json': JSON.stringify({ dependencies: { '@angular/core': '21.2.17' } }),
    'nx.json': '{}',
    'tsconfig.base.json': JSON.stringify({ compilerOptions: { experimentalDecorators: true, resolveJsonModule: true } }),
    'apps/shop/project.json': JSON.stringify({ name: 'shop', targets: { build: {
      options: { browser: `${shop}/main.ts`, polyfills: ['zone.js', `${shop}/polyfills.ts`] },
      configurations: { production: { fileReplacements: [{ replace: `${shop}/env.ts`, with: `${shop}/env.prod.ts` }] } },
    } } }),
    'apps/shop/tsconfig.json': JSON.stringify({ files: [], references: [{ path: './tsconfig.app.json' }] }),
    // A TypeScript 7 option the scanner's compiler does not know.
    'apps/shop/tsconfig.app.json': JSON.stringify({ extends: '../../tsconfig.base.json', compilerOptions: { singleThreaded: true }, include: ['src/**/*.ts'] }),
    [`${shop}/main.ts`]: "import { Shop } from './shop'\nimport { env } from './env'\nexport const app = [Shop, env]\n",
    [`${shop}/polyfills.ts`]: 'export {}\n',
    [`${shop}/env.ts`]: 'export const env = {}\n',
    [`${shop}/env.prod.ts`]: 'export const env = {}\n',
    [`${shop}/shop.ts`]: "import { Component } from '@angular/core'\nimport data from './data.json'\n\n"
      + "@Component({ templateUrl: './shop.html', styleUrl: './missing.css' })\nexport class Shop { data = data }\n",
    [`${shop}/shop.html`]: '<p>Shop</p>\n',
    [`${shop}/data.json`]: '{}\n',
    [`${shop}/shop.spec.ts`]: "import { Shop } from './shop'\nexport const spec = Shop\n",
  })
  try {
    const files = await angularFiles(root)
    await scanner.checkReadiness!(root, {}, files)
    const observation = (await scanner.scan(root, {}, files))!
    const observed = observation.files.map(file => file.file)
    // The absent stylesheet is left out of the component's source unit.
    expect(observation.sourceUnits?.find(unit => unit.primary === `${shop}/shop.ts`)?.files.toSorted()).toEqual([`${shop}/shop.html`, `${shop}/shop.ts`])
    for (const file of [`${shop}/shop.spec.ts`, `${shop}/data.json`]) expect(observed).not.toContain(file)
    // The listing comes before exclusions, so it names the spec the defaults leave out.
    expect(await scanner.listSourceFiles!(root, {}, await angularCandidates(root))).toContain(`${shop}/shop.spec.ts`)
    expect(observation.diagnostics.map(item => item.code)).toEqual(expect.arrayContaining(['angular-unreadable-config', 'angular-missing-resource']))
    expect(observation.entryPoints).toEqual([expect.objectContaining({ name: 'shop', file: `${shop}/main.ts`,
      files: expect.arrayContaining([`${shop}/polyfills.ts`, `${shop}/env.prod.ts`, `${shop}/shop.html`]) })])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('Angular binds directive outputs and template emits from inline templates to the parent method', async () => {
  const { temporary, root, scanner } = await workspace({
    'package.json': JSON.stringify({ dependencies: { '@angular/core': '21.2.17' } }),
    'tsconfig.json': JSON.stringify({ compilerOptions: { experimentalDecorators: true }, include: ['*.ts'] }),
    // The directive emits, with an EventEmitter's next, an output its base class declares.
    'sort.ts': "import { Directive, EventEmitter, HostListener, Output } from '@angular/core'\n\n"
      + 'export class Sortable {\n  @Output() sorted = new EventEmitter<string>()\n}\n\n'
      + "@Directive({ selector: '[appSort]' })\nexport class Sort extends Sortable {\n"
      + "  @HostListener('click') click() { this.sorted.next('name') }\n}\n",
    'remove.ts': "import { Component, output } from '@angular/core'\n\n"
      + "@Component({ selector: 'app-remove', template: `<button (click)=\"removed.emit(true)\">Remove</button>` })\n"
      + 'export class Remove { removed = output<boolean>() }\n',
    'list.ts': "import { Component } from '@angular/core'\nimport { Sort } from './sort'\nimport { Remove } from './remove'\n\n"
      + 'const TABLE = [Sort, Remove] as const\n\n'
      + "@Component({ selector: 'app-list', imports: [TABLE], template: `<th appSort (sorted)=\"sort($event)\"></th>\n"
      + '  <app-remove (removed)="remove()" />` })\nexport class List {\n  sort(key: string) { return key }\n  remove() { return true }\n}\n',
  })
  try {
    const observation = (await scanner.scan(root, {}, await angularFiles(root)))!
    const owners = new Map(observation.files.map(file => [file.file, file.file]))
    expect(inferRelationships([observation], owners).map(row => [row.source, row.target]).sort()).toEqual([
      ['remove.ts', 'list.ts'],
      ['sort.ts', 'list.ts'],
    ])
    // An inline template's binding keeps its position in the class file.
    const list = await readFile(path.join(root, 'list.ts'), 'utf8')
    const position = list.indexOf('(removed)')
    expect(observation.invocations!.map(call => call.binding)).toContainEqual({ file: 'list.ts', line: list.slice(0, position).split('\n').length, position })
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('Angular reads no project, config, source or entry declaration its exclusions name, and a ! pattern restores a spec', async () => {
  const { temporary, root, scanner } = await workspace({
    'package.json': JSON.stringify({ dependencies: { '@angular/core': '21.2.17' } }),
    'tsconfig.json': JSON.stringify({ compilerOptions: { experimentalDecorators: true }, include: ['src/**/*.ts'] }),
    'src/app.ts': "import { Component } from '@angular/core'\n\n@Component({ template: '<p>App</p>' })\nexport class App {}\n",
    'src/app.spec.ts': "import { App } from './app'\nexport const spec = App\n",
    // Each excluded input fails the readiness check or the scan if read: an installed Angular package with an invalid
    // config and source, and an invalid workspace file in the application's own package.
    'node_modules/lib/package.json': JSON.stringify({ dependencies: { '@angular/core': '21.2.17' } }),
    'node_modules/lib/tsconfig.json': '{',
    'node_modules/lib/broken.ts': 'export class Broken {\n',
    'dist/angular.json': '{',
    'node_modules/other/package.json': '{',
    'node_modules/other/tsconfig.json': '{}',
  })
  try {
    // The listing comes before exclusions: it names installed source, and a package.json that is not JSON names no project.
    expect(await scanner.listSourceFiles!(root, {}, await angularCandidates(root))).toContain('node_modules/lib/broken.ts')
    const files = await scannerFiles(root, { include: manifest.groma.scanner.include, exclude: [...manifest.groma.scanner.exclude, '!src/app.spec.ts'] })
    await scanner.checkReadiness!(root, {}, files)
    expect((await scanner.scan(root, {}, files))!.files.map(file => file.file).toSorted()).toEqual(['src/app.spec.ts', 'src/app.ts'])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})
