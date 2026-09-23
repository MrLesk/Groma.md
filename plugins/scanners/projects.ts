import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execute = promisify(execFile)
const excluded = new Set(['.git', 'node_modules', 'vendor', 'target', 'dist', 'build', 'obj',
  '.gradle', '.angular', 'coverage', 'generated', 'groma', '.groma'])

/** The tracked and unignored files that match and exist, in any directory. */
export async function repositoryFiles(root: string, matches: (file: string) => boolean): Promise<string[]> {
  const { stdout } = await execute('git', ['-C', root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { maxBuffer: 64 * 1024 * 1024 })
  return [...new Set(stdout.split('\0').filter(file => file && matches(file) && existsSync(path.join(root, file))))].sort()
}

/** A repository-relative file inside a repository-relative directory; the empty directory is the repository root. */
export function isUnder(file: string, directory: string): boolean {
  return directory === '' || file.startsWith(`${directory}/`)
}

/** Project selection uses the same tracked/unignored declaration boundary as discovery, outside dependency and build directories. */
export function projectFiles(root: string, matches: (file: string) => boolean): Promise<string[]> {
  return repositoryFiles(root, file => matches(file) && !file.split('/').some(part => excluded.has(part)))
}

export function hasDependency(manifest: Record<string, Record<string, unknown> | undefined>, dependency: string): boolean {
  return ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
    .some(section => typeof manifest[section]?.[dependency] === 'string')
}

function hasProjectConfig(directory: string, configs: Set<string>, inherit: boolean): boolean {
  for (let current = directory; ; current = path.posix.dirname(current)) {
    if (configs.has(current)) return true
    if (!inherit || current === '.') return false
  }
}

export async function frameworkProjects(
  root: string, dependency: string, extensions: readonly string[], options: { inheritConfig?: boolean } = {},
): Promise<string[]> {
  const files = await projectFiles(root, () => true)
  const manifests = files.filter(file => path.posix.basename(file) === 'package.json')
  const configs = new Set(files.filter(file => path.posix.basename(file) === 'tsconfig.json').map(file => path.posix.dirname(file)))
  const candidates = new Set<string>()
  for (const file of manifests) {
    const directory = path.posix.dirname(file)
    if (!hasProjectConfig(directory, configs, options.inheritConfig === true)) continue
    const manifest = JSON.parse(await readFile(path.join(root, file), 'utf8'))
    if (hasDependency(manifest, dependency)) candidates.add(directory)
  }
  const sources = new Set<string>()
  for (const file of files.filter(file => extensions.some(extension => file.endsWith(extension)) && !file.endsWith('.d.ts'))) {
    let directory = path.posix.dirname(file)
    while (directory !== '.' && !candidates.has(directory)) directory = path.posix.dirname(directory)
    if (candidates.has(directory)) sources.add(directory)
  }
  return [...candidates].filter(directory => sources.has(directory)).map(directory => path.resolve(root, directory))
}
