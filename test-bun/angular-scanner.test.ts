import { expect, test } from 'bun:test'
import { cp, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ScannerPlugin } from '@groma/scanner'
import { buildPackage } from '../plugins/scanners/angular/build.ts'
import { scanTypeScriptSource } from '../plugins/scanners/typescript/src/scan.ts'
import { loadArchitecture } from '../src/architecture-reader.ts'
import { loadAnnotatedArchitecture, reconcileScanObservations } from '../src/core.ts'
import { editArchitecture } from '../src/edit.ts'
import { inferRelationships } from '../src/relationship-inference.ts'
import { scanRepository, watchScan } from '../src/scanner.ts'
import { addScanner } from '../src/scanner/modules/inventory.ts'
import type { AnnotatedArchitectureModel } from '../src/types.ts'

const fixture = path.resolve(import.meta.dir, '../test/fixtures/angular-output')

async function setup() {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-angular-test-'))
  const root = path.join(temporary, 'project')
  const artifact = path.join(temporary, 'scanner')
  await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
  await cp(fixture, root, { recursive: true })
  for (const name of ['emitter', 'host']) await rename(path.join(root, `${name}.ts.fixture`), path.join(root, `${name}.ts`))
  await symlink(path.resolve(import.meta.dir, '../plugins/scanners/angular/node_modules'), path.join(root, 'node_modules'), 'dir')
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

async function documents(root: string) {
  const records = await loadArchitecture(root)
  return new Map(await Promise.all(records.documents.map(async document => [
    document.sourceFilename, await readFile(path.join(root, document.sourceFilename), 'utf8'),
  ] as const)))
}

test.concurrent('packaged Angular resolves an output callback beyond TypeScript and preserves source positions', async () => {
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
    expect(unsupported.diagnostics.some(item => item.code === 'unsupported-angular-binding' && item.message.startsWith('host.html:'))).toBe(true)
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
    const snapshot = await documents(root)
    await reconcileScanObservations(root, [angular, typescript])
    expect(await documents(root)).toEqual(snapshot)
    const after = await loadAnnotatedArchitecture(root)
    expect(owner(after, 'emitter.ts').id).toBe(source.id)
    expect(new Set(owner(after, 'emitter.ts').code.map(reference => reference.scanner))).toEqual(new Set(['typescript', 'angular']))
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('HTML edits use the installed scanner watch path and failed analysis preserves the map', async () => {
  const { temporary, root, artifact } = await setup()
  let watcher: Awaited<ReturnType<typeof watchScan>> | undefined
  try {
    await addScanner(root, path.relative(root, artifact))
    await scanRepository(root)
    let folded!: () => void
    let failed!: (error: unknown) => void
    const rescanned = new Promise<void>((resolve, reject) => { folded = resolve; failed = reject })
    watcher = await watchScan(root, { onFold: () => folded(), onError: error => failed(error) })
    await writeFile(path.join(root, 'host.html'), '<sample-editor />\n')
    await rescanned
    await watcher.close()
    watcher = undefined
    const after = await loadAnnotatedArchitecture(root)
    expect(after.relationships.flatMap(relationship => relationship.connections ?? [])).toEqual([])
    const previous = await documents(root)
    await writeFile(path.join(root, 'host.html'), '<sample-editor (saved)="receive(" />\n')
    await expect(scanRepository(root)).rejects.toThrow()
    expect(await documents(root)).toEqual(previous)
  } finally {
    await watcher?.close()
    await rm(temporary, { recursive: true, force: true })
  }
})
