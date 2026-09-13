import { execFile } from 'node:child_process'
import { access } from 'node:fs/promises'
import path from 'node:path'
import type { ScannerSettings } from '@groma/scanner'
import { promisify } from 'node:util'
import { projectFiles } from '../../projects.ts'

export const execute = promisify(execFile)

interface CargoTarget { kind: string[]; src_path: string }
interface CargoPackage { id: string; name: string; manifest_path: string; targets: CargoTarget[] }
interface CargoMetadata { workspace_root: string; workspace_members: string[]; packages: CargoPackage[] }

export interface RustInput { root: string; manifest: string; name: string; targets: string[] }
export interface RustOptions { cargo?: string; rustc?: string; worker?: string }

export async function exists(file: string): Promise<boolean> {
  try { await access(file); return true } catch { return false }
}

function manifestAt(root: string, settings: ScannerSettings): string {
  if (settings.manifest === undefined) return path.join(root, 'Cargo.toml')
  if (typeof settings.manifest !== 'string') {
    throw new Error('RUST_PROJECT_SELECTION: Set settings.manifest on the rust entry in scanners.json to a Cargo.toml path.')
  }
  return path.resolve(root, settings.manifest)
}

export async function readRustProject(root: string, settings: ScannerSettings, options: RustOptions, workspace = false): Promise<RustInput> {
  const manifest = manifestAt(root, settings)
  if (!await exists(manifest)) {
    throw new Error('RUST_PROJECT_MISSING: Select an existing Cargo.toml with settings.manifest on the rust entry in scanners.json.')
  }
  let metadata: CargoMetadata
  try {
    const result = await execute(options.cargo ?? 'cargo',
      ['metadata', '--format-version', '1', '--offline', '--locked', '--manifest-path', manifest],
      { cwd: path.dirname(manifest), maxBuffer: 64 * 1024 * 1024 })
    metadata = JSON.parse(result.stdout)
  } catch (error) {
    throw new Error(`RUST_CARGO_NOT_READY: Install the project's Rust toolchain, then run cargo fetch --manifest-path "${manifest}" to prepare its lockfile and dependencies. ${error}`)
  }
  const packageAtManifest = metadata.packages.find(pkg => pkg.manifest_path === manifest)
  const packages = packageAtManifest && !workspace ? [packageAtManifest] :
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

export async function rustProjects(root: string, settings: ScannerSettings, options: RustOptions = {}): Promise<string[]> {
  if (settings.manifest !== undefined) return [manifestAt(root, settings)]
  const selected = new Set<string>()
  const covered = new Set<string>()
  for (const file of await projectFiles(root, file => path.posix.basename(file) === 'Cargo.toml')) {
    const manifest = path.resolve(root, file)
    if (covered.has(manifest)) continue
    const { stdout } = await execute(options.cargo ?? 'cargo',
      ['metadata', '--no-deps', '--format-version', '1', '--offline', '--locked', '--manifest-path', manifest],
      { cwd: path.dirname(manifest), maxBuffer: 64 * 1024 * 1024 })
    const metadata: CargoMetadata = JSON.parse(stdout)
    selected.add(path.join(metadata.workspace_root, 'Cargo.toml'))
    for (const pkg of metadata.packages) if (metadata.workspace_members.includes(pkg.id)) covered.add(pkg.manifest_path)
    covered.add(path.join(metadata.workspace_root, 'Cargo.toml'))
  }
  return [...selected].sort()
}
