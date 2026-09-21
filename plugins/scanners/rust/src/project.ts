import { execFile } from 'node:child_process'
import { access, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import type { ScannerSettings } from '@groma/scanner'
import { promisify } from 'node:util'
import { isUnder, projectFiles, repositoryFiles } from '../../projects.ts'

export const execute = promisify(execFile)

interface DependencyTables {
  dependencies?: Record<string, Dependency>
  'dev-dependencies'?: Record<string, Dependency>
  'build-dependencies'?: Record<string, Dependency>
}
interface Manifest extends DependencyTables {
  package?: { name: string; edition?: string | { workspace: boolean }; autobins?: boolean }
  workspace?: { members?: string[]; exclude?: string[]; package?: { edition?: string }; dependencies?: Record<string, Dependency> }
  lib?: { path?: string; name?: string }
  bin?: { path?: string; name: string }[]
  target?: Record<string, DependencyTables>
  features?: Record<string, string[]>
}
type Dependency = string | { path?: string; workspace?: boolean }
interface Crate {
  root_module: string; display_name: string; edition: string
  deps: { crate: number; name: string }[]; cfg: string[]
  source: { include_dirs: string[]; exclude_dirs: string[] }
}
export interface RustInput {
  root: string; manifest: string; name: string; targets: string[]; crates: Crate[]
  executables: { file: string; declaration: string; name: string }[]
}
export interface RustOptions { worker?: string }

export async function exists(file: string): Promise<boolean> {
  try { await access(file); return true } catch { return false }
}

function manifestAt(root: string, settings: ScannerSettings): string {
  if (settings.manifest === undefined) return path.join(root, 'Cargo.toml')
  if (typeof settings.manifest !== 'string') throw new Error('RUST_PROJECT_SELECTION: settings.manifest must be a Cargo.toml path.')
  return path.resolve(root, settings.manifest)
}

async function read(file: string): Promise<Manifest> {
  return Bun.TOML.parse(await readFile(file, 'utf8')) as Manifest
}

async function members(manifest: string, model: Manifest): Promise<string[]> {
  const directory = path.dirname(manifest)
  const files = model.package ? [manifest] : []
  for (const pattern of model.workspace?.members ?? []) {
    const glob = new Bun.Glob(`${pattern.replace(/\/$/, '')}/Cargo.toml`)
    for await (const file of glob.scan({ cwd: directory })) {
      const member = path.posix.dirname(file)
      if (model.workspace?.exclude?.some(exclude => new Bun.Glob(exclude).match(member))) continue
      files.push(path.resolve(directory, file))
    }
  }
  const selected = new Set(files)
  if (model.workspace) await includePathMembers(manifest, model, selected)
  return [...selected].sort()
}

/** Cargo also makes local path dependencies workspace members, including test and platform dependencies. */
async function includePathMembers(manifest: string, model: Manifest, selected: Set<string>): Promise<void> {
  const directory = path.dirname(manifest)
  for (const file of selected) {
    const pkg = { file, model: await read(file) }
    for (const dependency of pathDependencies(pkg, manifest, model)) {
      const relative = path.relative(directory, path.dirname(dependency)).split(path.sep).join('/')
      if (relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) continue
      if (model.workspace?.exclude?.some(exclude => new Bun.Glob(exclude).match(relative))) continue
      selected.add(dependency)
    }
  }
}

function pathDependencies(pkg: Package, manifest: string, model: Manifest): string[] {
  const tables = [pkg.model, ...Object.values(pkg.model.target ?? {})]
  return tables.flatMap(table => [table.dependencies, table['dev-dependencies'], table['build-dependencies']])
    .flatMap(declarations => Object.entries(declarations ?? {}))
    .flatMap(([name, declaration]) => dependencyManifest(pkg, manifest, model, name, declaration) ?? [])
}

function dependencyManifest(pkg: Package, manifest: string, model: Manifest, name: string, declaration: Dependency): string | undefined {
  const inherited = typeof declaration === 'object' && declaration.workspace
  const dependency = inherited ? model.workspace?.dependencies?.[name] : declaration
  if (typeof dependency !== 'object' || !dependency.path) return undefined
  return path.resolve(path.dirname(inherited ? manifest : pkg.file), dependency.path, 'Cargo.toml')
}

function features(model: Manifest): string[] {
  const enabled = new Set<string>()
  function add(name: string): void {
    if (enabled.has(name) || name.includes('/') || name.startsWith('dep:')) return
    enabled.add(name)
    for (const nested of model.features?.[name] ?? []) add(nested)
  }
  if (model.features?.default) add('default')
  return [...enabled].sort().map(name => `feature="${name}"`)
}

type SourceTarget = { file: string; name: string; library: boolean }
type Package = { file: string; model: Manifest }

async function automaticBins(directory: string, model: Manifest): Promise<NonNullable<Manifest['bin']>> {
  if (model.package?.autobins === false) return []
  const bins = []
  if (await exists(path.join(directory, 'src/main.rs'))) bins.push({ name: model.package!.name, path: 'src/main.rs' })
  const binRoot = path.join(directory, 'src/bin')
  if (!await exists(binRoot)) return bins
  for (const entry of await readdir(binRoot, { withFileTypes: true })) {
    const file = entry.isDirectory() ? `src/bin/${entry.name}/main.rs` : `src/bin/${entry.name}`
    if (file.endsWith('.rs') && await exists(path.join(directory, file))) bins.push({ name: path.basename(entry.name, '.rs'), path: file })
  }
  return bins
}

async function targets(manifest: string, model: Manifest): Promise<SourceTarget[]> {
  const directory = path.dirname(manifest)
  const result: SourceTarget[] = []
  const library = path.resolve(directory, model.lib?.path ?? 'src/lib.rs')
  if (await exists(library)) result.push({ file: library, name: model.lib?.name ?? model.package!.name.replaceAll('-', '_'), library: true })
  const bins = [...model.bin ?? []]
  for (const bin of await automaticBins(directory, model)) if (!bins.some(item => item.name === bin.name)) bins.push(bin)
  for (const bin of bins) {
    const file = path.resolve(directory, bin.path ?? `src/bin/${bin.name}.rs`)
    if (await exists(file)) result.push({ file, name: bin.name.replaceAll('-', '_'), library: false })
  }
  return result
}

async function sourceCrates(root: string, packages: Package[], model: Manifest) {
  const crates: Crate[] = []
  const libraries = new Map<string, number>()
  const owners: Package[] = []
  const executables: RustInput['executables'] = []
  for (const pkg of packages) {
    for (const target of await targets(pkg.file, pkg.model)) {
      const declaredEdition = pkg.model.package?.edition
      const edition = typeof declaredEdition === 'object' && declaredEdition.workspace
        ? model.workspace?.package?.edition : declaredEdition
      if (target.library) libraries.set(pkg.file, crates.length)
      else executables.push({ file: target.file, declaration: pkg.file, name: target.name })
      crates.push({ root_module: target.file, display_name: target.name,
        edition: typeof edition === 'string' ? edition : '2015', deps: [], cfg: features(pkg.model),
        // A #[path] module may be shared across crates. One source root keeps it visible in each context.
        source: { include_dirs: [root], exclude_dirs: [] } })
      owners.push(pkg)
    }
  }
  return { crates, libraries, owners, executables }
}

function dependencies(pkg: Package, manifest: string, model: Manifest, libraries: Map<string, number>): Crate['deps'] {
  const deps: Crate['deps'] = []
  for (const [name, declaration] of Object.entries(pkg.model.dependencies ?? {})) {
    const file = dependencyManifest(pkg, manifest, model, name, declaration)
    if (!file) continue
    const target = libraries.get(file)
    if (target !== undefined) deps.push({ crate: target, name: name.replaceAll('-', '_') })
  }
  return deps
}

export async function readRustProject(root: string, settings: ScannerSettings): Promise<RustInput> {
  const manifest = manifestAt(root, settings)
  const model = await read(manifest)
  const files = await members(manifest, model)
  const packages = await Promise.all(files.map(async file => ({ file, model: await read(file) })))
  const { crates, libraries, owners, executables } = await sourceCrates(root, packages, model)
  for (const [index, crate] of crates.entries()) {
    const pkg = owners[index]!
    crate.deps = dependencies(pkg, manifest, model, libraries)
    const library = libraries.get(pkg.file)
    if (library !== undefined && library !== index) crate.deps.push({ crate: library, name: crates[library]!.display_name })
  }
  if (!crates.length) throw new Error('RUST_TARGET_MISSING: The selected Cargo project needs a library or binary target.')
  return { root, manifest, name: model.package?.name ?? path.basename(path.dirname(manifest)), targets: crates.map(crate => crate.root_module).sort(), crates, executables }
}

/** Target-directory sources plus literal path modules shared outside those directories. */
export async function rustSourceFiles(root: string, settings: ScannerSettings): Promise<string[]> {
  const directories: string[] = []
  for (const manifest of await rustProjects(root, settings)) {
    const input = await readRustProject(root, { ...settings, manifest })
    directories.push(...input.targets.map(file => path.relative(root, path.dirname(file)).split(path.sep).join('/')))
  }
  const files = await repositoryFiles(root, file => file.endsWith('.rs'))
  const selected = new Set(files.filter(file => directories.some(directory => isUnder(file, directory))))
  for (const file of selected) {
    const source = await readFile(path.join(root, file), 'utf8')
    for (const match of source.matchAll(/#\s*\[\s*path\s*=\s*"([^"]+)"\s*\]/g)) {
      const shared = path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1]!))
      if (files.includes(shared)) selected.add(shared)
    }
  }
  return [...selected].sort()
}

export async function rustProjects(root: string, settings: ScannerSettings): Promise<string[]> {
  if (settings.manifest !== undefined) return [manifestAt(root, settings)]
  const selected = new Set<string>()
  const covered = new Set<string>()
  for (const file of await projectFiles(root, file => path.posix.basename(file) === 'Cargo.toml')) {
    const manifest = path.resolve(root, file)
    if (covered.has(manifest)) continue
    selected.add(manifest)
    for (const member of await members(manifest, await read(manifest))) covered.add(member)
  }
  return [...selected].sort()
}
