import { expect, test } from 'bun:test'
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { scanRustSource, checkRustReadiness, isRustScanFile } from '../plugins/scanners/rust/src/index.ts'
import { execute } from '../plugins/scanners/rust/src/project.ts'
import { loadAnnotatedArchitecture } from '../src/core.ts'
import { scanRepository } from '../src/scanner.ts'
import { addScanner } from '../src/scanner/modules/inventory.ts'
import type { ScanObservation } from '@groma/scanner'

const worker = process.env.GROMA_TEST_RUST
const rustTest = worker ? test.concurrent : test.skip
const packagePath = path.resolve(import.meta.dir, '../plugins/scanners/rust/dist/package')
const cli = path.resolve(import.meta.dir, '../src/cli.ts')

async function fixture(name: string, action: (root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma rust '))
  try {
    await cp(path.resolve(import.meta.dir, '../test/fixtures', name), root, { recursive: true })
    await execute('cargo', ['generate-lockfile', '--offline'], { cwd: root })
    await action(root)
  } finally { await rm(root, { recursive: true, force: true }) }
}

function evidence(observation: ScanObservation) {
  const operations = new Map(observation.operations!.map(operation => [operation.id, operation]))
  return observation.invocations!.map(call => ({
    ...call, caller: operations.get(call.source)!,
    providers: call.targets.map(id => operations.get(id)!),
  }))
}

async function snapshot(root: string) {
  const directory = path.join(root, 'groma')
  const files = (await readdir(directory, { recursive: true })).filter(file => file.endsWith('.md')).sort()
  return Promise.all(files.map(async file => [file, await readFile(path.join(directory, file), 'utf8')]))
}

test.concurrent('Rust readiness reports a missing worker before producing evidence', async () => {
  await expect(checkRustReadiness(os.tmpdir(), { worker: '/missing/groma-rust-scanner' }))
    .rejects.toThrow('RUST_WORKER_MISSING')
})

test.concurrent('Cargo and toolchain changes invalidate Rust scans; generated target files do not', () => {
  for (const file of ['src/lib.rs', 'Cargo.lock', 'Cargo.toml', '.groma-rust.json', 'rust-toolchain.toml', '.cargo/config.toml']) {
    expect(isRustScanFile(file)).toBeTrue()
  }
  expect(isRustScanFile('target/generated.rs')).toBeFalse()
})

rustTest('rust-analyzer owns alias and inherent method targets while unsupported dispatch stays uncertain', async () => {
  await fixture('rust-semantic', async root => {
    const first = await scanRustSource(root, { worker })
    expect(await scanRustSource(root, { worker })).toEqual(first)
    expect(first.files.map(file => file.file)).not.toContain('src/unreferenced.rs')
    const calls = evidence(first)
    const alias = calls.find(call => call.caller.name === 'entry')!
    expect(alias.providers.map(provider => provider.file)).toEqual(['src/provider.rs'])
    expect(alias.unresolved).toBeFalse()
    expect(calls.find(call => call.caller.name === 'through_method')!.unresolved).toBeFalse()
    const chained = calls.filter(call => call.caller.name === 'chained')
    expect(chained.flatMap(call => call.providers.map(provider => provider.name)).sort()).toEqual(['create', 'work'])
    expect(new Set(chained.map(call => call.position)).size).toBe(1)
    for (const name of ['dynamic', 'callback']) {
      expect(calls.find(call => call.caller.name === name)).toMatchObject({ providers: [], unresolved: true })
    }
    expect(calls.some(call => call.caller.name === 'later')).toBeFalse()
    expect(first.operations!.every(operation => Number.isInteger(operation.position))).toBeTrue()
  })
}, 60000)

rustTest('wildcard import of a local module never resolves to the dependency with the same name', async () => {
  await fixture('rust-collision', async root => {
    await execute('cargo', ['run', '--offline', '--locked', '--quiet', '-p', 'app'], { cwd: root })
    const observation = await scanRustSource(root, { worker })
    const call = evidence(observation).find(call => call.caller.name === 'main')!
    expect(call.unresolved).toBeFalse()
    expect(call.providers.map(provider => provider.file)).toEqual(['app/src/local.rs'])
  })
}, 60000)

rustTest('shared compilation source has one identity and no guessed provider from either context', async () => {
  await fixture('rust-shared', async root => {
    const observation = await scanRustSource(root, { worker })
    expect(observation.files.filter(file => file.file === 'src/shared.rs')).toHaveLength(1)
    expect(observation.placements.filter(file => file.file === 'src/shared.rs')).toHaveLength(1)
    expect(observation.operations!.some(operation => operation.file === 'src/shared.rs')).toBeFalse()
    expect(observation.diagnostics.some(diagnostic => diagnostic.code === 'rust-unsupported-compilation-contexts')).toBeTrue()
    expect(observation.scopes).toHaveLength(1)
    expect(await scanRustSource(root, { worker })).toEqual(observation)
  })
}, 60000)

rustTest('registered Rust scans preserve curated ownership and a failed scan preserves the prior Markdown', async () => {
  await fixture('rust-semantic', async root => {
    await execute('git', ['init', '--quiet'], { cwd: root })
    await execute('git', ['add', '-A'], { cwd: root })
    await addScanner(root, packagePath)
    await scanRepository(root)
    const world = await loadAnnotatedArchitecture(root)
    const provider = world.elements.find(element => element.code.some(code => code.file === 'src/provider.rs'))!
    const api = world.elements.find(element => element.code.some(code => code.file === 'src/api.rs'))!
    await execute(process.execPath, [cli, 'edit', provider.id, '--combine', api.id], { cwd: root })
    await execute(process.execPath, [cli, 'edit', provider.id, '--overview', 'Owns execution.'], { cwd: root })
    await scanRepository(root)
    const before = await snapshot(root)
    await scanRepository(root)
    expect(await snapshot(root)).toEqual(before)
    const curated = (await loadAnnotatedArchitecture(root)).elements.find(element => element.id === provider.id)!
    expect(curated.code.map(code => code.file).sort()).toEqual(['src/api.rs', 'src/provider.rs'])
    expect(curated.overview).toBe('Owns execution.')
    await writeFile(path.join(root, 'src/provider.rs'), 'pub fn broken(')
    await expect(scanRepository(root)).rejects.toThrow('RUST_ANALYSIS_FAILED')
    expect(await snapshot(root)).toEqual(before)
    await expect(checkRustReadiness(root, { worker, cargo: path.join(root, 'missing-cargo') }))
      .rejects.toThrow('RUST_TOOLCHAIN_MISSING')
  })
}, 60000)
