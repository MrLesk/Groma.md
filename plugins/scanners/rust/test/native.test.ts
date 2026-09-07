import { expect, test } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'

import { isRustScanFile, scanRustSource } from '../src/index.ts'
import { execute, executable, fixture, manifest, scan } from './helpers.ts'

const source = (body: string) => ({ 'Cargo.toml': manifest, 'src/lib.rs': body })

test.concurrent('no Cargo source set returns undefined, never a fabricated empty Rust map', async () => {
  await fixture({}, async root => expect(await scanRustSource(root, executable)).toBeUndefined())
})

test.concurrent('watch matches scanner inputs but ignores build products', () => {
  for (const file of ['backend/Cargo.toml', 'backend/src/lib.rs', '.groma-rust.json']) expect(isRustScanFile(file)).toBe(true)
  for (const file of ['backend/target/out.rs', 'node_modules/sample/lib.rs', 'README.md']) expect(isRustScanFile(file)).toBe(false)
})

test.concurrent('complete atomic file evidence is deterministic and reexports identify the implementation', async () => {
  await fixture({}, async root => {
    const first = await scan(root)
    expect(await scan(root)).toEqual(first)
    expect(first.files.map(file => file.file)).toEqual([
      'backend/src/api.rs', 'backend/src/lib.rs', 'backend/src/provider.rs', 'backend/src/worker.rs',
    ])
    expect(first.files.find(file => file.file.endsWith('api.rs'))?.symbols).toEqual([])
    const caller = first.operations!.find(operation => operation.name === 'direct')!
    const invocation = first.invocations!.find(invocation => invocation.source === caller.id)!
    expect(invocation.unresolved).toBe(false)
    expect(first.operations!.find(operation => operation.id === invocation.targets[0])?.file).toBe('backend/src/provider.rs')
    expect(first.placements).toHaveLength(4)
  }, true)
})

test.concurrent('active wrappers remain executable intermediaries', async () => {
  await fixture({ 'backend/src/api.rs': 'pub fn display() { crate::provider::open(); }\n' }, async root => {
    const result = await scan(root)
    const caller = result.operations!.find(operation => operation.name === 'direct')!
    const edge = result.invocations!.find(edge => edge.source === caller.id)!
    expect(result.operations!.find(operation => edge.targets.includes(operation.id))?.file).toBe('backend/src/api.rs')
  }, true)
})

test.concurrent('methods, glob imports and shadowed local names never acquire guessed free-function targets', async () => {
  await fixture(source(`mod provider { pub fn open() {} }
use provider::*;
fn open() {}
fn shadow(open: fn()) { open(); }
fn method(value: Unknown) { value.open(); }
fn nested() { fn open() {} open(); }
fn macro_scope() { bind!(); open(); }
fn external() { missing::open(); }
`), async root => {
    const result = await scan(root)
    expect(result.invocations!.length).toBeGreaterThan(0)
    expect(result.invocations!.every(call => call.unresolved && call.targets.length === 0)).toBe(true)
  })
})

test.concurrent('cfg alternatives retain uncertainty rather than selecting an arbitrary implementation', async () => {
  await fixture(source(`#[cfg(feature="a")] fn open() {}
#[cfg(not(feature="a"))] fn open() {}
fn call() { open(); }
`), async root => {
    const result = await scan(root)
    const invocation = result.invocations![0]!
    expect(invocation.targets).toHaveLength(2)
    expect(invocation.unresolved).toBe(true)
  })
})

test.concurrent('cfg on a module propagates to canonical calls', async () => {
  await fixture(source('#[cfg(feature="a")] mod provider { pub fn open() {} }\nfn call() { crate::provider::open(); }'), async root => {
    expect((await scan(root)).invocations![0]!.unresolved).toBe(true)
  })
})

test.concurrent('raw identifiers and grouped module aliases resolve without basename matching', async () => {
  await fixture(source(`mod provider { pub fn r#match() {} }
use crate::provider::{self as api, r#match as action};
fn call() { api::r#match(); action(); }
`), async root => {
    const result = await scan(root)
    expect(result.invocations!.every(call => !call.unresolved && call.targets.length === 1)).toBe(true)
    expect(new Set(result.invocations!.flatMap(call => call.targets)).size).toBe(1)
  })
})

test.concurrent('path attributes and inline modules follow the containing module directory', async () => {
  await fixture({ ...source('#[path="other.rs"] mod provider;\nmod nested { mod leaf; }\nfn call() { provider::open(); nested::leaf::open(); }'),
    'src/other.rs': 'pub fn open() {}', 'src/nested/leaf.rs': 'pub fn open() {}',
  }, async root => {
    const result = await scan(root)
    expect(result.files).toHaveLength(3)
    expect(result.invocations!.every(call => !call.unresolved)).toBe(true)
  })
})

test.concurrent('workspace members, exclusions, custom binaries and renamed path dependencies share one observation', async () => {
  await fixture({
    'Cargo.toml': '[workspace]\nmembers=["crates/*"]\nexclude=["crates/excluded"]\n',
    'crates/app/Cargo.toml': '[package]\nname="app"\nversion="0.1.0"\nedition="2024"\n[[bin]]\nname="app"\npath="entry.rs"\n[dependencies]\nservice={package="provider",path="../provider"}\n',
    'crates/app/entry.rs': 'fn main() { service::open(); }',
    'crates/provider/Cargo.toml': manifest.replace('sample', 'provider'),
    'crates/provider/src/lib.rs': 'pub fn open() {}',
    'crates/excluded/Cargo.toml': 'invalid toml [',
  }, async root => {
    const result = await scan(root)
    expect(result.scopes).toHaveLength(2)
    expect(result.files).toHaveLength(2)
    expect(result.invocations![0]!.unresolved).toBe(false)
    expect(result.operations!.find(operation => operation.id === result.invocations![0]!.targets[0])!.file).toBe('crates/provider/src/lib.rs')
  })
})

test.concurrent('build scripts, out-of-tree target artefacts and tests are not executed or scanned', async () => {
  await fixture({ ...source('#[cfg(test)] mod tests;\npub fn run() {}'),
    'build.rs': 'compile_error!("must not execute");',
    'tests/integration.rs': 'invalid rust', 'target/generated.rs': 'invalid rust',
    'Cargo.lock': 'this lock is deliberately not a Cargo resolver input',
  }, async root => {
    const before = await Bun.file(path.join(root, 'Cargo.lock')).text()
    expect((await scan(root)).files.map(file => file.file)).toEqual(['src/lib.rs'])
    expect(await Bun.file(path.join(root, 'Cargo.lock')).text()).toBe(before)
  })
})

for (const [label, files] of Object.entries({
  syntax: source('pub fn broken( {'),
  missingModule: source('mod missing;'),
  fileBudget: { ...source('pub fn run() {}'), '.groma-rust.json': '{"maxFiles":1}' },
  byteBudget: { ...source('pub fn run() {}'), '.groma-rust.json': '{"maxBytes":1}' },
  recursiveModule: { ...source('#[path="lib.rs"] mod again;') },
  invalidConfig: { ...source(''), '.groma-rust.json': '{"unexpected":true}' },
})) {
  test.concurrent(`${label} fails with no partial stdout`, async () => {
    await fixture(files, async root => {
      try {
        await execute(executable, [root])
        throw new Error('expected native failure')
      } catch (error) {
        expect((error as { code: number }).code).not.toBe(0)
        expect((error as { stdout: string }).stdout).toBe('')
        expect((error as { stderr: string }).stderr).toContain('Rust scan failed')
      }
    })
  })
}

test.concurrent('explicit manifest selection bounds discovery without a Cargo installation', async () => {
  await fixture({ ...source('fn root() {}'),
    'backend/Cargo.toml': manifest, 'backend/src/lib.rs': 'fn backend() {}',
    '.groma-rust.json': '{"manifests":["backend/Cargo.toml"]}',
  }, async root => {
    const result = await execute(executable, [root], { env: { PATH: '' } })
    expect(JSON.parse(result.stdout).files.map((file: { file: string }) => file.file)).toEqual(['backend/src/lib.rs'])
  })
})

test.concurrent('syntax repair produces a fresh valid observation', async () => {
  await fixture(source('invalid Rust'), async root => {
    await expect(scan(root)).rejects.toThrow()
    await writeFile(path.join(root, 'src/lib.rs'), 'pub fn repaired() {}')
    expect((await scan(root)).operations![0]!.name).toBe('repaired')
  })
})


test.concurrent('a path-loaded source owns its directory, not a directory named after its stem', async () => {
  await fixture({ ...source('#[path="alternate.rs"] mod provider;\nfn call() { provider::child::open(); }'),
    'src/alternate.rs': 'pub mod child;', 'src/child.rs': 'pub fn open() {}',
  }, async root => {
    const result = await scan(root)
    expect(result.files.map(file => file.file)).toContain('src/child.rs')
    expect(result.invocations![0]!.unresolved).toBe(false)
  })
})

test.concurrent('path attributes on inline modules reset from the physical containing source directory', async () => {
  await fixture({ ...source('mod outer;'),
    'src/outer.rs': '#[path="thread_files"] mod thread { #[path="tls.rs"] mod local; }',
    'src/thread_files/tls.rs': 'pub fn open() {}',
  }, async root => {
    expect((await scan(root)).files.map(file => file.file)).toContain('src/thread_files/tls.rs')
  })
})

test.concurrent('out-of-repository module paths are rejected, not read as owned code', async () => {
  await fixture(source(''), async outside => {
    await fixture(source(`#[path=${JSON.stringify(path.join(outside, 'src/lib.rs'))}] mod external;`), async root => {
      await expect(scan(root)).rejects.toThrow('outside repository')
    })
  })
})

test.concurrent('inherited optional path dependencies do not become unconditional providers', async () => {
  await fixture({
    'Cargo.toml': '[workspace]\nmembers=["app","provider"]\n[workspace.package]\nedition="2024"\n[workspace.dependencies]\nservice={package="provider",path="provider"}\n',
    'app/Cargo.toml': '[package]\nname="app"\nversion="0.1.0"\nedition.workspace=true\n[dependencies]\nservice={workspace=true,optional=true}\n',
    'app/src/lib.rs': 'pub fn run() { service::open(); }',
    'provider/Cargo.toml': manifest.replace('sample', 'provider'),
    'provider/src/lib.rs': 'pub fn open() {}',
  }, async root => {
    const call = (await scan(root)).invocations![0]!
    expect(call.targets).toHaveLength(1)
    expect(call.unresolved).toBe(true)
  })
})

test.concurrent('unsupported editions fail explicitly instead of pretending to resolve modern paths', async () => {
  await fixture({ ...source('fn run() {}'), 'Cargo.toml': manifest.replace('2024', '2015') }, async root => {
    await expect(scan(root)).rejects.toThrow('unsupported or unresolved Rust edition')
  })
})
