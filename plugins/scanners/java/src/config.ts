import { readdir, readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'

export const configFile = 'groma-java.json'
export interface JavaInput {
  root: string
  release: number
  classpath: string[]
  files: string[]
}

function relativePath(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value || /[\r\n\0]/.test(value)) {
    throw new Error(`${label} must be a non-empty path without line breaks`)
  }
  return value
}

function inside(root: string, file: string): boolean {
  const relative = path.relative(root, file)
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  return value.map(item => relativePath(item, label))
}

async function collect(root: string, directory: string, files: Set<string>, limit: number): Promise<void> {
  const entries = (await readdir(directory, { withFileTypes: true }))
    .sort((a, b) => a.name.localeCompare(b.name))
  for (const entry of entries) {
    const file = path.join(directory, entry.name)
    if (entry.isSymbolicLink()) throw new Error(`Java source symlinks are unsupported: ${file}`)
    if (entry.isDirectory()) await collect(root, file, files, limit)
    if (!entry.isFile() || !entry.name.endsWith('.java')) continue
    if (entry.name === 'module-info.java') throw new Error('JPMS source sets are not supported by the Java prototype')
    const relative = path.relative(root, file).split(path.sep).join('/')
    relativePath(relative, 'Java source file')
    files.add(relative)
    if (files.size > limit) throw new Error(`Java source set exceeds maxFiles=${limit}; select a smaller compilation source set`)
  }
}

function configObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${configFile} must be an object`)
  const config = value as Record<string, unknown>
  const unknown = Object.keys(config).filter(key => !['sourceRoots', 'release', 'classpath', 'maxFiles'].includes(key))
  if (unknown.length) throw new Error(`Unknown Java configuration fields: ${unknown.join(', ')}`)
  return config
}

export async function readJavaInput(repositoryRoot: string): Promise<JavaInput | undefined> {
  const root = await realpath(repositoryRoot)
  let source: string
  try { source = await readFile(path.join(root, configFile), 'utf8') }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
  const { config, sourceRoots, limit } = settings(source)
  const files = new Set<string>()
  for (const sourceRoot of sourceRoots) {
    if (path.isAbsolute(sourceRoot)) throw new Error('Java sourceRoots must be repository-relative')
    const directory = await realpath(path.resolve(root, sourceRoot))
    if (!inside(root, directory)) throw new Error('Java sourceRoots must stay inside the repository')
    await collect(root, directory, files, limit)
  }
  if (!files.size) throw new Error('The configured Java source set is empty; no observation was produced')
  const classpath = stringArray(config.classpath ?? [], 'classpath')
  const resolvedClasspath = await Promise.all(classpath.map(async entry => {
    const file = path.resolve(root, entry)
    if (file.includes(path.delimiter)) throw new Error('Java classpath entries must not contain the platform path separator')
    await stat(file)
    return file
  }))
  return { root, release: Number(config.release), classpath: resolvedClasspath, files: [...files].sort() }
}

function settings(source: string) {
  const config = configObject(JSON.parse(source))
  if (typeof config.release !== 'number' || ![8, 11, 17, 21].includes(config.release)) {
    throw new Error('Java release must be one of 8, 11, 17 or 21')
  }
  const sourceRoots = stringArray(config.sourceRoots, 'sourceRoots')
  if (!sourceRoots.length) throw new Error('Java sourceRoots must not be empty')
  const limit = config.maxFiles ?? 5000
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 50000) {
    throw new Error('Java maxFiles must be an integer from 1 to 50000')
  }
  return { config, sourceRoots, limit }
}
