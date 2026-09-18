import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ScannerPlugin } from '@groma/scanner'
import { loadAnnotatedArchitecture } from '../src/core.ts'
import { addScanner } from '../src/scanner/modules/inventory.ts'
import { readCodeStructure } from '../src/viewers/source/structure.ts'

const artifact = process.env.GROMA_TEST_CSHARP_PACKAGE
const packaged = artifact ? test.concurrent : test.skip

packaged('a component outlines its C# files beside a TypeScript file in Code order', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-csharp-outline-'))
  try {
    await cp(path.resolve(import.meta.dir, '../test/fixtures/csharp-outline'), root, { recursive: true })
    const git = Bun.spawn(['git', 'init', '--quiet', root], { stdout: 'ignore', stderr: 'pipe' })
    expect(await git.exited).toBe(0)
    await addScanner(root, artifact!)
    await addScanner(root, path.resolve(import.meta.dir, '../plugins/scanners/typescript'))
    const world = await loadAnnotatedArchitecture(root)
    const component = world.elements.find(element => element.kind === 'component')!
    const files = await readCodeStructure(root, world, null, component.representationId) ?? []

    expect(files.map(file => file.file)).toEqual(component.code.map(reference => reference.file))
    // Both C# files declare the partial type; only the reference that names it marks it as an entry.
    const csharp = files.filter(file => file.file.endsWith('.cs'))
      .map(file => file.declarations.find(declaration => declaration.name === 'OrderService'))
    expect(csharp.map(type => [type?.kind, type?.entry])).toEqual([['type', true], ['type', false]])
  } finally { await rm(root, { recursive: true, force: true }) }
}, 60000)

packaged('a component with more Code files than one command line can hold is outlined', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-csharp-outline-many-'))
  try {
    const scanner = (await import(path.join(artifact!, 'dist/index.js'))).default as ScannerPlugin
    // About 1.3 MB of long paths, beyond the command-line limit of every supported platform.
    const directory = `${'a'.repeat(200)}/${'b'.repeat(200)}`
    await mkdir(path.join(root, directory), { recursive: true })
    const files = Array.from({ length: 2000 }, (_, index) => `${directory}/${`Orders${index}`.padEnd(200, 'x')}.cs`)
    const source = path.resolve(import.meta.dir, '../test/fixtures/csharp-outline/Orders/OrderService.cs')
    await Promise.all(files.map(file => cp(source, path.join(root, file))))

    const outline = await scanner.readCodeStructure!(root, files.map(file => ({ file, symbols: [] })), {})
    expect(outline.map(file => file.file)).toEqual(files)
  } finally { await rm(root, { recursive: true, force: true }) }
}, 60000)

packaged('the worker reads a UTF-8 request under a locale with another encoding', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-csharp-outline-zoë-'))
  try {
    await cp(path.resolve(import.meta.dir, '../test/fixtures/csharp-outline/Orders'), path.join(root, 'Orders'), { recursive: true })
    const entry = path.join(artifact!, 'dist/index.js')
    // The scanner runs in its own process so the locale reaches the worker without changing this one.
    const script = `const scanner = (await import(${JSON.stringify(entry)})).default
const files = await scanner.readCodeStructure(${JSON.stringify(root)}, [{ file: 'Orders/OrderService.cs', symbols: [] }], {})
console.log(JSON.stringify(files.map(file => file.file)))`
    const child = Bun.spawn([process.execPath, '-e', script], {
      env: { ...process.env, LC_ALL: 'en_US.ISO8859-1' }, stdout: 'pipe', stderr: 'pipe',
    })
    const [code, out, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code, error).toBe(0)
    expect(JSON.parse(out)).toEqual(['Orders/OrderService.cs'])
  } finally { await rm(root, { recursive: true, force: true }) }
}, 60000)
