import { cp, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { expect, test } from 'bun:test'

import { loadAnnotatedArchitecture } from '../../../../src/core.ts'
import { scanRepository } from '../../../../src/scanner.ts'
import { addScanner, scannerInventory } from '../../../../src/scanner/modules/inventory.ts'
import { loadScannerRegistry } from '../../../../src/scanner/registry.ts'
import { cli, execute, fixture, snapshot, staged, writeTree } from './helpers.ts'

async function configure(root: string): Promise<void> {
  await execute('git', ['init', '--quiet'], { cwd: root })
  await execute('git', ['add', '-A'], { cwd: root })
  await cp(staged, path.join(root, '.scanner-package'), { recursive: true })
  await addScanner(root, './.scanner-package')
}

test.concurrent('registered Rust and embedded TypeScript reconcile into one map and preserve authored communication', async () => {
  await fixture({}, async root => {
    await configure(root)
    const registry = await loadScannerRegistry(root)
    expect((await registry.collectObservations(root)).map(observation => observation.scanner.language).sort()).toEqual(['rust', 'typescript'])
    expect(await scannerInventory(root)).toContainEqual({ id: 'rust', source: './.scanner-package', status: 'found' })
    await scanRepository(root)
    const first = await loadAnnotatedArchitecture(root)
    const files = first.elements.flatMap(element => element.code.map(reference => reference.file))
    expect(files).toContain('backend/src/provider.rs')
    expect(files).toContain('frontend/index.ts')
    expect(first.relationships.some(relation => relation.description?.includes('Invokes supplied opened callback'))).toBe(true)
    const provider = first.elements.find(element => element.code.some(code => code.file === 'backend/src/provider.rs'))!
    const facade = first.elements.find(element => element.code.some(code => code.file === 'backend/src/api.rs'))!
    await cli(root, 'edit', provider.id, '--combine', facade.id)
    await cli(root, 'edit', provider.id, '--overview', 'Owns output generation.')
    const relation = ['relation', 'frontend/index.ts', 'backend/src/provider.rs', '--description', 'Requests a view', '--technology', 'HTTPS']
    await cli(root, 'add', ...relation)
    await scanRepository(root)
    const before = await snapshot(root)
    await scanRepository(root)
    expect(await snapshot(root)).toEqual(before)
    const world = await loadAnnotatedArchitecture(root)
    expect(world.relationships.some(relation => relation.description === 'Requests a view')).toBe(true)
    const curated = world.elements.find(element => element.id === provider.id)!
    expect(curated.code.map(reference => reference.file).sort()).toEqual(['backend/src/api.rs', 'backend/src/provider.rs'])
    expect(curated.overview).toBe('Owns output generation.')
  }, true)
})

test.concurrent('a Rust failure aborts the whole batch before TypeScript changes reach Markdown', async () => {
  await fixture({}, async root => {
    await configure(root)
    await scanRepository(root)
    const before = await snapshot(root)
    await writeFile(path.join(root, 'backend/src/provider.rs'), 'pub fn syntax_error(')
    await writeTree(root, { 'frontend/new.ts': 'export function newFeature() {}' })
    await execute('git', ['add', 'frontend/new.ts'], { cwd: root })
    await expect(scanRepository(root)).rejects.toThrow('Rust scan failed')
    expect(await snapshot(root)).toEqual(before)
  }, true)
})
