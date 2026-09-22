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

test.concurrent('implicit path members inherit editions only when declared and retain local dependencies', async () => {
  await fixture(async root => {
    expect(await rustProjects(root, {})).toEqual([path.join(root, 'Cargo.toml')])
    const input = await readRustProject(root, {})
    expect(input.crates).toHaveLength(3)
    expect(Object.fromEntries(input.crates.map(crate => [crate.display_name, crate.edition])))
      .toEqual({ app: '2024', service: '2024', support: '2015' })
    const dependencies = Object.fromEntries(input.crates.map(crate => [crate.display_name,
      crate.deps.map(dependency => input.crates[dependency.crate]!.display_name),
    ]))
    // Dev dependencies contribute workspace membership, but not calls in the library graph.
    expect(dependencies).toEqual({ app: ['service'], service: [], support: ['service'] })
  })
})

test.concurrent('selecting a workspace member keeps its inherited edition and local dependency', async () => {
  await fixture(async root => {
    const input = await readRustProject(root, { manifest: 'app/Cargo.toml' })
    const app = input.crates.find(crate => crate.display_name === 'app')!
    expect(app.edition).toBe('2024')
    expect(app.deps.map(dependency => input.crates[dependency.crate]!.display_name)).toContain('service')
  })
})

test.concurrent('explicit binaries without paths use Cargo source conventions even with autobins disabled', async () => {
  await fixture(async root => {
    await writeFile(path.join(root, 'app/Cargo.toml'), '[package]\nname = "app"\nversion = "0.1.0"\nautobins = false\n[[bin]]\nname = "app"\n[[bin]]\nname = "tool"\n')
    await mkdir(path.join(root, 'app/src/bin/tool'), { recursive: true })
    await writeFile(path.join(root, 'app/src/main.rs'), 'fn main() {}\n')
    await writeFile(path.join(root, 'app/src/bin/tool/main.rs'), 'fn main() {}\n')
    const input = await readRustProject(root, { manifest: 'app/Cargo.toml' })
    expect(input.executables.map(entry => path.relative(root, entry.file))).toEqual(['app/src/main.rs', 'app/src/bin/tool/main.rs'])
  })
})

test.concurrent('binary targets require their declared features to be active', async () => {
  await fixture(async root => {
    await writeFile(path.join(root, 'app/Cargo.toml'), '[package]\nname = "app"\nversion = "0.1.0"\n[features]\ndefault = ["enabled"]\nenabled = []\noptional = []\n[[bin]]\nname = "ready"\npath = "src/bin/ready.rs"\nrequired-features = ["enabled"]\n[[bin]]\nname = "gated"\npath = "src/bin/gated.rs"\nrequired-features = ["optional"]\n')
    await mkdir(path.join(root, 'app/src/bin'), { recursive: true })
    await writeFile(path.join(root, 'app/src/bin/ready.rs'), 'fn main() {}\n')
    await writeFile(path.join(root, 'app/src/bin/gated.rs'), 'fn main() {}\n')
    const input = await readRustProject(root, { manifest: 'app/Cargo.toml' })
    expect(input.executables.map(entry => entry.name)).toEqual(['ready'])
  })
})

test.concurrent('Rust source listing includes shared path modules outside target directories', async () => {
  await fixture(async root => {
    expect(await rust.listSourceFiles(root)).toContain('shared.rs')
  })
})

const nativeTest = process.env.GROMA_TEST_RUST ? test.concurrent : test.skip
nativeTest('Rust reads shared path modules and resolves calls across inherited workspace members', async () => {
  await fixture(async root => {
    const observation = (await rust.scan(root))!
    expect(observation.files).toHaveLength(4)
    expect(await rust.listSourceFiles(root)).toEqual(observation.files.map(file => file.file).sort())
    expect(observation.files.filter(file => file.file === 'shared.rs')).toHaveLength(1)
    expect(observation.diagnostics.some(item => item.code === 'rust-unsupported-compilation-contexts'
      && item.file === 'shared.rs')).toBe(true)
    const operations = new Map(observation.operations!.map(operation => [operation.id, operation]))
    const calls = observation.invocations!.map(call => ({ caller: operations.get(call.source)?.name,
      targets: call.targets.map(target => operations.get(target)?.file), unresolved: call.unresolved }))
    expect(calls).toEqual([
      { caller: 'start', targets: ['service/src/lib.rs'], unresolved: false },
      { caller: 'gen', targets: ['service/src/lib.rs'], unresolved: false },
    ])
  })
}, 60000)

nativeTest('a default feature activates a local dependency feature and its source module', async () => {
  await fixture(async root => {
    await writeFile(path.join(root, 'app/Cargo.toml'), '[package]\nname = "app"\nversion = "0.1.0"\nedition.workspace = true\n[dependencies]\nservice.workspace = true\n[features]\ndefault = ["service/extra"]\n')
    await writeFile(path.join(root, 'service/Cargo.toml'), '[package]\nname = "service"\nversion = "0.1.0"\nedition.workspace = true\n[features]\nextra = []\n')
    await writeFile(path.join(root, 'service/src/lib.rs'), 'pub fn run() {}\n#[cfg(feature = "extra")] mod extra;\n')
    await writeFile(path.join(root, 'service/src/extra.rs'), 'pub fn enabled() {}\n')
    const observation = (await rust.scan(root))!
    expect(observation.files.map(file => file.file)).toContain('service/src/extra.rs')
  })
}, 60000)
