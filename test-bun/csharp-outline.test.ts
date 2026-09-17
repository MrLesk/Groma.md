import { expect, test } from 'bun:test'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
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
