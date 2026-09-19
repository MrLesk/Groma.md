import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import rust from '../plugins/scanners/rust/src/index.ts'
import { execute, readRustProject, rustProjects } from '../plugins/scanners/rust/src/project.ts'

async function fixture(action: (root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-rust-workspace-'))
  try {
    const files = JSON.parse(await readFile(path.resolve(import.meta.dir, '../test/fixtures/rust-workspace.json'), 'utf8'))
    for (const [file, source] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true })
      await writeFile(path.join(root, file), source as string)
    }
    await execute('git', ['init', '--quiet', root])
    await action(root)
  } finally { await rm(root, { recursive: true, force: true }) }
}

test.concurrent('implicit path members share workspace edition and local dependencies in one scan', async () => {
  await fixture(async root => {
    expect(await rustProjects(root, {})).toEqual([path.join(root, 'Cargo.toml')])
    const input = await readRustProject(root, {})
    expect(input.crates).toHaveLength(3)
    expect(input.crates.every(crate => crate.edition === '2024')).toBe(true)
    const dependencies = Object.fromEntries(input.crates.map(crate => [crate.display_name,
      crate.deps.map(dependency => input.crates[dependency.crate]!.display_name),
    ]))
    // Dev dependencies contribute workspace membership, but not calls in the library graph.
    expect(dependencies).toEqual({ app: ['service'], service: [], support: ['service'] })
  })
})

const nativeTest = process.env.GROMA_TEST_RUST ? test.concurrent : test.skip
nativeTest('Rust reads shared path modules and resolves calls across inherited workspace members', async () => {
  await fixture(async root => {
    const observation = (await rust.scan(root))!
    expect(observation.files).toHaveLength(4)
    expect(observation.files.filter(file => file.file === 'shared.rs')).toHaveLength(1)
    expect(observation.diagnostics.some(item => item.code === 'rust-unsupported-compilation-contexts'
      && item.file === 'shared.rs')).toBe(true)
    const operations = new Map(observation.operations!.map(operation => [operation.id, operation]))
    const calls = observation.invocations!.map(call => ({ caller: operations.get(call.source)?.name,
      targets: call.targets.map(target => operations.get(target)?.file), unresolved: call.unresolved }))
    expect(calls).toEqual([
      { caller: 'start', targets: ['service/src/lib.rs'], unresolved: false },
      { caller: 'setup', targets: ['service/src/lib.rs'], unresolved: false },
    ])
  })
}, 60000)
