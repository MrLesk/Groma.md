import { expect, test } from 'bun:test'
import { cp, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ScannerPlugin } from '@groma/scanner'
import { buildPackage } from '../plugins/scanners/angular/build.ts'
import { scanTypeScriptSource } from '../plugins/scanners/typescript/src/scan.ts'
import { loadArchitecture } from '../src/architecture-reader.ts'
import { buildArchitectureModel } from '../src/architecture-model.ts'
import { loadAnnotatedArchitecture, reconcileScanObservations } from '../src/core.ts'
import { editArchitecture } from '../src/edit.ts'
import { inferRelationships } from '../src/relationship-inference.ts'
import { createScannerSession } from '../src/scanner/session.ts'
import type { AnnotatedArchitectureModel } from '../src/types.ts'

const fixture = path.resolve(import.meta.dir, '../test/fixtures/angular-output')

async function setup() {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-angular-test-'))
  const root = path.join(temporary, 'project')
  const artifact = path.join(temporary, 'scanner')
  await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
  await cp(fixture, root, { recursive: true })
  for (const name of ['emitter', 'host']) await rename(path.join(root, `${name}.ts.fixture`), path.join(root, `${name}.ts`))
  const child = Bun.spawn(['git', 'init', '--quiet'], { cwd: root, stdout: 'ignore', stderr: 'pipe' })
  expect(await child.exited, await new Response(child.stderr).text()).toBe(0)
  await buildPackage(artifact)
  const scanner: ScannerPlugin = (await import(path.join(artifact, 'dist/index.js'))).default
  return { temporary, root, artifact, scanner }
}

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
    const angular = (await scanner.scan(root))!
    expect(await scanner.scan(root)).toEqual(angular)
    const typescript = (await scanTypeScriptSource(root))!
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
    const unsupported = (await scanner.scan(root))!
    expect(unsupported.invocations).toEqual([])
    expect(unsupported.diagnostics.some(item => item.code === 'unsupported-angular-binding' && item.file === 'host.html' && Number.isInteger(item.line))).toBe(true)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('Angular overlap and repeat scans retain a curated source owner', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const typescript = (await scanTypeScriptSource(root))!
    await reconcileScanObservations(root, [typescript])
    const before = await loadAnnotatedArchitecture(root)
    const source = owner(before, 'emitter.ts')
    await editArchitecture(root, { id: source.id, overview: 'Publishes the completed result.' })
    const angular = (await scanner.scan(root))!
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
    const before = (await scanner.scan(root))!
    const file = path.join(root, 'emitter.ts')
    await writeFile(file, (await readFile(file, 'utf8')).replace("templateUrl: './emitter.html'", "template: ''"))
    await rm(path.join(root, 'emitter.html'))
    const after = (await scanner.scan(root))!
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
    const angular = (await scanner.scan(root))!
    const typescript = (await scanTypeScriptSource(root))!
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
