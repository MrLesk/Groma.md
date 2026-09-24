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
 * A directory with a pom.xml that `excluded` leaves in is a Maven project and every other selected directory a Gradle
 * project; the scan and the source listing both read its declarations here. Undefined for a Maven aggregator.
 * `excluded` takes paths relative to the directory.
 */
export async function readJavaProject(
  directory: string, excluded: (file: string) => boolean = () => false,
): Promise<JavaProject | undefined> {
  const pom = path.join(directory, 'pom.xml')
  if (excluded('pom.xml') || !await exists(pom)) {
    return { release: '', ...await readGradleProject(directory, excluded), encoding: 'UTF-8', kind: 'gradle-project' }
  }
  const maven = readMavenProject(directory, await readFile(pom, 'utf8'))
  return maven && { ...maven, kind: 'maven-project', file: 'pom.xml' }
}

/** The project's declarations and the sources under its main source roots that `excluded` leaves in. */
export async function readJavaInput(
  projectRoot: string, excluded: (file: string) => boolean = () => false,
): Promise<JavaInput | undefined> {
  const root = await realpath(projectRoot)
  const project = await readJavaProject(root, excluded)
  if (!project) return undefined
  const { sourceRoots, ...input } = project
  const found = await Promise.all(sourceRoots.map(async sourceRoot => {
    const directory = path.resolve(root, sourceRoot)
    return await exists(directory) ? collect(root, directory) : []
  }))
  // Exclusions apply inside a declared root too, such as a generated root in a build directory.
  const files = [...new Set(found.flat())].filter(file => !excluded(file)).sort()
  if (!files.length) return undefined
  return { ...input, root, files }
}
