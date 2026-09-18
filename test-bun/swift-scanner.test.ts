import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ScannerPlugin } from '@groma/scanner'
import { buildPackage } from '../plugins/scanners/swift/build.ts'
import { discoverScanners } from '../src/scanner/modules/discovery.ts'
import { addScanner } from '../src/scanner/modules/inventory.ts'
import { loadScannerRegistry } from '../src/scanner/registry.ts'
import { loadAnnotatedArchitecture, reconcileScanObservations } from '../src/core.ts'
import { editArchitecture } from '../src/edit.ts'
import { createScannerSession } from '../src/scanner/session.ts'
import { compileWatchPatterns } from '../src/scanner/watch-patterns.ts'
import { detectDuplicatedLogic } from '../src/architecture-findings.ts'

const swiftTest = process.platform === 'darwin' ? test.concurrent : test.skip

async function setup() {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-swift-test-'))
  const root = path.join(temporary, 'project'), artifact = path.join(temporary, 'scanner')
  await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
  await cp(path.resolve(import.meta.dir, '../test/fixtures/swift-source'), root, { recursive: true })
  const init = Bun.spawn(['git', 'init', '--quiet', root], { stderr: 'pipe' })
  expect(await init.exited, await new Response(init.stderr).text()).toBe(0)
  if (process.env.GROMA_TEST_SWIFT_PACKAGE) await cp(process.env.GROMA_TEST_SWIFT_PACKAGE, artifact, { recursive: true })
  else await buildPackage(artifact)
  const scanner: ScannerPlugin = (await import(path.join(artifact, 'src/index.js'))).default
  return { temporary, root, artifact, scanner }
}

swiftTest('Swift package preserves uncertainty, closure ownership and UTF-16 source positions', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    expect((await discoverScanners(root)).recommendations.some(scanner => scanner.id === 'swift')).toBe(true)
    await scanner.checkReadiness?.(root)
    const scan = (await scanner.scan(root))!
    expect(scan.files.map(file => file.file)).toEqual(['Ledger.swift', 'Other.swift'])
    expect(await scanner.scan(root)).toEqual(scan)
    const source = await readFile(path.join(root, 'Ledger.swift'), 'utf8')
    const adjusted = scan.operations!.find(operation => operation.name === 'Ledger.adjusted')!
    expect(adjusted.position).toBe(source.indexOf('public func adjusted'))
    const call = scan.invocations!.find(call => call.position === source.indexOf('unavailable(item)'))!
    const caller = scan.operations!.find(operation => operation.id === call.source)!
    expect(caller.position).toBe(source.indexOf('{ item in'))
    expect(caller.tokens).toBeUndefined()
    expect(scan.invocations!.every(call => call.unresolved && call.targets.length === 0)).toBe(true)

    const outlines = await scanner.readCodeStructure!(root, [{ file: 'Ledger.swift', symbols: ['Ledger', 'transform'] }])
    const ledger = outlines[0]!.declarations.find(declaration => declaration.name === 'Ledger')!
    expect(ledger.kind).toBe('type')
    if (ledger.kind !== 'type') throw new Error('Expected a type outline')
    expect(ledger.entry).toBe(true)
    expect(ledger.members.find(member => member.name === 'init')?.visibility).toBe('public')
    expect(ledger.members.find(member => member.name === 'local')?.visibility).toBe('private')
    expect(ledger.members.find(member => member.name === 'extended')?.visibility).toBe('public')
    expect(ledger.members.some(member => ['nested', 'computed'].includes(member.name))).toBe(false)
    expect(outlines[0]!.declarations.find(declaration => declaration.name === 'transform')?.kind).toBe('function')

    await reconcileScanObservations(root, [scan])
    const model = await loadAnnotatedArchitecture(root)
    const owner = model.elements.find(element => element.code.some(code => code.file === 'Ledger.swift'))!
    await editArchitecture(root, { id: owner.id, title: 'Curated source owner' })
    const curated = await loadAnnotatedArchitecture(root)
    expect((await reconcileScanObservations(root, [scan])).created).toBe(0)
    expect(await loadAnnotatedArchitecture(root)).toEqual(curated)
  } finally { await rm(temporary, { recursive: true, force: true }) }
}, 60000)

swiftTest('Swift comparable bodies normalize bindings while retaining member and literal differences', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    const scan = (await scanner.scan(root))!
    const tokens = (name: string) => scan.operations!.find(operation => operation.name === name)!.tokens!
    expect(tokens('Ledger.adjusted')).toEqual(tokens('duplicate'))
    expect(tokens('duplicate')).toEqual(tokens('transform'))
    expect(tokens('duplicate')).not.toEqual(tokens('changed'))
    const findings = detectDuplicatedLogic([scan], new Map(scan.files.map(file => [file.file, file.file])))
    expect(findings.some(finding => finding.match === 'exact'
      && new Set(finding.instances.map(instance => instance.file)).size === 2)).toBe(true)
    expect(tokens('access')).not.toEqual(tokens('otherAccess'))
    expect(tokens('access')).toContain('local:0')
    expect(tokens('access')).toContain('first')
    const shadow = tokens('shadow')
    expect(shadow.slice(shadow.lastIndexOf('external'))).toEqual(['external', '(', 'local:0', ')'])
    const conditional = tokens('conditional')
    expect(conditional.slice(conditional.lastIndexOf('external'), -1)).toEqual(['external', '(', 'local:0', ')'])
    expect(tokens('captured')).not.toContain('alias')
    expect(scan.operations!.filter(operation => operation.name === 'platform')).toHaveLength(2)
    const comparable = scan.operations!.filter(operation => operation.tokens)
    expect(comparable.every(operation => operation.startLine! > 0 && operation.endLine! >= operation.startLine!)).toBe(true)
  } finally { await rm(temporary, { recursive: true, force: true }) }
}, 60000)

swiftTest('installed Swift package runs without SDKs and excludes source through the shared registry', async () => {
  const { temporary, root, artifact, scanner } = await setup()
  try {
    const home = path.join(temporary, 'home'), bin = path.join(temporary, 'bin')
    await mkdir(home)
    await mkdir(bin)
    await symlink(Bun.which('git')!, path.join(bin, 'git'))
    const before = await readFile(path.join(root, 'Ledger.swift'), 'utf8')
    const runner = path.join(temporary, 'run.mjs')
    await writeFile(runner, `
      globalThis.fetch = () => { throw new Error('Unexpected scan network access') };
      const scanner = (await import(${JSON.stringify(path.join(artifact, 'src/index.js'))})).default;
      await scanner.checkReadiness(${JSON.stringify(root)});
      const first = await scanner.scan(${JSON.stringify(root)});
      const next = await scanner.scan(${JSON.stringify(root)});
      if (JSON.stringify(first) !== JSON.stringify(next)) throw new Error('Unstable evidence');
      console.log(first.files.length);
    `)
    const child = Bun.spawn([process.execPath, runner], { stdout: 'pipe', stderr: 'pipe',
      env: { PATH: bin, HOME: home, TMPDIR: temporary, DYLD_PRINT_LIBRARIES: '1' } })
    const [output, errors, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    expect(code, errors).toBe(0)
    expect(output.trim()).toBe('2')
    expect(errors).not.toContain('.xctoolchain/')
    expect(await readFile(path.join(root, 'Ledger.swift'), 'utf8')).toBe(before)

    await addScanner(root, artifact)
    const configPath = path.join(root, 'groma/scanners.json')
    const config = JSON.parse(await readFile(configPath, 'utf8'))
    await writeFile(configPath, JSON.stringify({ ...config, exclude: ['Other.swift'] }))
    await mkdir(path.join(root, 'Pods'))
    await writeFile(path.join(root, 'Pods/Bad.swift'), 'func bad(')
    await writeFile(path.join(root, '.gitignore'), 'Ignored.swift\n')
    await writeFile(path.join(root, 'Ignored.swift'), 'func bad(')
    const registry = await loadScannerRegistry(root)
    const batch = await registry.collectObservations(root)
    expect(batch.failures).toHaveLength(0)
    expect(batch.observations[0]!.files.map(file => file.file)).toEqual(['Ledger.swift'])
    expect(registry.watchesFile('New.swift')).toBe(true)
    expect(compileWatchPatterns(scanner.watch)('Pods/Bad.swift')).toBe(false)
    await writeFile(path.join(root, 'Ledger.swift'), 'func broken(')
    await expect(scanner.scan(root)).rejects.toThrow('SWIFT_SOURCE_INVALID')
    const failed = await registry.collectObservations(root)
    expect(failed.observations).toHaveLength(0)
    expect(failed.failures).toHaveLength(1)
  } finally { await rm(temporary, { recursive: true, force: true }) }
}, 60000)

swiftTest('Swift edits and new files refresh the installed scanner session', async () => {
  const { temporary, root, artifact } = await setup()
  let completed: (() => void) | undefined
  const session = await createScannerSession(root, { onFold() { completed?.() } })
  try {
    await session.change({ action: 'add', source: artifact })
    const before = await loadAnnotatedArchitecture(root)
    const owner = before.elements.find(element => element.code.some(code => code.file === 'Ledger.swift'))!
    for (const file of ['Ledger.swift', 'New.swift']) {
      const changed = Promise.withResolvers<void>()
      completed = () => changed.resolve()
      await writeFile(path.join(root, file), 'func replacement() { external() }\n')
      await changed.promise
      const next = await loadAnnotatedArchitecture(root)
      expect(next.elements.filter(element => element.code.some(code => code.file === file))).toHaveLength(1)
      expect(next.elements.find(element => element.code.some(code => code.file === 'Ledger.swift'))!.id).toBe(owner.id)
    }
  } finally { await session.close(); await rm(temporary, { recursive: true, force: true }) }
}, 60000)
