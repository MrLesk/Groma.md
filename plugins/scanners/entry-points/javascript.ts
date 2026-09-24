import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createScanObservation, type ScanEntryPoint, type ScanObservation } from '@groma/scanner'
import type { EntrySources } from './source.ts'
import { sourceOf, type BuildOutput } from '../workspace-packages.ts'

/** An execution entry; `compiled` names further files its build compiles into the same application. */
export type SourceEntry = Omit<ScanEntryPoint, 'files'> & { compiled?: string[] }

/** The nearest of these directories above a file, or the repository root. */
function packageFor(file: string, packages: ReadonlySet<string>): string {
  let directory = path.posix.dirname(file)
  while (directory !== '.' && !packages.has(directory)) directory = path.posix.dirname(directory)
  return directory
}

function declaredBins(declaration: string, manifest: Record<string, unknown>): SourceEntry[] {
  const bins = typeof manifest.bin === 'string' ? { [String(manifest.name ?? 'main')]: manifest.bin } : manifest.bin
  if (!bins || typeof bins !== 'object') return []
  return Object.entries(bins).flatMap(([name, target]) => typeof target === 'string'
    ? [{ declaration, name, file: path.posix.join(path.posix.dirname(declaration), target) }] : [])
}

const RUNTIMES = new Set(['node', 'bun', 'tsx', 'ts-node'])
/** Runtime options whose value is the next word, such as a preloaded module or a config file, never the script. */
const VALUE_OPTIONS = new Set(['-r', '--require', '--import', '--tsconfig'])
const SCRIPT = /^[\w./-]+\.[cm]?[jt]sx?$/

/** The position of a command's program, after environment assignments such as `NODE_ENV=production` or `cross-env`. */
function runtimeAt(words: readonly string[]): number {
  let index = words[0] === 'cross-env' ? 1 : 0
  while (/^[A-Za-z_]\w*=/.test(words[index] ?? '')) index += 1
  return index
}

/**
 * The script a literal runtime command runs: after environment assignments or `cross-env`, the runtime, its options
 * and a `run` or `watch` subcommand, the first word must name a script, so `bun build src/app.ts` runs nothing.
 */
function commandScript(command: string): string | undefined {
  const words = command.trim().split(/\s+/)
  let index = runtimeAt(words)
  if (!RUNTIMES.has(words[index] ?? '')) return undefined
  let subcommand = true
  for (index += 1; index < words.length; index += 1) {
    const word = words[index]!
    if (VALUE_OPTIONS.has(word)) index += 1
    else if (subcommand && (word === 'run' || word === 'watch')) subcommand = false
    else if (!word.startsWith('-')) return SCRIPT.test(word) ? word : undefined
  }
  return undefined
}

function declaredScripts(declaration: string, scripts: Record<string, unknown> | undefined): SourceEntry[] {
  return Object.entries(scripts ?? {}).flatMap(([name, script]) => {
    if (typeof script !== 'string') return []
    // Only split literal chains: a quoted shell fragment can contain && without running another command.
    const commands = /["'`]/.test(script) ? [script] : script.split(/\s+&&\s+/)
    return commands.flatMap(command => {
      const file = commandScript(command)
      return file === undefined ? [] : [{ declaration, name, file: path.posix.join(path.posix.dirname(declaration), file) }]
    })
  })
}

interface BuildTarget { options?: Record<string, unknown>; configurations?: Record<string, { fileReplacements?: unknown }> }
interface WorkspaceProject { name?: string; architect?: { build?: BuildTarget }; targets?: { build?: BuildTarget } }

const isString = (value: unknown): value is string => typeof value === 'string'

/**
 * An Angular CLI or Nx build target's application entry. Its polyfills and the environment files a configuration
 * swaps in compile into the same application. Paths are relative to the workspace root.
 */
function buildEntry(declaration: string, workspace: string, name: string, project: WorkspaceProject): SourceEntry[] {
  const build = (project.architect ?? project.targets)?.build
  const main = build?.options?.browser ?? build?.options?.main
  if (!isString(main)) return []
  const replacements = Object.values(build?.configurations ?? {}).flatMap(configuration => Array.isArray(configuration.fileReplacements)
    ? configuration.fileReplacements.map(replacement => (replacement as { with?: unknown } | undefined)?.with) : [])
  const at = (file: string) => path.posix.join(workspace, file)
  return [{ declaration, name, file: at(main), compiled: [build?.options?.polyfills, ...replacements].flat().filter(isString).map(at) }]
}

function angularEntries(declaration: string, source: string): SourceEntry[] {
  const projects: Record<string, WorkspaceProject> = JSON.parse(source).projects ?? {}
  return Object.entries(projects).flatMap(([name, project]) => buildEntry(declaration, path.posix.dirname(declaration), name, project))
}

/** An Nx project's own build target; the workspace root is the nearest directory with nx.json. */
function nxEntries(declaration: string, source: string, workspaces: ReadonlySet<string>): SourceEntry[] {
  const workspace = packageFor(declaration, workspaces)
  if (!workspaces.has(workspace)) return []
  const project: WorkspaceProject = JSON.parse(source)
  return buildEntry(declaration, workspace, project.name ?? path.posix.basename(path.posix.dirname(declaration)), project)
}

function browserEntries(declaration: string, source: string, packages: ReadonlySet<string>): SourceEntry[] {
  const scripts = [...source.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)]
  const folder = path.posix.dirname(declaration)
  // A bundler's `index.html` names nothing, so its application takes its folder's name.
  const page = path.posix.basename(declaration, '.html')
  const name = page === 'index' && folder !== '.' ? path.posix.basename(folder) : page
  return scripts.flatMap(match => {
    const src = match[1]!
    if (/^(?:[a-z]+:|\/\/)/i.test(src)) return []
    const base = src.startsWith('/') ? packageFor(declaration, packages) : folder
    return [{ file: path.posix.join(base, src.replace(/^\//, '')), declaration, name }]
  })
}

/**
 * The files an entry reaches through local imports within its package, from the entry and the further files its build
 * compiles, with every file of each source unit it reaches.
 */
function reachedFiles(entry: string, compiled: readonly string[], imports: ReadonlyMap<string, string[]>, packages: ReadonlySet<string>,
  units: NonNullable<ScanObservation['sourceUnits']>): Set<string> {
  const owner = packageFor(entry, packages), found = new Set<string>()
  const pending = [entry, ...compiled]
  while (pending.length) {
    const file = pending.pop()!
    if (found.has(file) || packageFor(file, packages) !== owner) continue
    found.add(file)
    pending.push(...imports.get(file) ?? [])
  }
  for (const unit of units) if (found.has(unit.primary)) for (const file of unit.files) found.add(file)
  return found
}

/** The entries that package manifests, workspace build targets and HTML pages declare. */
async function declaredEntries(root: string, declarations: readonly string[], packages: ReadonlySet<string>,
  workspaces: ReadonlySet<string>): Promise<SourceEntry[]> {
  const entries: SourceEntry[] = []
  for (const file of declarations) {
    const text = await readFile(path.join(root, file), 'utf8')
    const name = path.posix.basename(file)
    if (name === 'package.json') {
      const manifest = JSON.parse(text)
      entries.push(...declaredBins(file, manifest), ...declaredScripts(file, manifest.scripts))
    } else if (name === 'angular.json') entries.push(...angularEntries(file, text))
    else if (name === 'project.json') entries.push(...nxEntries(file, text, workspaces))
    else if (file.endsWith('.html')) entries.push(...browserEntries(file, text, packages))
  }
  return entries
}

/** A declared entry on the source file it stands for, such as the source a `bin` under a build's `outDir` comes from. */
function sourced(entry: SourceEntry, files: ReadonlySet<string>, outputs: readonly BuildOutput[] = []): SourceEntry {
  const file = sourceOf(entry.file, outputs, files)
  return file === undefined ? entry : { ...entry, file }
}

/**
 * Shared source facts for JS/TS and framework observers; each contributes only the files it analyzed, and reads only the
 * manifests, workspace files and pages among its `files`.
 */
export async function withJavaScriptEntries(
  root: string, observation: ScanObservation | undefined, inputs: EntrySources, files: readonly string[],
): Promise<ScanObservation | undefined> {
  if (!observation) return undefined
  const inventory = files.filter(file =>
    ['package.json', 'angular.json', 'project.json', 'nx.json'].includes(path.posix.basename(file)) || file.endsWith('.html'))
  const workspaces = new Set(inventory.filter(file => path.posix.basename(file) === 'nx.json').map(file => path.posix.dirname(file)))
  const packages = new Set(inventory.filter(file => path.posix.basename(file) === 'package.json').map(file => path.posix.dirname(file)))
  const active = new Set(observation.files.map(file => packageFor(file.file, packages)))
  const declarations = inventory.filter(file => path.posix.basename(file) !== 'nx.json' && active.has(packageFor(file, packages)))
  const entries = [...inputs.entries, ...await declaredEntries(root, declarations, packages, workspaces)]
  const inventoryFiles = [...observation.files]
  const visible = new Set(inventoryFiles.map(file => file.file))
  const readable = new Set(files)
  const entryPoints = entries.map(entry => sourced(entry, readable, inputs.buildOutputs)).flatMap(({ compiled = [], ...entry }) => {
    if (!inputs.imports.has(entry.file)) return []
    const reached = reachedFiles(entry.file, compiled, inputs.imports, packages, observation.sourceUnits ?? [])
    const members = observation.files.filter(file => reached.has(file.file))
    if (!members.length) return []
    if (!visible.has(entry.file)) {
      // Frameworks analyze the launcher as well as its components. Keep that physical identity explicit.
      inventoryFiles.push({ file: entry.file, symbols: [], roots: [...new Set(members.flatMap(file => file.roots))] })
      visible.add(entry.file)
    }
    return [{ ...entry, files: [...new Set([entry.file, ...members.map(file => file.file)])] }]
  })
  return createScanObservation({ ...observation, files: inventoryFiles, entryPoints })
}
