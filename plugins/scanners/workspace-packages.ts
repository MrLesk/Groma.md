import path from 'node:path'
import { packageManifest } from './typescript-project.ts'

/*
 * Workspace packages as a fresh checkout has them, without node_modules or build output. Every named package.json among
 * the scanner's files is a workspace package, whatever a `workspaces` field lists: its name resolves to the source its
 * manifest points at, and a file its build writes to the source it comes from. The TypeScript scanner gives these
 * mappings to its compiler and to the entry reader.
 */

/** Where a build writes a source folder: a file under `outDir` comes from the same path under `rootDir`. */
export interface BuildOutput { outDir: string; rootDir: string }

/** The same path under `rootDir` for a repository-relative path under a build's `outDir`, or none. */
function inRootDir(file: string, outputs: readonly BuildOutput[]): string | undefined {
  const output = outputs.find(({ outDir }) => file.startsWith(`${outDir}/`))
  return output === undefined ? undefined : path.posix.join(output.rootDir, file.slice(output.outDir.length + 1))
}

/** The source file among `files` a built file under an `outDir` comes from, by its `.ts` or `.tsx` name, or none. */
export function sourceOf(file: string, outputs: readonly BuildOutput[], files: ReadonlySet<string>): string | undefined {
  const stem = inRootDir(file, outputs)?.replace(/\.(?:d\.[cm]?ts|[cm]?jsx?)$/, '')
  return stem === undefined ? undefined : ['.ts', '.tsx'].map(extension => `${stem}${extension}`).find(candidate => files.has(candidate))
}

/**
 * A served target as the compiler should look for it: under a build's `outDir`, the same path under `rootDir`, where a
 * declaration file takes its JavaScript name, which the compiler resolves to the `.ts` or `.tsx` source.
 */
function compilerTarget(target: string, outputs: readonly BuildOutput[]): string {
  return inRootDir(target, outputs)?.replace(/\.d\.([cm]?)ts$/, '.$1js') ?? target
}

/** The conditions TypeScript resolves package exports with, taken in each object's own order. */
const conditions = new Set(['types', 'import', 'default', 'require'])

/** The targets an `exports` value names, in the order TypeScript tries them: a string, a fallback array's entries, or each matching condition's. */
function exportTargets(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(exportTargets)
  if (value === null || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([condition, target]) => conditions.has(condition) ? exportTargets(target) : [])
}

interface Manifest { name?: unknown; exports?: unknown; types?: unknown; typings?: unknown; main?: unknown }

/**
 * Each import subpath a package serves, `.` for its bare name, with the targets it names in order: its `exports`, else
 * `types`, `typings` and `main` for its name.
 */
function servedTargets({ exports, types, typings, main }: Manifest): [string, string[]][] {
  if (exports === undefined) return [['.', [types, typings, main].filter(field => typeof field === 'string')]]
  const subpaths = exports !== null && typeof exports === 'object' && !Array.isArray(exports)
    && Object.keys(exports).some(key => key.startsWith('.'))
  return subpaths
    ? Object.entries(exports as Record<string, unknown>).map(([subpath, value]) => [subpath, exportTargets(value)])
    : [['.', exportTargets(exports)]]
}

/**
 * One package's mappings, from its name and each subpath it serves to every absolute target in order; the compiler takes
 * the first that names a file, so a target that names none leaves the import unresolved.
 */
function packageMappings(root: string, file: string, name: string, manifest: Manifest, outputs: readonly BuildOutput[]): [string, string[]][] {
  return servedTargets(manifest).flatMap(([subpath, targets]) => targets.length === 0 ? [] : [[
    subpath === '.' ? name : `${name}/${subpath.slice(2)}`,
    targets.map(target => path.join(root, compilerTarget(path.posix.join(path.posix.dirname(file), target), outputs))),
  ]])
}

/**
 * Compiler path mappings from the name of each workspace package among `files`, and each subpath it serves, to absolute
 * targets. A name two packages share is ambiguous, so its imports stay unresolved.
 */
export async function packagePaths(root: string, outputs: readonly BuildOutput[], files: readonly string[]): Promise<Record<string, string[]>> {
  const manifests = await Promise.all(files.filter(file => path.posix.basename(file) === 'package.json')
    .map(async file => ({ file, manifest: await packageManifest(root, file) as Manifest | undefined })))
  const named = manifests.flatMap(({ file, manifest }) => typeof manifest?.name === 'string' ? [{ file, name: manifest.name, manifest }] : [])
  const counts = new Map<string, number>()
  for (const { name } of named) counts.set(name, (counts.get(name) ?? 0) + 1)
  return Object.fromEntries(named.filter(({ name }) => counts.get(name) === 1)
    .flatMap(({ file, name, manifest }) => packageMappings(root, file, name, manifest, outputs)))
}
