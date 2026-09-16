import { expect, test } from 'bun:test'
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ScannerPlugin } from '@groma/scanner'
import { loadAnnotatedArchitecture, reconcileScanObservations } from '../src/core.ts'
import { editArchitecture } from '../src/edit.ts'
import { createScannerSession } from '../src/scanner/session.ts'

const artifact = process.env.GROMA_TEST_CSHARP_PACKAGE
const packaged = artifact ? test.concurrent : test.skip

packaged('packaged C# partial classes retain one curated owner and attach newly watched declarations', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-csharp-units-'))
  let session: Awaited<ReturnType<typeof createScannerSession>> | undefined
  try {
    await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
    await cp(path.resolve(import.meta.dir, '../test/fixtures/csharp-operations'), root, { recursive: true })
    const git = Bun.spawn(['git', 'init', '--quiet', root], { stdout: 'ignore', stderr: 'pipe' })
    expect(await git.exited).toBe(0)
    const scanner: ScannerPlugin = (await import(path.join(artifact!, 'dist/index.js'))).default
    const scan = (await scanner.scan(root))!
    const files = ['Core/Partial.Declaration.cs', 'Core/Partial.Implementation.cs']
    expect(scan.sourceUnits?.some(unit => files.every(file => unit.files.includes(file)))).toBe(true)
    expect(scan.invocations?.some(call => call.member === 'Step' && !call.unresolved)).toBe(true)
    await reconcileScanObservations(root, [scan])
    const initial = await loadAnnotatedArchitecture(root)
    const owners = initial.elements.filter(element => element.code.some(code => files.includes(code.file)))
    expect(owners).toHaveLength(1)
    const id = owners[0]!.id
    await editArchitecture(root, { id, title: 'Work processor', overview: 'Executes the work.' })
    const curated = await loadAnnotatedArchitecture(root)
    expect((await reconcileScanObservations(root, [(await scanner.scan(root))!])).created).toBe(0)
    expect(await loadAnnotatedArchitecture(root)).toEqual(curated)
    let completed: (() => void) | undefined
    session = await createScannerSession(root, { onFold() { completed?.() } })
    await session.change({ action: 'add', source: artifact! })
    expect(session.state.scanners.find(scanner => scanner.id === 'csharp')?.status).toBe('ready')
    const changed = Promise.withResolvers<void>()
    completed = () => changed.resolve()
    const added = 'Core/Partial.Third.cs'
    await writeFile(path.join(root, added), 'namespace Fixture; public partial class PartialWork { public void Finish() { } }')
    await changed.promise
    const after = await loadAnnotatedArchitecture(root)
    const matches = after.elements.filter(element => element.code.some(code => code.file === added))
    expect(matches).toHaveLength(1)
    expect(matches[0]!.id).toBe(id)
    expect(matches[0]!.title).toBe('Work processor')
    expect(new Set(matches[0]!.code.map(code => code.file))).toEqual(new Set([...files, added]))
  } finally {
    await session?.close()
    await rm(root, { recursive: true, force: true })
  }
}, 20000)
