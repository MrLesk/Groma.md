import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execute = promisify(execFile)
const excluded = new Set(['.git', 'node_modules', 'vendor', 'target', 'dist', 'build', 'bin', 'obj',
  '.gradle', '.angular', 'coverage', 'generated', 'groma', '.groma'])

/** Project selection uses the same tracked/unignored declaration boundary as discovery. */
export async function projectFiles(root: string, matches: (file: string) => boolean): Promise<string[]> {
  const { stdout } = await execute('git', ['-C', root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { maxBuffer: 64 * 1024 * 1024 })
  return [...new Set(stdout.split('\0').filter(file => file && matches(file)
    && !file.split('/').some(part => excluded.has(part)) && existsSync(path.join(root, file))))].sort()
}

export function hasDependency(manifest: Record<string, Record<string, unknown> | undefined>, dependency: string): boolean {
  return ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
    .some(section => typeof manifest[section]?.[dependency] === 'string')
}

export async function frameworkProjects(root: string, dependency: string): Promise<string[]> {
  const projects: string[] = []
  for (const file of await projectFiles(root, file => path.posix.basename(file) === 'package.json')) {
    const manifest = JSON.parse(await readFile(path.join(root, file), 'utf8'))
    if (hasDependency(manifest, dependency)) projects.push(path.dirname(path.join(root, file)))
  }
  return projects
}
