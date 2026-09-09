import { expect, test } from 'bun:test'
import { cp, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ScannerPlugin } from '@groma/scanner'
import { buildPackage } from '../plugins/scanners/react/build.ts'
import { scanTypeScriptSource } from '../plugins/scanners/typescript/src/scan.ts'
import { loadArchitecture } from '../src/architecture-reader.ts'
import { loadAnnotatedArchitecture, reconcileScanObservations } from '../src/core.ts'
import { editArchitecture } from '../src/edit.ts'
import { inferRelationships } from '../src/relationship-inference.ts'
import { scanRepository, watchScan } from '../src/scanner.ts'
import { addScanner } from '../src/scanner/modules/inventory.ts'
import type { AnnotatedArchitectureModel } from '../src/types.ts'

async function setup() {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-react-test-'))
  const root = path.join(temporary, 'project')
  const artifact = path.join(temporary, 'scanner')
  await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
  await cp(path.resolve(import.meta.dir, '../test/fixtures/react-callback'), root, { recursive: true })
  for (const name of ['editor', 'host']) await rename(path.join(root, `${name}.tsx.fixture`), path.join(root, `${name}.tsx`))
  await symlink(path.resolve(import.meta.dir, '../node_modules'), path.join(root, 'node_modules'), 'dir')
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

test.concurrent('packaged React supplies a JSX callback beyond TypeScript with original source positions', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    await scanner.checkReadiness!(root)
    const react = (await scanner.scan(root))!
    expect(await scanner.scan(root)).toEqual(react)
    expect(react.scanner.engineVersion).toBe('6.0.3')
    const typescript = (await scanTypeScriptSource(root))!
    const owners = new Map(react.files.map(file => [file.file, file.file]))
    expect(inferRelationships([typescript], owners)).toEqual([])
    expect(inferRelationships([typescript, react], owners)).toEqual([
      expect.objectContaining({ source: 'editor.tsx', target: 'host.tsx', technology: 'react' }),
    ])
    expect(react.invocations).toHaveLength(1)
    const invocation = react.invocations![0]!
    const source = await readFile(path.join(root, 'editor.tsx'), 'utf8')
    const host = await readFile(path.join(root, 'host.tsx'), 'utf8')
    const caller = react.operations!.find(operation => operation.id === invocation.source)!
    const target = react.operations!.find(operation => operation.id === invocation.targets[0])!
    expect(caller.position).toBe(source.indexOf('() =>'))
    expect(target.position).toBe(host.indexOf('(value: string) =>'))
    expect(invocation.position).toBe(source.indexOf("saved('ready')"))
    expect(invocation.binding).toEqual({ file: 'host.tsx', line: 4, position: host.indexOf('saved={') })
    expect(typescript.operations!.some(operation => operation.file === caller.file && operation.position === caller.position)).toBe(true)
    const conflicting = structuredClone(react)
    conflicting.scanner.language = 'other'
    conflicting.invocations![0]!.targets = [caller.id]
    expect(inferRelationships([react, conflicting], owners)).toEqual([])
    expect(inferRelationships([conflicting, react], owners)).toEqual([])
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('React abstains on conditional handlers and JSX spreads and reports missing prerequisites', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const file = path.join(root, 'host.tsx')
    const original = await readFile(file, 'utf8')
    await writeFile(file, original.replace('saved={receive}', 'saved={Math.random() ? receive : (value: string) => console.log(value)}'))
    const conditional = (await scanner.scan(root))!
    expect(conditional.invocations).toEqual([])
    expect(conditional.diagnostics.some(item => item.code === 'unsupported-react-binding')).toBe(true)
    await writeFile(file, original.replace('saved={receive}', '{...{saved: receive}}'))
    const spread = (await scanner.scan(root))!
    expect(spread.invocations).toEqual([])
    expect(spread.diagnostics.some(item => item.code === 'unsupported-react-binding')).toBe(true)
    await rename(path.join(root, 'node_modules'), path.join(root, 'dependencies'))
    await expect(scanner.checkReadiness!(root)).rejects.toThrow('REACT_PROJECT_PREPARATION')
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('React overlapping scans retain curated ownership in either observation order', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const typescript = (await scanTypeScriptSource(root))!
    await reconcileScanObservations(root, [typescript])
    const source = owner(await loadAnnotatedArchitecture(root), 'editor.tsx')
    await editArchitecture(root, { id: source.id, overview: 'Publishes a completed edit.' })
    const react = (await scanner.scan(root))!
    await reconcileScanObservations(root, [typescript, react])
    const snapshot = await documents(root)
    await reconcileScanObservations(root, [react, typescript])
    expect(await documents(root)).toEqual(snapshot)
    const after = await loadAnnotatedArchitecture(root)
    expect(owner(after, 'editor.tsx').id).toBe(source.id)
    expect(new Set(owner(after, 'editor.tsx').code.map(reference => reference.scanner))).toEqual(new Set(['typescript', 'react']))
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('TSX edits rescan the installed plugin and failed analysis preserves the complete map', async () => {
  const { temporary, root, artifact } = await setup()
  let watcher: Awaited<ReturnType<typeof watchScan>> | undefined
  try {
    await addScanner(root, path.relative(root, artifact))
    await scanRepository(root)
    let folded!: () => void
    let failed!: (error: unknown) => void
    const rescanned = new Promise<void>((resolve, reject) => { folded = resolve; failed = reject })
    watcher = await watchScan(root, { onFold: () => folded(), onError: error => failed(error) })
    const file = path.join(root, 'editor.tsx')
    const original = await readFile(file, 'utf8')
    await writeFile(file, original.replace("saved('ready')", "console.log('ready')"))
    await rescanned
    await watcher.close()
    watcher = undefined
    const after = await loadAnnotatedArchitecture(root)
    expect(after.relationships.flatMap(relationship => relationship.connections ?? [])).toEqual([])
    const previous = await documents(root)
    await writeFile(file, 'export function Editor(')
    await expect(scanRepository(root)).rejects.toThrow('REACT_PROJECT_PREPARATION')
    expect(await documents(root)).toEqual(previous)
  } finally {
    await watcher?.close()
    await rm(temporary, { recursive: true, force: true })
  }
})
