import { execFile } from 'node:child_process'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

export const execute = promisify(execFile)

interface CargoTarget { kind: string[]; src_path: string }
interface CargoPackage { id: string; name: string; manifest_path: string; targets: CargoTarget[] }
interface CargoMetadata { workspace_members: string[]; packages: CargoPackage[] }

export interface RustInput { root: string; manifest: string; name: string; targets: string[] }
export interface RustOptions { cargo?: string; rustc?: string; worker?: string }

export async function exists(file: string): Promise<boolean> {
  try { await access(file); return true } catch { return false }
}

async function manifestAt(root: string): Promise<string> {
  const config = path.join(root, '.groma-rust.json')
  if (!await exists(config)) return path.join(root, 'Cargo.toml')
  const value: unknown = JSON.parse(await readFile(config, 'utf8'))
  if (!value || typeof value !== 'object' || !('manifest' in value) ||
      typeof value.manifest !== 'string') {
    throw new Error('RUST_PROJECT_SELECTION: Set .groma-rust.json to {"manifest":"path/to/Cargo.toml"}.')
  }
  return path.resolve(root, value.manifest)
}

export async function readRustProject(root: string, options: RustOptions): Promise<RustInput> {
  const manifest = await manifestAt(root)
  if (!await exists(manifest)) {
    throw new Error('RUST_PROJECT_MISSING: Select an existing Cargo.toml with .groma-rust.json {"manifest":"path/to/Cargo.toml"}.')
  }
  let metadata: CargoMetadata
  try {
    const result = await execute(options.cargo ?? 'cargo',
      ['metadata', '--format-version', '1', '--offline', '--locked', '--manifest-path', manifest],
      { cwd: root, maxBuffer: 64 * 1024 * 1024 })
    metadata = JSON.parse(result.stdout)
  } catch (error) {
    throw new Error(`RUST_CARGO_NOT_READY: Install the project's Rust toolchain, then run cargo fetch --manifest-path "${manifest}" to prepare its lockfile and dependencies. ${error}`)
  }
  const packageAtManifest = metadata.packages.find(pkg => pkg.manifest_path === manifest)
  const packages = packageAtManifest ? [packageAtManifest] :
    metadata.packages.filter(pkg => metadata.workspace_members.includes(pkg.id))
  const targets = packages.flatMap(pkg => pkg.targets)
    .filter(target => target.kind.some(kind => kind === 'lib' || kind === 'bin'))
    .map(target => target.src_path).sort()
  if (!targets.length) throw new Error('RUST_TARGET_MISSING: The selected Cargo project needs a library or binary target.')
  return { root, manifest, name: packageAtManifest?.name ?? path.basename(path.dirname(manifest)), targets }
}

export async function checkRustToolchain(root: string, options: RustOptions): Promise<void> {
  try {
    await execute(options.cargo ?? 'cargo', ['--version'], { cwd: root })
    const result = await execute(options.rustc ?? 'rustc', ['--print', 'sysroot'], { cwd: root })
    const library = path.join(result.stdout.trim(), 'lib/rustlib/src/rust/library')
    if (!await exists(library)) throw new Error('Rust standard library sources are missing.')
  } catch (error) {
    throw new Error(`RUST_TOOLCHAIN_MISSING: Install the project's Rust toolchain with Cargo and rustc, and add its standard library sources with rustup component add rust-src. ${error}`)
  }
}
