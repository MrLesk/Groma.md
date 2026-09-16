import { expect, test } from 'bun:test'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ScannerPlugin } from '@groma/scanner'
import { buildPackage } from '../plugins/scanners/php/build.ts'
import { discoverScanners } from '../src/scanner/modules/discovery.ts'
import { loadAnnotatedArchitecture, reconcileScanObservations } from '../src/core.ts'
import { loadArchitecture } from '../src/architecture-reader.ts'
import { editArchitecture } from '../src/edit.ts'
import { createScannerSession } from '../src/scanner/session.ts'

async function setup() {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-php-test-'))
  const root = path.join(temporary, 'project'), artifact = path.join(temporary, 'scanner')
  await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
  await cp(path.resolve(import.meta.dir, '../test/fixtures/php-source'), root, { recursive: true })
  const git = Bun.spawn(['git', 'init', '--quiet', root], { stdout: 'ignore', stderr: 'pipe' })
  expect(await git.exited).toBe(0)
  await buildPackage(artifact)
  const scanner: ScannerPlugin = (await import(path.join(artifact, 'dist/index.js'))).default
  return { temporary, root, artifact, scanner }
}

test.concurrent('packaged PHP discovers source without Composer and reports exact syntax evidence without execution', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    expect((await discoverScanners(root)).recommendations.some(scanner => scanner.id === 'php')).toBe(true)
    await scanner.checkReadiness?.(root)
    const scan = (await scanner.scan(root))!
    expect(await scanner.scan(root)).toEqual(scan)
    expect(scan.files.map(file => file.file)).toEqual(['plugin.php', 'view.php'])
    expect(scan.files.flatMap(file => file.symbols).some(symbol => symbol.name === 'Example\\ProposalService::send')).toBe(true)
    const source = await readFile(path.join(root, 'plugin.php'), 'utf8')
    const normalize = scan.operations!.find(operation => operation.name === 'Example\\normalize')!
    expect(normalize.position).toBe(source.indexOf('function normalize'))
    const view = await readFile(path.join(root, 'view.php'), 'utf8')
    const nested = scan.operations!.find(operation => operation.file === 'view.php' && operation.position === view.indexOf('fn('))!
    const call = scan.invocations!.find(call => call.position === view.indexOf('strtoupper'))!
    expect(call.source).toBe(nested.id)
    expect(scan.invocations!.every(call => call.unresolved && call.targets.length === 0)).toBe(true)
    expect(await Bun.file(path.join(root, 'executed')).exists()).toBe(false)
    await reconcileScanObservations(root, [scan])
    const before = await loadAnnotatedArchitecture(root)
    const component = before.elements.find(element => element.code.some(code => code.file === 'plugin.php'))!
    await editArchitecture(root, { id: component.id, title: 'Proposal submission' })
    const curated = await loadAnnotatedArchitecture(root)
    expect((await reconcileScanObservations(root, [scan])).created).toBe(0)
    expect(await loadAnnotatedArchitecture(root)).toEqual(curated)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('PHP syntax failures cannot publish a partial observation and ignored source is not scanned', async () => {
  const { temporary, root, scanner } = await setup()
  try {
    await writeFile(path.join(root, '.gitignore'), 'ignored.php\n')
    await writeFile(path.join(root, 'ignored.php'), '<?php function broken(')
    const before = (await scanner.scan(root))!
    expect(before.files.some(file => file.file === 'ignored.php')).toBe(false)
    await reconcileScanObservations(root, [before])
    const saved = await loadArchitecture(root)
    await writeFile(path.join(root, 'view.php'), '<?php function broken(')
    await expect(scanner.scan(root)).rejects.toThrow()
    expect(await loadArchitecture(root)).toEqual(saved)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test.concurrent('PHP source edits and new files refresh through the installed live scanner session', async () => {
  const { temporary, root, artifact } = await setup()
  let completed: (() => void) | undefined
  const session = await createScannerSession(root, { onFold() { completed?.() } })
  try {
    await session.change({ action: 'add', source: artifact })
    expect(session.state.scanners.find(scanner => scanner.id === 'php')?.status).toBe('ready')
    const before = await loadAnnotatedArchitecture(root)
    const id = before.elements.find(element => element.code.some(code => code.file === 'plugin.php'))!.id
    for (const file of ['plugin.php', 'new.php']) {
      const changed = Promise.withResolvers<void>()
      completed = () => changed.resolve()
      const source = file === 'new.php' ? '<?php function added() { return true; }' :
        (await readFile(path.join(root, file), 'utf8')).replace('normalize', 'prepare')
      await writeFile(path.join(root, file), source)
      await changed.promise
      const model = await loadAnnotatedArchitecture(root)
      expect(model.elements.filter(element => element.code.some(code => code.file === file))).toHaveLength(1)
      expect(model.elements.find(element => element.code.some(code => code.file === 'plugin.php'))!.id).toBe(id)
    }
  } finally { await session.close(); await rm(temporary, { recursive: true, force: true }) }
})
