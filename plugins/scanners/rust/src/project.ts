import { execFile } from 'node:child_process'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { ScannerSettings } from '@groma/scanner'
import { promisify } from 'node:util'
import { isUnder } from '../../projects.ts'

export const execute = promisify(execFile)

/** The scanner's files: repository-relative paths with `/` separators. */
type Files = ReadonlySet<string>

interface DependencyTables {
  dependencies?: Record<string, Dependency>
  'dev-dependencies'?: Record<string, Dependency>
  'build-dependencies'?: Record<string, Dependency>
}
interface Manifest extends DependencyTables {
  package?: { name: string; edition?: string | { workspace: boolean }; autobins?: boolean }
  workspace?: { members?: string[]; exclude?: string[]; package?: { edition?: string }; dependencies?: Record<string, Dependency> }
  lib?: { path?: string; name?: string }
  bin?: { path?: string; name: string; 'required-features'?: string[] }[]
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
export async function exists(file: string): Promise<boolean> {
  try { await access(file); return true } catch { return false }
}

/** A path inside the repository in the form of the scanner's files: relative, with `/` separators. */
function repositoryPath(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join('/')
}

function manifestAt(root: string, settings: ScannerSettings): string {
  if (settings.manifest === undefined) return path.join(root, 'Cargo.toml')
  if (typeof settings.manifest !== 'string') throw new Error('RUST_PROJECT_SELECTION: settings.manifest must be a Cargo.toml path.')
  return path.resolve(root, settings.manifest)
}

async function read(file: string): Promise<Manifest> {
  return Bun.TOML.parse(await readFile(file, 'utf8')) as Manifest
}

/** A manifest's own package and its workspace members among the scanner's files, less those Cargo's `exclude` names. */
async function members(root: string, manifest: string, model: Manifest, files: Files): Promise<string[]> {
  const directory = path.dirname(manifest)
  const found = model.package ? [manifest] : []
  const patterns = (model.workspace?.members ?? []).map(pattern => new Bun.Glob(path.posix.join(pattern, 'Cargo.toml')))
  for (const file of files) {
    if (path.posix.basename(file) !== 'Cargo.toml') continue
    const member = path.resolve(root, file)
    const relative = path.relative(directory, member).split(path.sep).join('/')
    if (!patterns.some(pattern => pattern.match(relative))) continue
    if (model.workspace?.exclude?.some(exclude => new Bun.Glob(exclude).match(path.posix.dirname(relative)))) continue
    found.push(member)
  }
  const selected = new Set(found)
  if (model.workspace) await includePathMembers(root, manifest, model, selected, files)
  return [...selected].sort()
}

/** Adds the local path dependencies among the scanner's files, which Cargo also makes workspace members, including test and platform ones. */
async function includePathMembers(
  root: string, manifest: string, model: Manifest, selected: Set<string>, files: Files,
): Promise<void> {
  const directory = path.dirname(manifest)
  for (const file of selected) {
    const pkg = { file, model: await read(file) }
    for (const dependency of pathDependencies(pkg, manifest, model)) {
      const relative = path.relative(directory, path.dirname(dependency)).split(path.sep).join('/')
      if (relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) continue
      if (model.workspace?.exclude?.some(exclude => new Bun.Glob(exclude).match(relative))) continue
      if (files.has(repositoryPath(root, dependency))) selected.add(dependency)
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

function expandedFeatures(model: Manifest, initial: Set<string>): Set<string> {
  const enabled = new Set<string>()
  function add(name: string): void {
    if (enabled.has(name)) return
    enabled.add(name)
    for (const nested of model.features?.[name] ?? []) add(nested)
  }
  for (const name of initial) add(name)
  return enabled
}

function packageFeatures(packages: Package[], manifest: string, model: Manifest): Map<string, Set<string>> {
  const active = new Map(packages.map(pkg => [pkg.file, new Set(pkg.model.features?.default ? ['default'] : [])]))
  let changed = true
  while (changed) {
    changed = false
    for (const pkg of packages) {
      for (const value of expandedFeatures(pkg.model, active.get(pkg.file)!)) {
        if (activateDependencyFeature(pkg, value, active, manifest, model)) changed = true
      }
    }
  }
  return new Map(packages.map(pkg => [pkg.file, expandedFeatures(pkg.model, active.get(pkg.file)!)]))
}

function activateDependencyFeature(
  pkg: Package, value: string, active: Map<string, Set<string>>, manifest: string, model: Manifest,
): boolean {
  const [dependency, feature, extra] = value.split('/')
  if (!feature || extra || dependency!.endsWith('?')) return false
  const declaration = pkg.model.dependencies?.[dependency!]
  if (!declaration) return false
  const target = dependencyManifest(pkg, manifest, model, dependency!, declaration)
  const enabled = target && active.get(target)
  if (!enabled || enabled.has(feature)) return false
  enabled.add(feature)
  return true
}

type SourceTarget = { file: string; name: string; library: boolean }
type Package = { file: string; model: Manifest }

/**
 * Cargo's automatic binaries among the scanner's files for the package in a repository-relative directory: `src/main.rs`,
 * `src/bin/<name>.rs` and `src/bin/<name>/main.rs`.
 */
function conventionalBins(directory: string, model: Manifest, files: Files): NonNullable<Manifest['bin']> {
  const prefix = directory === '' ? '' : `${directory}/`
  const bins = []
  if (files.has(`${prefix}src/main.rs`)) bins.push({ name: model.package!.name, path: 'src/main.rs' })
  for (const file of files) {
    const match = file.startsWith(prefix) ? /^src\/bin\/(?:([^/]+)\.rs|([^/]+)\/main\.rs)$/.exec(file.slice(prefix.length)) : null
    if (match) bins.push({ name: match[1] ?? match[2]!, path: match[0] })
  }
  return bins
}

function binaryDeclarations(model: Manifest, conventional: NonNullable<Manifest['bin']>): NonNullable<Manifest['bin']> {
  const bins = [...model.bin ?? []]
  if (model.package?.autobins !== false) {
    for (const bin of conventional) if (!bins.some(item => item.name === bin.name)) bins.push(bin)
  }
  return bins
}

/** A package's library and binary targets whose root module is among the scanner's files. */
function targets(root: string, manifest: string, model: Manifest, enabled: Set<string>, files: Files): SourceTarget[] {
  const directory = path.dirname(manifest)
  const listed = (file: string) => files.has(repositoryPath(root, file))
  const result: SourceTarget[] = []
  const library = path.resolve(directory, model.lib?.path ?? 'src/lib.rs')
  if (listed(library)) result.push({ file: library, name: model.lib?.name ?? model.package!.name.replaceAll('-', '_'), library: true })
  const conventional = conventionalBins(repositoryPath(root, directory), model, files)
  for (const bin of binaryDeclarations(model, conventional)) {
    if (bin['required-features']?.some(feature => !enabled.has(feature))) continue
    const inferred = conventional.find(item => item.name === bin.name)?.path ?? `src/bin/${bin.name}.rs`
    const file = path.resolve(directory, bin.path ?? inferred)
    if (listed(file)) result.push({ file, name: bin.name.replaceAll('-', '_'), library: false })
  }
  return result
}

function sourceCrates(root: string, packages: Package[], model: Manifest, active: Map<string, Set<string>>, files: Files) {
  const crates: Crate[] = []
  const libraries = new Map<string, number>()
  const owners: Package[] = []
  const executables: RustInput['executables'] = []
  for (const pkg of packages) {
    const enabled = active.get(pkg.file)!
    for (const target of targets(root, pkg.file, pkg.model, enabled, files)) {
      const declaredEdition = pkg.model.package?.edition
      const edition = typeof declaredEdition === 'object' && declaredEdition.workspace
        ? model.workspace?.package?.edition : declaredEdition
      if (target.library) libraries.set(pkg.file, crates.length)
      else executables.push({ file: target.file, declaration: pkg.file, name: target.name })
      crates.push({ root_module: target.file, display_name: target.name,
        edition: typeof edition === 'string' ? edition : '2015', deps: [],
        cfg: [...enabled].filter(name => !name.includes('/') && !name.startsWith('dep:')).sort().map(name => `feature="${name}"`),
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

/** The workspace a member's manifest belongs to: its build context, read as Cargo reads it, whatever the scanner's files. */
async function workspaceContext(root: string, manifest: string, model: Manifest, files: Files): Promise<Package> {
  if (model.workspace) return { file: manifest, model }
  for (let directory = path.dirname(path.dirname(manifest)); directory === root || directory.startsWith(`${root}${path.sep}`); directory = path.dirname(directory)) {
    const candidate = path.join(directory, 'Cargo.toml')
    if (!await exists(candidate)) continue
    const ancestor = await read(candidate)
    if (ancestor.workspace && (await members(root, candidate, ancestor, files)).includes(manifest)) {
      return { file: candidate, model: ancestor }
    }
  }
  return { file: manifest, model }
}

/** The worker's crate graph for one Cargo project, from the manifests and target root modules among the scanner's files. */
export async function readRustProject(root: string, settings: ScannerSettings, files: readonly string[]): Promise<RustInput> {
  const listed = new Set(files)
  const manifest = manifestAt(root, settings)
  const model = await read(manifest)
  const { file: contextManifest, model: contextModel } = await workspaceContext(root, manifest, model, listed)
  const selected = new Set(model.workspace ? await members(root, manifest, model, listed) : [manifest])
  if (contextManifest !== manifest) await includePathMembers(root, contextManifest, contextModel, selected, listed)
  const manifests = [...selected].sort()
  const packages = await Promise.all(manifests.map(async file => ({ file, model: await read(file) })))
  const active = packageFeatures(packages, contextManifest, contextModel)
  const { crates, libraries, owners, executables } = sourceCrates(root, packages, contextModel, active, listed)
  for (const [index, crate] of crates.entries()) {
    const pkg = owners[index]!
    crate.deps = dependencies(pkg, contextManifest, contextModel, libraries)
    const library = libraries.get(pkg.file)
    if (library !== undefined && library !== index) crate.deps.push({ crate: library, name: crates[library]!.display_name })
  }
  if (!crates.length) throw new Error('RUST_TARGET_MISSING: The selected Cargo project needs a library or binary target.')
  return { root, manifest, name: model.package?.name ?? path.basename(path.dirname(manifest)), targets: crates.map(crate => crate.root_module).sort(), crates, executables }
}

/** The candidates in target root module directories plus literal path modules shared outside them, before exclusions. */
export async function rustSourceFiles(root: string, settings: ScannerSettings, candidates: readonly string[]): Promise<string[]> {
  const directories: string[] = []
  for (const manifest of await rustProjects(root, settings, candidates)) {
    // Cargo builds nothing from a project whose manifests it cannot read or that has no library or binary target.
    const input = await readRustProject(root, { ...settings, manifest }, candidates).catch(() => undefined)
    directories.push(...(input?.targets ?? []).map(file => repositoryPath(root, path.dirname(file))))
  }
  const sources = candidates.filter(file => file.endsWith('.rs'))
  const selected = new Set(sources.filter(file => directories.some(directory => isUnder(file, directory))))
  for (const file of selected) {
    const source = await readFile(path.join(root, file), 'utf8')
    for (const match of source.matchAll(/#\s*\[\s*path\s*=\s*"([^"]+)"\s*\]/g)) {
      const shared = path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1]!))
      if (sources.includes(shared)) selected.add(shared)
    }
  }
  return [...selected].sort()
}

/**
 * The Cargo projects to scan: the manifest `settings.manifest` names when it is among the scanner's files, or else
 * each `Cargo.toml` among them that no workspace already selected covers.
 */
export async function rustProjects(root: string, settings: ScannerSettings, files: readonly string[]): Promise<string[]> {
  const listed = new Set(files)
  if (settings.manifest !== undefined) {
    const manifest = manifestAt(root, settings)
    return listed.has(repositoryPath(root, manifest)) ? [manifest] : []
  }
  const selected = new Set<string>()
  const covered = new Set<string>()
  for (const file of files.filter(file => path.posix.basename(file) === 'Cargo.toml')) {
    const manifest = path.resolve(root, file)
    if (covered.has(manifest)) continue
    selected.add(manifest)
    // A manifest Cargo cannot read covers no member; reading it as a project reports why.
    const covers = await read(manifest).then(model => members(root, manifest, model, listed)).catch(() => [])
    for (const member of covers) covered.add(member)
  }
  return [...selected].sort()
}
