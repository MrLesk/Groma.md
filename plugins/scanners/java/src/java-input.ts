import { access, readFile, readdir, realpath } from 'node:fs/promises'
import path from 'node:path'
import { readGradleProject } from './gradle.ts'
import { readMavenProject } from './maven.ts'

interface JavaProject {
  /** An empty release selects the bundled compiler's language version. */
  release: string
  encoding: string
  sourceRoots: string[]
  name: string
  kind: 'maven-project' | 'gradle-project'
  /** The build declaration, relative to the project directory. */
  file?: string
}

export interface JavaInput extends Omit<JavaProject, 'sourceRoots'> {
  root: string
  files: string[]
}

export async function exists(file: string): Promise<boolean> {
  try { await access(file); return true }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

async function collect(root: string, directory: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await collect(root, file))
    else if (entry.isFile() && file.endsWith('.java')) files.push(path.relative(root, file).split(path.sep).join('/'))
  }
  return files.sort()
}

/**
 * A directory with pom.xml is a Maven project and every other selected directory a Gradle project; the scan and
 * the source listing both read its declarations here. Undefined for a Maven aggregator.
 */
export async function readJavaProject(directory: string): Promise<JavaProject | undefined> {
  const pom = path.join(directory, 'pom.xml')
  if (!await exists(pom)) return { release: '', ...await readGradleProject(directory), encoding: 'UTF-8', kind: 'gradle-project' }
  const maven = readMavenProject(directory, await readFile(pom, 'utf8'))
  return maven && { ...maven, kind: 'maven-project', file: 'pom.xml' }
}

export async function readJavaInput(repositoryRoot: string): Promise<JavaInput | undefined> {
  const root = await realpath(repositoryRoot)
  const project = await readJavaProject(root)
  if (!project) return undefined
  const { sourceRoots, ...input } = project
  const found = await Promise.all(sourceRoots.map(async sourceRoot => {
    const directory = path.resolve(root, sourceRoot)
    return await exists(directory) ? collect(root, directory) : []
  }))
  const files = [...new Set(found.flat())].sort()
  if (!files.length) return undefined
  return { ...input, root, files }
}
