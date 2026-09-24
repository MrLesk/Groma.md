import { readFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * A package.json's fields, or none for a file that is not JSON, which names no package and no dependency. Source
 * listings read manifests before exclusions, so a broken manifest in an excluded folder must not fail them.
 */
export async function packageManifest(root: string, file: string): Promise<Record<string, unknown> | undefined> {
  try {
    return JSON.parse(await readFile(path.join(root, file), 'utf8'))
  } catch {
    return undefined
  }
}

export function hasDependency(manifest: Record<string, unknown>, dependency: string): boolean {
  return ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
    .some(section => typeof (manifest[section] as Record<string, unknown> | undefined)?.[dependency] === 'string')
}

function hasProjectConfig(directory: string, configs: Set<string>, options: FrameworkConfigs): boolean {
  if (options.nestedConfig && [...configs].some(config => directory === '.' || config.startsWith(`${directory}/`))) return true
  for (let current = directory; ; current = path.posix.dirname(current)) {
    if (configs.has(current)) return true
    if (!options.inheritConfig || current === '.') return false
  }
}

/** Where a framework package may keep the TypeScript config that compiles it, besides its own directory. */
export interface FrameworkConfigs {
  /** In a repository ancestor. */
  inheritConfig?: boolean
  /** In project directories below it, as Nx workspaces that declare dependencies once at their root do. */
  nestedConfig?: boolean
}

/**
 * The package directories among `files` that depend on a framework, keep its TypeScript config where `options` allows,
 * and hold a source with one of `extensions`.
 */
export async function frameworkProjects(
  root: string, files: readonly string[], dependency: string, extensions: readonly string[], options: FrameworkConfigs = {},
): Promise<string[]> {
  const manifests = files.filter(file => path.posix.basename(file) === 'package.json')
  const configs = new Set(files.filter(file => path.posix.basename(file) === 'tsconfig.json').map(file => path.posix.dirname(file)))
  const candidates = new Set<string>()
  for (const file of manifests) {
    const directory = path.posix.dirname(file)
    if (!hasProjectConfig(directory, configs, options)) continue
    const manifest = await packageManifest(root, file)
    if (manifest && hasDependency(manifest, dependency)) candidates.add(directory)
  }
  const sources = new Set<string>()
  for (const file of files.filter(file => extensions.some(extension => file.endsWith(extension)) && !file.endsWith('.d.ts'))) {
    let directory = path.posix.dirname(file)
    while (directory !== '.' && !candidates.has(directory)) directory = path.posix.dirname(directory)
    if (candidates.has(directory)) sources.add(directory)
  }
  return [...candidates].filter(directory => sources.has(directory)).map(directory => path.resolve(root, directory))
}

export interface FrameworkSources extends FrameworkConfigs {
  root: string
  /** The files to select from: the scanner's files for a scan, the candidates before exclusions for a source listing. */
  files: readonly string[]
  /** The dependency that makes a package directory this framework's project. */
  dependency: string
  /** Extensions whose presence marks a project directory, as the scan's own project search uses. */
  projects: readonly string[]
  /** Extensions the scan reads inside a project, including any companion resource it reads. */
  sources: readonly string[]
}

/**
 * Each project directory with the files its framework scan reads: every source of its kind among `files` that no nested
 * project claims. No program, type checker or project tool runs, so which files a project's program resolves stays for
 * the analysis to decide.
 */
export async function frameworkProjectFiles(options: FrameworkSources): Promise<Map<string, string[]>> {
  const { root, files, dependency, projects, sources } = options
  const directories = (await frameworkProjects(root, files, dependency, projects, options))
    .map(directory => path.relative(root, directory).split(path.sep).join('/') || '.')
    // Deepest first, so a file belongs to its nearest project.
    .sort((left, right) => right.length - left.length)
  const assigned = new Map(directories.map(directory => [directory, [] as string[]]))
  if (directories.length === 0) return assigned
  for (const file of files.filter(candidate => !candidate.endsWith('.d.ts'))) {
    const project = directories.find(directory => directory === '.' || file.startsWith(`${directory}/`))
    if (project !== undefined && sources.some(extension => file.endsWith(extension))) assigned.get(project)!.push(file)
  }
  return assigned
}

/** The files a framework scan reads, across all its projects. */
export async function frameworkSourceFiles(options: FrameworkSources): Promise<string[]> {
  return [...(await frameworkProjectFiles(options)).values()].flat().sort()
}
